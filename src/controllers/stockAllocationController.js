import { Op } from "sequelize";
import { sequelize } from "../config/database.js";
import StockAllocation from "../models/StockAllocation.js";
import SalesOrder from "../models/SaleOrder.js";
import SalesOrderLine from "../models/SalesOrderLine.js";
import SKU from "../models/SKU.js";
import Inventory from "../models/Inventory.js";
import Location from "../models/Location.js";
import Warehouse from "../models/Warehouse.js";
import {
  allocateOrder,
  releaseAllocation,
  releaseOrderAllocations,
} from "../services/allocationService.js";

// Get allocations for a specific order
// GET /api/stock-allocations/order/:orderId
const getOrderAllocations = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.query;

    const where = { order_id: orderId };
    if (status) {
      where.status = status;
    }

    const allocations = await StockAllocation.findAll({
      where,
      include: [
        {
          model: SalesOrderLine,
          as: "orderLine",
          include: [{ model: SKU, as: "sku" }],
        },
        {
          model: Inventory,
          as: "inventory",
          include: [{ model: Location, as: "location" }],
        },
        { model: Warehouse, as: "warehouse" },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json(allocations);
  } catch (error) {
    next(error);
  }
};

// Get all allocations with filters
// GET /api/stock-allocations
const getAllAllocations = async (req, res, next) => {
  try {
    const {
      warehouse_id,
      sku_id,
      status,
      order_id,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};
    if (warehouse_id) where.warehouse_id = warehouse_id;
    if (sku_id) where.sku_id = sku_id;
    if (status) where.status = status;
    if (order_id) where.order_id = order_id;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await StockAllocation.findAndCountAll({
      where,
      include: [
        {
          model: SalesOrder,
          as: "order",
          attributes: ["order_no", "customer_name", "status"],
        },
        {
          model: SalesOrderLine,
          as: "orderLine",
          include: [{ model: SKU, as: "sku" }],
        },
        {
          model: Inventory,
          as: "inventory",
          include: [{ model: Location, as: "location" }],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit)),
      allocations: rows,
    });
  } catch (error) {
    next(error);
  }
};

// Get single allocation by ID
// GET /api/stock-allocations/:id
const getAllocationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const allocation = await StockAllocation.findByPk(id, {
      include: [
        { model: SalesOrder, as: "order" },
        {
          model: SalesOrderLine,
          as: "orderLine",
          include: [{ model: SKU, as: "sku" }],
        },
        {
          model: Inventory,
          as: "inventory",
          include: [{ model: Location, as: "location" }],
        },
        { model: Warehouse, as: "warehouse" },
      ],
    });

    if (!allocation) {
      return res.status(404).json({ error: "Allocation not found" });
    }

    res.json(allocation);
  } catch (error) {
    next(error);
  }
};

// Manually allocate inventory for an order
// POST /api/stock-allocations/allocate
const manualAllocate = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { order_id } = req.body;

    const order = await SalesOrder.findByPk(order_id, { transaction });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    if (!["CONFIRMED", "PARTIAL_ALLOCATION"].includes(order.status)) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Cannot allocate order with status: ${order.status}`,
      });
    }

    const result = await allocateOrder(order_id, transaction);

    if (result.fullyAllocated) {
      await order.update(
        {
          status: "ALLOCATED",
          allocation_status: "FULL",
          allocated_at: new Date(),
        },
        { transaction },
      );
    } else if (result.partiallyAllocated) {
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

    res.json({
      message: "Order allocated successfully",
      result,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

// Release a specific allocation
// POST /api/stock-allocations/:id/release
const releaseSingleAllocation = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await releaseAllocation(
      id,
      reason || "Manual release",
      transaction,
    );

    await transaction.commit();

    res.json({
      message: "Allocation released successfully",
      ...result,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

// Release all allocations for an order
// POST /api/stock-allocations/order/:orderId/release-all
const releaseOrderAllAllocations = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const result = await releaseOrderAllocations(
      orderId,
      reason || "Manual release of all allocations",
      transaction,
    );

    await transaction.commit();

    res.json({
      message: "All order allocations released successfully",
      ...result,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

// Get allocation statistics
// GET /api/stock-allocations/stats
const getAllocationStats = async (req, res, next) => {
  try {
    const { warehouse_id, sku_id } = req.query;

    const where = {};
    if (warehouse_id) where.warehouse_id = warehouse_id;
    if (sku_id) where.sku_id = sku_id;

    const stats = await StockAllocation.findAll({
      where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [
          sequelize.fn("SUM", sequelize.col("allocated_qty")),
          "total_allocated",
        ],
        [sequelize.fn("SUM", sequelize.col("consumed_qty")), "total_consumed"],
        [
          sequelize.fn("SUM", sequelize.col("remaining_qty")),
          "total_remaining",
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
  getOrderAllocations,
  getAllAllocations,
  getAllocationById,
  manualAllocate,
  releaseSingleAllocation,
  releaseOrderAllAllocations,
  getAllocationStats,
};
