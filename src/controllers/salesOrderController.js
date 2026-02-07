import { Op } from "sequelize";
import { sequelize } from "../config/database.js";
import SalesOrder from "../models/SaleOrder.js";
import SalesOrderLine from "../models/SalesOrderLine.js";
import SKU from "../models/SKU.js";
import Client from "../models/Client.js";
import Warehouse from "../models/Warehouse.js";
import StockAllocation from "../models/StockAllocation.js";
import { generateOrderNo } from "../utils/sequenceGenerator.js";
import {
  allocateOrder,
  releaseOrderAllocations,
} from "../services/allocationService.js";

// Create new sales order with lines
// POST /api/sales-orders
const createOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      warehouse_id,
      client_id,
      customer_name,
      customer_email,
      customer_phone,
      ship_to_name,
      ship_to_address_line1,
      ship_to_address_line2,
      ship_to_city,
      ship_to_state,
      ship_to_country = "India",
      ship_to_pincode,
      ship_to_phone,
      order_type = "STANDARD",
      priority = "NORMAL",
      sla_due_date,
      carrier,
      carrier_service,
      reference_no,
      special_instructions,
      notes,
      payment_mode,
      cod_amount,
      lines,
    } = req.body;

    if (!warehouse_id || !client_id || !customer_name) {
      await transaction.rollback();
      return res.status(400).json({
        error: "warehouse_id, client_id, and customer_name are required",
      });
    }

    if (!lines || lines.length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Order must have at least one line" });
    }

    const warehouse = await Warehouse.findByPk(warehouse_id, { transaction });
    if (!warehouse) {
      await transaction.rollback();
      return res.status(404).json({ error: "Warehouse not found" });
    }

    const client = await Client.findByPk(client_id, { transaction });
    if (!client) {
      await transaction.rollback();
      return res.status(404).json({ error: "Client not found" });
    }

    const orderNo = await generateOrderNo();

    const totalLines = lines.length;
    const totalOrderedUnits = lines.reduce(
      (sum, line) => sum + parseFloat(line.ordered_qty || 0),
      0,
    );

    const order = await SalesOrder.create(
      {
        order_no: orderNo,
        warehouse_id,
        client_id,
        customer_name,
        customer_email,
        customer_phone,
        ship_to_name: ship_to_name || customer_name,
        ship_to_address_line1,
        ship_to_address_line2,
        ship_to_city,
        ship_to_state,
        ship_to_country,
        ship_to_pincode,
        ship_to_phone: ship_to_phone || customer_phone,
        order_date: new Date(),
        order_type,
        priority,
        sla_due_date,
        carrier,
        carrier_service,
        reference_no,
        total_lines: totalLines,
        total_ordered_units: totalOrderedUnits,
        status: "DRAFT",
        special_instructions,
        notes,
        payment_mode,
        cod_amount,
        created_by: req.user?.id,
      },
      { transaction },
    );

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const sku = await SKU.findByPk(line.sku_id, { transaction });
      if (!sku) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ error: `SKU with id ${line.sku_id} not found` });
      }

      await SalesOrderLine.create(
        {
          order_id: order.id,
          line_no: i + 1,
          sku_id: line.sku_id,
          ordered_qty: line.ordered_qty,
          uom: line.uom || sku.uom || "EA",
          allocation_rule: line.allocation_rule || sku.pick_rule || "FIFO",
          batch_preference: line.batch_preference,
          expiry_date_min: line.expiry_date_min,
          unit_price: line.unit_price,
          line_total: line.unit_price
            ? parseFloat(line.unit_price) * parseFloat(line.ordered_qty)
            : null,
          discount_percent: line.discount_percent || 0,
          discount_amount: line.discount_amount || 0,
          tax_percent: line.tax_percent || 0,
          tax_amount: line.tax_amount || 0,
          status: "PENDING",
          notes: line.notes,
        },
        { transaction },
      );
    }

    await transaction.commit();

    const completeOrder = await SalesOrder.findByPk(order.id, {
      include: [
        {
          model: SalesOrderLine,
          as: "lines",
          include: [{ model: SKU, as: "sku" }],
        },
        { model: Client, as: "client" },
        { model: Warehouse, as: "warehouse" },
      ],
    });

    res.status(201).json({
      message: "Sales order created successfully",
      order: completeOrder,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

// Get all sales orders with filters
// GET /api/sales-orders
const getAllOrders = async (req, res, next) => {
  try {
    const {
      warehouse_id,
      client_id,
      status,
      priority,
      order_type,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};

    if (warehouse_id) where.warehouse_id = warehouse_id;
    if (client_id) where.client_id = client_id;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (order_type) where.order_type = order_type;

    if (search) {
      where[Op.or] = [
        { order_no: { [Op.like]: `%${search}%` } },
        { customer_name: { [Op.like]: `%${search}%` } },
        { reference_no: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await SalesOrder.findAndCountAll({
      where,
      include: [
        {
          model: SalesOrderLine,
          as: "lines",
          include: [{ model: SKU, as: "sku" }],
        },
        { model: Client, as: "client" },
        { model: Warehouse, as: "warehouse" },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit)),
      orders: rows,
    });
  } catch (error) {
    next(error);
  }
};

// Get single order by ID
// GET /api/sales-orders/:id
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await SalesOrder.findByPk(id, {
      include: [
        {
          model: SalesOrderLine,
          as: "lines",
          include: [
            { model: SKU, as: "sku" },
            {
              model: StockAllocation,
              as: "allocations",
              where: { status: ["ACTIVE", "CONSUMED"] },
              required: false,
            },
          ],
        },
        { model: Client, as: "client" },
        { model: Warehouse, as: "warehouse" },
      ],
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
};

// Update sales order
// PUT /api/sales-orders/:id
const updateOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const order = await SalesOrder.findByPk(id, { transaction });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    if (!["DRAFT", "CONFIRMED"].includes(order.status)) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot update order with status: ${order.status}`,
      });
    }

    updateData.updated_by = req.user?.id;

    await order.update(updateData, { transaction });

    await transaction.commit();

    const updatedOrder = await SalesOrder.findByPk(id, {
      include: [
        {
          model: SalesOrderLine,
          as: "lines",
          include: [{ model: SKU, as: "sku" }],
        },
        { model: Client, as: "client" },
        { model: Warehouse, as: "warehouse" },
      ],
    });

    res.json({
      message: "Order updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

// Confirm order and trigger auto-allocation
// POST /api/sales-orders/:id/confirm
const confirmOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const order = await SalesOrder.findByPk(id, {
      include: [{ model: SalesOrderLine, as: "lines" }],
      transaction,
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "DRAFT") {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot confirm order with status: ${order.status}`,
      });
    }

    await order.update(
      {
        status: "CONFIRMED",
        confirmed_at: new Date(),
      },
      { transaction },
    );

    // AUTO-ALLOCATE INVENTORY
    const allocationResult = await allocateOrder(id, transaction);

    if (allocationResult.fullyAllocated) {
      await order.update(
        {
          status: "ALLOCATED",
          allocation_status: "FULL",
          allocated_at: new Date(),
        },
        { transaction },
      );
    } else if (allocationResult.partiallyAllocated) {
      await order.update(
        {
          status: "PARTIAL_ALLOCATION",
          allocation_status: "PARTIAL",
        },
        { transaction },
      );
    } else {
      await order.update(
        {
          allocation_status: "FAILED",
        },
        { transaction },
      );
    }

    await transaction.commit();

    const confirmedOrder = await SalesOrder.findByPk(id, {
      include: [
        {
          model: SalesOrderLine,
          as: "lines",
          include: [
            { model: SKU, as: "sku" },
            {
              model: StockAllocation,
              as: "allocations",
              where: { status: "ACTIVE" },
              required: false,
            },
          ],
        },
        { model: Client, as: "client" },
        { model: Warehouse, as: "warehouse" },
      ],
    });

    res.json({
      message: "Order confirmed and allocated",
      order: confirmedOrder,
      allocation: allocationResult,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

// Cancel sales order
// DELETE /api/sales-orders/:id/cancel
const cancelOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const order = await SalesOrder.findByPk(id, { transaction });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    if (
      !["DRAFT", "CONFIRMED", "ALLOCATED", "PARTIAL_ALLOCATION"].includes(
        order.status,
      )
    ) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot cancel order with status: ${order.status}`,
      });
    }

    const releaseResult = await releaseOrderAllocations(
      id,
      cancellation_reason || "Order cancelled",
      transaction,
    );

    await SalesOrderLine.update(
      {
        status: "CANCELLED",
        cancelled_at: new Date(),
        cancellation_reason,
      },
      {
        where: { order_id: id },
        transaction,
      },
    );

    await order.update(
      {
        status: "CANCELLED",
        cancelled_at: new Date(),
        cancellation_reason,
      },
      { transaction },
    );

    await transaction.commit();

    res.json({
      message: "Order cancelled successfully",
      released_allocations: releaseResult.released_count,
      released_qty: releaseResult.total_qty_released,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

// Get order statistics
// GET /api/sales-orders/stats
const getOrderStats = async (req, res, next) => {
  try {
    const { warehouse_id, client_id } = req.query;

    const where = {};
    if (warehouse_id) where.warehouse_id = warehouse_id;
    if (client_id) where.client_id = client_id;

    const stats = await SalesOrder.findAll({
      where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [
          sequelize.fn("SUM", sequelize.col("total_ordered_units")),
          "total_units",
        ],
      ],
      group: ["status"],
    });

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  confirmOrder,
  cancelOrder,
  getOrderStats,
};
