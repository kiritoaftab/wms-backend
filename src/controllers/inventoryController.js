import {
  Inventory,
  InventoryTransaction,
  SKU,
  Location,
  Warehouse,
  Client,
} from "../models/index.js";
import { Op } from "sequelize";
import { sequelize } from "../models/index.js";

// Generate unique transaction ID
const generateTransactionID = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `TXN-${timestamp}-${random}`;
};

// Get all inventory with filters and pagination
export const getAllInventory = async (req, res, next) => {
  try {
    const {
      warehouse_id,
      client_id,
      sku_id,
      location_id,
      status,
      search,
      has_stock,
      low_stock_only,
      expiry_risk_only,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};

    if (warehouse_id) where.warehouse_id = warehouse_id;
    if (client_id) where.client_id = client_id;
    if (sku_id) where.sku_id = sku_id;
    if (location_id) where.location_id = location_id;
    if (status) where.status = status;

    // Filter by available stock
    if (has_stock === "true") {
      where.available_qty = { [Op.gt]: 0 };
    }

    // Low stock filter (available_qty < 10)
    if (low_stock_only === "true") {
      where.available_qty = { [Op.lt]: 10, [Op.gt]: 0 };
    }

    // Expiry risk filter (expiring in next 30 days)
    if (expiry_risk_only === "true") {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      where.expiry_date = {
        [Op.lte]: thirtyDaysFromNow,
        [Op.gte]: new Date(),
      };
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Inventory.findAndCountAll({
      where,
      include: [
        {
          model: SKU,
          attributes: ["id", "sku_code", "sku_name", "category", "uom"],
          as: "sku",
          ...(search && {
            where: {
              [Op.or]: [
                { sku_code: { [Op.like]: `%${search}%` } },
                { sku_name: { [Op.like]: `%${search}%` } },
              ],
            },
          }),
        },
        {
          model: Location,
          attributes: ["id", "location_code", "zone", "location_type"],
          as: "location",
        },
        {
          model: Warehouse,
          attributes: ["id", "warehouse_name", "warehouse_code"],
          as: "warehouse",
        },
        {
          model: Client,
          attributes: ["id", "client_name", "client_code"],
          as: "client",
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get inventory by SKU
export const getInventoryBySKU = async (req, res, next) => {
  try {
    const { sku_id } = req.params;
    const { warehouse_id } = req.query;

    const where = { sku_id };
    if (warehouse_id) where.warehouse_id = warehouse_id;

    const inventory = await Inventory.findAll({
      where,
      include: [
        {
          model: SKU,
          attributes: [
            "id",
            "sku_code",
            "sku_name",
            "category",
            "uom",
            "unit_price",
          ],
          as: "sku",
        },
        {
          model: Location,
          attributes: ["id", "location_code", "zone", "aisle", "rack", "level"],
          as: "location",
        },
        {
          model: Warehouse,
          attributes: ["id", "warehouse_name", "warehouse_code"],
          as: "warehouse",
        },
      ],
      order: [["location_id", "ASC"]],
    });

    // Calculate totals
    const totals = inventory.reduce(
      (acc, inv) => ({
        total_on_hand: acc.total_on_hand + parseFloat(inv.on_hand_qty || 0),
        total_available:
          acc.total_available + parseFloat(inv.available_qty || 0),
        total_hold: acc.total_hold + parseFloat(inv.hold_qty || 0),
        total_allocated:
          acc.total_allocated + parseFloat(inv.allocated_qty || 0),
        total_damaged: acc.total_damaged + parseFloat(inv.damaged_qty || 0),
        locations: acc.locations + 1,
      }),
      {
        total_on_hand: 0,
        total_available: 0,
        total_hold: 0,
        total_allocated: 0,
        total_damaged: 0,
        locations: 0,
      },
    );

    res.json({
      success: true,
      data: {
        inventory,
        summary: totals,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get inventory by Location
export const getInventoryByLocation = async (req, res, next) => {
  try {
    const { location_id } = req.params;

    const inventory = await Inventory.findAll({
      where: { location_id },
      include: [
        {
          model: SKU,
          attributes: ["id", "sku_code", "sku_name", "category", "uom"],
          as: "sku",
        },
        {
          model: Location,
          attributes: [
            "id",
            "location_code",
            "zone",
            "capacity",
            "current_usage",
          ],
          as: "location",
        },
        {
          model: Client,
          attributes: ["id", "client_name", "client_code"],
          as: "client",
        },
      ],
      order: [["sku_id", "ASC"]],
    });

    // Calculate location utilization
    const location = await Location.findByPk(location_id);
    const utilization = location
      ? ((location.current_usage / location.capacity) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        inventory,
        location_info: {
          utilization: `${utilization}%`,
          capacity: location?.capacity,
          current_usage: location?.current_usage,
          available_capacity: location
            ? location.capacity - location.current_usage
            : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get inventory summary/dashboard
export const getInventorySummary = async (req, res, next) => {
  try {
    const { warehouse_id, client_id } = req.query;

    const where = {};
    if (warehouse_id) where.warehouse_id = warehouse_id;
    if (client_id) where.client_id = client_id;

    // Get overall totals
    const totals = await Inventory.findAll({
      where,
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total_records"],
        [sequelize.fn("SUM", sequelize.col("on_hand_qty")), "total_on_hand"],
        [
          sequelize.fn("SUM", sequelize.col("available_qty")),
          "total_available",
        ],
        [sequelize.fn("SUM", sequelize.col("hold_qty")), "total_hold"],
        [
          sequelize.fn("SUM", sequelize.col("allocated_qty")),
          "total_allocated",
        ],
        [sequelize.fn("SUM", sequelize.col("damaged_qty")), "total_damaged"],
      ],
      raw: true,
    });

    // Get status breakdown
    const statusBreakdown = await Inventory.findAll({
      where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("on_hand_qty")), "qty"],
      ],
      group: ["status"],
      raw: true,
    });

    // Get items expiring in next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringItems = await Inventory.count({
      where: {
        ...where,
        expiry_date: {
          [Op.lte]: thirtyDaysFromNow,
          [Op.gte]: new Date(),
        },
        available_qty: { [Op.gt]: 0 },
      },
    });

    // Get low stock items (available_qty < 10)
    const lowStockItems = await Inventory.count({
      where: {
        ...where,
        available_qty: { [Op.lt]: 10, [Op.gt]: 0 },
      },
    });

    // Get unique SKU count
    const uniqueSKUs = await Inventory.count({
      where,
      distinct: true,
      col: "sku_id",
    });

    res.json({
      success: true,
      data: {
        totals: totals[0],
        status_breakdown: statusBreakdown,
        alerts: {
          expiring_soon: expiringItems,
          low_stock: lowStockItems,
        },
        metrics: {
          unique_skus: uniqueSKUs,
          total_locations: await Inventory.count({
            where,
            distinct: true,
            col: "location_id",
          }),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Stock Adjustment
export const adjustStock = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const {
      warehouse_id,
      sku_id,
      location_id,
      batch_no,
      adjustment_type, // 'ADD', 'SUBTRACT', 'SET'
      qty,
      reason,
      notes,
      client_id,
      serial_no,
      expiry_date,
    } = req.body;

    // Validate required fields
    if (
      !warehouse_id ||
      !sku_id ||
      !location_id ||
      !adjustment_type ||
      !client_id ||
      qty === undefined
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Find or create inventory record
    let inventory = await Inventory.findOne({
      where: {
        warehouse_id,
        sku_id,
        location_id,
        // batch_no: batch_no || null,
      },
      transaction: t,
    });

    let oldQty = 0;
    let newQty = 0;

    if (!inventory) {
      // Create new inventory record for ADD
      if (adjustment_type === "ADD" || adjustment_type === "SET") {
        inventory = await Inventory.create(
          {
            warehouse_id,
            sku_id,
            location_id,
            batch_no: batch_no || null,
            client_id: client_id,
            serial_no: serial_no || null,
            expiry_date: expiry_date || null,
            on_hand_qty: qty,
            available_qty: qty,
            hold_qty: 0,
            allocated_qty: 0,
            damaged_qty: 0,
            status: "HEALTHY",
          },
          { transaction: t },
        );
        newQty = qty;
      } else {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: "Inventory record not found for adjustment",
        });
      }
    } else {
      oldQty = parseFloat(inventory.on_hand_qty);

      // Calculate new quantity based on adjustment type
      switch (adjustment_type) {
        case "ADD":
          newQty = oldQty + parseFloat(qty);
          break;
        case "SUBTRACT":
          newQty = oldQty - parseFloat(qty);
          if (newQty < 0) {
            await t.rollback();
            return res.status(400).json({
              success: false,
              message: "Adjustment would result in negative inventory",
            });
          }
          break;
        case "SET":
          newQty = parseFloat(qty);
          break;
        default:
          await t.rollback();
          return res.status(400).json({
            success: false,
            message: "Invalid adjustment type",
          });
      }

      // Update inventory
      await inventory.update(
        {
          on_hand_qty: newQty,
          available_qty:
            newQty -
            parseFloat(inventory.hold_qty) -
            parseFloat(inventory.allocated_qty),
          status:
            newQty === 0
              ? "OUT_OF_STOCK"
              : newQty < 10
                ? "LOW_STOCK"
                : "HEALTHY",
        },
        { transaction: t },
      );
    }

    // Create transaction record
    const transaction_id = generateTransactionID();
    await InventoryTransaction.create(
      {
        transaction_id,
        warehouse_id,
        sku_id,
        transaction_type: "ADJUSTMENT",
        to_location_id: location_id,
        qty:
          adjustment_type === "SUBTRACT" ? -parseFloat(qty) : parseFloat(qty),
        batch_no: batch_no || null,
        reference_type: "STOCK_ADJUSTMENT",
        reference_id: reason || "MANUAL_ADJUSTMENT",
        notes: notes || `${adjustment_type} adjustment: ${oldQty} → ${newQty}`,
        performed_by: req.user.id,
      },
      { transaction: t },
    );

    await t.commit();

    res.json({
      success: true,
      message: "Stock adjusted successfully",
      data: {
        inventory,
        adjustment: {
          old_qty: oldQty,
          new_qty: newQty,
          difference: newQty - oldQty,
          transaction_id,
        },
      },
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// Stock Transfer (Move between locations)
export const transferStock = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const {
      warehouse_id,
      sku_id,
      from_location_id,
      to_location_id,
      batch_no,
      qty,
      reason,
      notes,
    } = req.body;

    // Validate
    if (
      !warehouse_id ||
      !sku_id ||
      !from_location_id ||
      !to_location_id ||
      !qty
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (from_location_id === to_location_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Source and destination locations must be different",
      });
    }

    // Find source inventory
    const sourceInventory = await Inventory.findOne({
      where: {
        warehouse_id,
        sku_id,
        location_id: from_location_id,
        // batch_no: batch_no || null,
      },
      transaction: t,
    });

    if (!sourceInventory) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Source inventory not found",
      });
    }

    if (parseFloat(sourceInventory.available_qty) < parseFloat(qty)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Insufficient available quantity",
      });
    }

    // Reduce from source
    const newSourceQty =
      parseFloat(sourceInventory.on_hand_qty) - parseFloat(qty);
    if (newSourceQty === 0) {
      // Delete the inventory record when quantity reaches 0
      await sourceInventory.destroy({ transaction: t });
    } else {
      // Update with new quantity
      await sourceInventory.update(
        {
          on_hand_qty: newSourceQty,
          available_qty:
            newSourceQty -
            parseFloat(sourceInventory.hold_qty) -
            parseFloat(sourceInventory.allocated_qty),
          status: newSourceQty < 10 ? "LOW_STOCK" : "HEALTHY",
        },
        { transaction: t },
      );
    }

    // Find or create destination inventory
    let destInventory = await Inventory.findOne({
      where: {
        warehouse_id,
        sku_id,
        location_id: to_location_id,
        // batch_no: batch_no || null,
      },
      transaction: t,
    });

    if (!destInventory) {
      destInventory = await Inventory.create(
        {
          warehouse_id,
          sku_id,
          location_id: to_location_id,
          batch_no: batch_no || null,
          client_id: sourceInventory.client_id,
          serial_no: sourceInventory.serial_no,
          expiry_date: sourceInventory.expiry_date,
          on_hand_qty: qty,
          available_qty: qty,
          hold_qty: 0,
          allocated_qty: 0,
          damaged_qty: 0,
          status: "HEALTHY",
        },
        { transaction: t },
      );
    } else {
      const newDestQty =
        parseFloat(destInventory.on_hand_qty) + parseFloat(qty);
      await destInventory.update(
        {
          on_hand_qty: newDestQty,
          available_qty:
            newDestQty -
            parseFloat(destInventory.hold_qty) -
            parseFloat(destInventory.allocated_qty),
          status: "HEALTHY",
        },
        { transaction: t },
      );
    }

    // Update location usage
    const fromLocation = await Location.findByPk(from_location_id, {
      transaction: t,
    });
    const toLocation = await Location.findByPk(to_location_id, {
      transaction: t,
    });

    if (fromLocation) {
      await fromLocation.update(
        {
          current_usage: Math.max(
            0,
            parseFloat(fromLocation.current_usage) - parseFloat(qty),
          ),
        },
        { transaction: t },
      );
    }

    if (toLocation) {
      await toLocation.update(
        {
          current_usage: parseFloat(toLocation.current_usage) + parseFloat(qty),
        },
        { transaction: t },
      );
    }

    // Create transaction record
    const transaction_id = generateTransactionID();
    await InventoryTransaction.create(
      {
        transaction_id,
        warehouse_id,
        sku_id,
        transaction_type: "MOVE",
        from_location_id,
        to_location_id,
        qty: parseFloat(qty),
        batch_no: batch_no || null,
        reference_type: "STOCK_TRANSFER",
        reference_id: reason || "MANUAL_TRANSFER",
        notes:
          notes ||
          `Transfer from ${fromLocation?.location_code} to ${toLocation?.location_code}`,
        performed_by: req.user.id,
      },
      { transaction: t },
    );

    await t.commit();

    res.json({
      success: true,
      message: "Stock transferred successfully",
      data: {
        transaction_id,
        from: {
          location_code: fromLocation?.location_code,
          new_qty: newSourceQty,
        },
        to: {
          location_code: toLocation?.location_code,
          new_qty: parseFloat(destInventory.on_hand_qty),
        },
      },
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

export const groupInventoryBySKU = async (req, res, next) => {
  try {
    const { warehouse_id, client_id } = req.query;

    const where = {};
    if (warehouse_id) where.warehouse_id = warehouse_id;
    if (client_id) where.client_id = client_id;

    const inventory = await Inventory.findAll({
      where,
      attributes: [
        "sku_id",
        [sequelize.fn("SUM", sequelize.col("on_hand_qty")), "total_on_hand"],
        [
          sequelize.fn("SUM", sequelize.col("available_qty")),
          "total_available",
        ],
        [sequelize.fn("SUM", sequelize.col("hold_qty")), "total_hold"],
        [
          sequelize.fn("SUM", sequelize.col("allocated_qty")),
          "total_allocated",
        ],
        [sequelize.fn("SUM", sequelize.col("damaged_qty")), "total_damaged"],
      ],
      include: [
        {
          model: SKU,
          attributes: ["id", "sku_code", "sku_name", "category", "uom"],
          as: "sku",
        },
      ],
      group: ["sku_id"],
    });

    res.json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    next(error);
  }
};

export const groupInventoryByZone = async (req, res, next) => {
  try {
    const { warehouse_id } = req.query;

    const inventory = await Inventory.findAll({
      where: { warehouse_id },

      attributes: [
        [sequelize.col("location.zone"), "zone"],
        [sequelize.fn("SUM", sequelize.col("on_hand_qty")), "total_on_hand"],
        [
          sequelize.fn("SUM", sequelize.col("available_qty")),
          "total_available",
        ],
        [sequelize.fn("SUM", sequelize.col("hold_qty")), "total_hold"],
        [
          sequelize.fn("SUM", sequelize.col("allocated_qty")),
          "total_allocated",
        ],
        [sequelize.fn("SUM", sequelize.col("damaged_qty")), "total_damaged"],
      ],

      include: [
        {
          model: Location,
          as: "location",
          attributes: [], // ✅ VERY IMPORTANT
        },
      ],

      group: ["location.zone"],
      raw: true, // optional but cleaner for aggregates
    });

    res.json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    next(error);
  }
};

// Get inventory transaction history
export const getInventoryTransactions = async (req, res, next) => {
  try {
    const {
      warehouse_id,
      sku_id,
      location_id,
      transaction_type,
      start_date,
      end_date,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};

    if (warehouse_id) where.warehouse_id = warehouse_id;
    if (sku_id) where.sku_id = sku_id;
    if (transaction_type) where.transaction_type = transaction_type;

    // Date range filter
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at[Op.gte] = new Date(start_date);
      if (end_date) where.created_at[Op.lte] = new Date(end_date);
    }

    // Location filter (either from or to)
    if (location_id) {
      where[Op.or] = [
        { from_location_id: location_id },
        { to_location_id: location_id },
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await InventoryTransaction.findAndCountAll({
      where,
      include: [
        {
          model: SKU,
          attributes: ["id", "sku_code", "sku_name"],
          as: "sku",
          required: false,
        },
        {
          model: Location,
          as: "from_location",
          attributes: ["id", "location_code", "zone"],
          required: false,
        },
        {
          model: Location,
          as: "to_location",
          attributes: ["id", "location_code", "zone"],
          required: false,
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single inventory record
export const getInventoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const inventory = await Inventory.findByPk(id, {
      include: [
        {
          model: SKU,
          attributes: [
            "id",
            "sku_code",
            "sku_name",
            "category",
            "uom",
            "unit_price",
          ],
          as: "sku",
        },
        {
          model: Location,
          attributes: ["id", "location_code", "zone", "aisle", "rack", "level"],
          as: "location",
        },
        {
          model: Warehouse,
          attributes: ["id", "warehouse_name", "warehouse_code"],
          as: "warehouse",
        },
        {
          model: Client,
          attributes: ["id", "client_name", "client_code"],
          as: "client",
        },
      ],
    });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory record not found",
      });
    }

    res.json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAllInventory,
  getInventoryById,
  getInventoryBySKU,
  getInventoryByLocation,
  getInventorySummary,
  adjustStock,
  transferStock,
  getInventoryTransactions,
};
