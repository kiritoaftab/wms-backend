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

/**
 * Create new sales order with lines
 * POST /api/sales-orders
 */
export async function createOrder(req, res) {
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
      lines, // Array of { sku_id, ordered_qty, uom, allocation_rule, unit_price, ... }
    } = req.body;

    // Validation
    if (!warehouse_id || !client_id || !customer_name) {
      return res.status(400).json({
        error: "warehouse_id, client_id, and customer_name are required",
      });
    }

    if (!lines || lines.length === 0) {
      return res.status(400).json({ error: "Order must have at least one line" });
    }

    // Verify warehouse and client exist
    const warehouse = await Warehouse.findByPk(warehouse_id);
    if (!warehouse) {
      return res.status(404).json({ error: "Warehouse not found" });
    }

    const client = await Client.findByPk(client_id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Generate order number
    const orderNo = await generateOrderNo();

    // Calculate order totals
    const totalLines = lines.length;
    const totalOrderedUnits = lines.reduce(
      (sum, line) => sum + parseFloat(line.ordered_qty || 0),
      0
    );

    // Create order
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
      { transaction }
    );

    // Create order lines
    const orderLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Verify SKU exists
      const sku = await SKU.findByPk(line.sku_id);
      if (!sku) {
        throw new Error(`SKU with id ${line.sku_id} not found`);
      }

      const orderLine = await SalesOrderLine.create(
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
        { transaction }
      );

      orderLines.push(orderLine);
    }

    await transaction.commit();

    // Fetch complete order with lines
    const completeOrder = await SalesOrder.findByPk(order.id, {
      include: [
        {
          model: SalesOrderLine,
          include: [SKU],
        },
        Client,
        Warehouse,
      ],
    });

    res.status(201).json({
      message: "Sales order created successfully",
      order: completeOrder,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating sales order:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get all sales orders with filters
 * GET /api/sales-orders?warehouse_id=1&status=CONFIRMED&client_id=2
 */
export async function getAllOrders(req, res) {
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
          include: [SKU],
        },
        Client,
        Warehouse,
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
    console.error("Error fetching sales orders:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get single order by ID
 * GET /api/sales-orders/:id
 */
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;

    const order = await SalesOrder.findByPk(id, {
      include: [
        {
          model: SalesOrderLine,
          include: [
            SKU,
            {
              model: StockAllocation,
              where: { status: ["ACTIVE", "CONSUMED"] },
              required: false,
            },
          ],
        },
        Client,
        Warehouse,
      ],
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update sales order
 * PUT /api/sales-orders/:id
 */
export async function updateOrder(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const order = await SalesOrder.findByPk(id, { transaction });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    // Prevent update if order is beyond DRAFT/CONFIRMED status
    if (!["DRAFT", "CONFIRMED"].includes(order.status)) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot update order with status: ${order.status}`,
      });
    }

    // Add updated_by
    updateData.updated_by = req.user?.id;

    await order.update(updateData, { transaction });

    await transaction.commit();

    // Fetch updated order
    const updatedOrder = await SalesOrder.findByPk(id, {
      include: [
        {
          model: SalesOrderLine,
          include: [SKU],
        },
        Client,
        Warehouse,
      ],
    });

    res.json({
      message: "Order updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating order:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Confirm order and trigger auto-allocation
 * POST /api/sales-orders/:id/confirm
 */
export async function confirmOrder(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const order = await SalesOrder.findByPk(id, {
      include: [SalesOrderLine],
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

    // Update to CONFIRMED first
    await order.update(
      {
        status: "CONFIRMED",
        confirmed_at: new Date(),
      },
      { transaction }
    );

    // AUTO-ALLOCATE INVENTORY
    const allocationResult = await allocateOrder(id, transaction);

    // Update order status based on allocation result
    if (allocationResult.fullyAllocated) {
      await order.update(
        {
          status: "ALLOCATED",
          allocation_status: "FULL",
          allocated_at: new Date(),
        },
        { transaction }
      );
    } else if (allocationResult.partiallyAllocated) {
      await order.update(
        {
          status: "PARTIAL_ALLOCATION",
          allocation_status: "PARTIAL",
        },
        { transaction }
      );
    } else {
      await order.update(
        {
          allocation_status: "FAILED",
        },
        { transaction }
      );
    }

    await transaction.commit();

    // Fetch complete order
    const confirmedOrder = await SalesOrder.findByPk(id, {
      include: [
        {
          model: SalesOrderLine,
          include: [
            SKU,
            {
              model: StockAllocation,
              where: { status: "ACTIVE" },
              required: false,
            },
          ],
        },
        Client,
        Warehouse,
      ],
    });

    res.json({
      message: "Order confirmed and allocated",
      order: confirmedOrder,
      allocation: allocationResult,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error confirming order:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Cancel sales order
 * DELETE /api/sales-orders/:id/cancel
 */
export async function cancelOrder(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const order = await SalesOrder.findByPk(id, { transaction });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    // Can only cancel before picking starts
    if (
      !["DRAFT", "CONFIRMED", "ALLOCATED", "PARTIAL_ALLOCATION"].includes(
        order.status
      )
    ) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot cancel order with status: ${order.status}`,
      });
    }

    // Release all active allocations
    const releaseResult = await releaseOrderAllocations(
      id,
      cancellation_reason || "Order cancelled",
      transaction
    );

    // Cancel all order lines
    await SalesOrderLine.update(
      {
        status: "CANCELLED",
        cancelled_at: new Date(),
        cancellation_reason,
      },
      {
        where: { order_id: id },
        transaction,
      }
    );

    // Cancel order
    await order.update(
      {
        status: "CANCELLED",
        cancelled_at: new Date(),
        cancellation_reason,
      },
      { transaction }
    );

    await transaction.commit();

    res.json({
      message: "Order cancelled successfully",
      released_allocations: releaseResult.released_count,
      released_qty: releaseResult.total_qty_released,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get order statistics
 * GET /api/sales-orders/stats?warehouse_id=1
 */
export async function getOrderStats(req, res) {
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
    console.error("Error fetching order stats:", error);
    res.status(500).json({ error: error.message });
  }
}
