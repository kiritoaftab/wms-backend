import {
  InventoryHold,
  Inventory,
  SKU,
  Location,
  Warehouse,
} from "../models/index.js";
import { Op } from "sequelize";
import { sequelize } from "../config/database.js";

// Generate unique hold ID
const generateHoldID = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `HOLD-${timestamp}-${random}`;
};

// Create inventory hold (quarantine)
export const createHold = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { inventory_id, qty, hold_reason, hold_notes } = req.body;

    // Validate
    if (!inventory_id || !qty || !hold_reason) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required fields: inventory_id, qty, hold_reason",
      });
    }

    // Get inventory record
    const inventory = await Inventory.findByPk(inventory_id, {
      transaction: t,
    });

    if (!inventory) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Inventory record not found",
      });
    }

    // Validate quantity
    if (parseFloat(qty) > parseFloat(inventory.available_qty)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot hold ${qty} units. Only ${inventory.available_qty} available.`,
      });
    }

    // Create hold record
    const hold_id = generateHoldID();
    const hold = await InventoryHold.create(
      {
        hold_id,
        inventory_id,
        qty: parseFloat(qty),
        hold_reason,
        hold_notes: hold_notes || null,
        status: "ACTIVE",
        created_by: req.user.id,
      },
      { transaction: t },
    );

    // Update inventory quantities
    const newHoldQty = parseFloat(inventory.hold_qty) + parseFloat(qty);
    const newAvailableQty =
      parseFloat(inventory.available_qty) - parseFloat(qty);

    await inventory.update(
      {
        hold_qty: newHoldQty,
        available_qty: newAvailableQty,
        status:
          hold_reason === "DAMAGED"
            ? "DAMAGED"
            : hold_reason === "QUALITY_CHECK"
              ? "QC_HOLD"
              : hold_reason === "EXPIRY_RISK"
                ? "EXPIRY_RISK"
                : inventory.status,
      },
      { transaction: t },
    );

    await t.commit();

    // Fetch complete hold data
    const createdHold = await InventoryHold.findByPk(hold.id, {
      include: [
        {
          model: Inventory,
          include: [
            {
              model: SKU,
              attributes: ["id", "sku_code", "sku_name"],
              as: "sku",
            },
            {
              model: Location,
              attributes: ["id", "location_code", "zone"],
              as: "location",
            },
          ],
          as: "inventory",
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Inventory hold created successfully",
      data: createdHold,
    });
  } catch (error) {
    console.log(error);
    await t.rollback();
    next(error);
  }
};

// Release inventory hold
export const releaseHold = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { release_notes } = req.body;

    // Get hold record
    const hold = await InventoryHold.findByPk(id, {
      include: [{ model: Inventory, as: "inventory" }],
      transaction: t,
    });

    if (!hold) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Hold record not found",
      });
    }

    if (hold.status !== "ACTIVE") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Hold is not active",
      });
    }

    // Update hold status
    await hold.update(
      {
        status: "RELEASED",
        released_by: req.user.id,
        released_at: new Date(),
        release_notes: release_notes || null,
      },
      { transaction: t },
    );

    // Update inventory quantities
    const inventory = hold.inventory;
    const newHoldQty = parseFloat(inventory.hold_qty) - parseFloat(hold.qty);
    const newAvailableQty =
      parseFloat(inventory.available_qty) + parseFloat(hold.qty);

    await inventory.update(
      {
        hold_qty: Math.max(0, newHoldQty),
        available_qty: newAvailableQty,
        status:
          newHoldQty === 0 && parseFloat(inventory.available_qty) > 0
            ? "HEALTHY"
            : inventory.status,
      },
      { transaction: t },
    );

    await t.commit();

    res.json({
      success: true,
      message: "Hold released successfully",
      data: hold,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// Get all holds with filters
export const getAllHolds = async (req, res, next) => {
  try {
    const {
      warehouse_id,
      status,
      hold_reason,
      inventory_id,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (hold_reason) where.hold_reason = hold_reason;
    if (inventory_id) where.inventory_id = inventory_id;

    const inventoryWhere = {};
    if (warehouse_id) inventoryWhere.warehouse_id = warehouse_id;

    const offset = (page - 1) * limit;

    const { count, rows } = await InventoryHold.findAndCountAll({
      where,
      include: [
        {
          model: Inventory,
          where: inventoryWhere,
          include: [
            {
              model: SKU,
              attributes: ["id", "sku_code", "sku_name", "category"],
              as: "sku",
            },
            {
              model: Location,
              attributes: ["id", "location_code", "zone"],
              as: "location",
            },
            {
              model: Warehouse,
              attributes: ["id", "warehouse_name", "warehouse_code"],
              as: "warehouse",
            },
          ],
          as: "inventory",
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

// Get hold by ID
export const getHoldById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const hold = await InventoryHold.findByPk(id, {
      include: [
        {
          model: Inventory,
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
                "aisle",
                "rack",
                "level",
              ],
              as: "location",
            },
            {
              model: Warehouse,
              attributes: ["id", "warehouse_name", "warehouse_code"],
              as: "warehouse",
            },
          ],
          as: "inventory",
        },
      ],
    });

    if (!hold) {
      return res.status(404).json({
        success: false,
        message: "Hold record not found",
      });
    }

    res.json({
      success: true,
      data: hold,
    });
  } catch (error) {
    next(error);
  }
};

// Get hold statistics
export const getHoldStats = async (req, res, next) => {
  try {
    const { warehouse_id } = req.query;

    const inventoryWhere = {};
    if (warehouse_id) inventoryWhere.warehouse_id = warehouse_id;

    // Total active holds
    const activeHolds = await InventoryHold.count({
      where: { status: "ACTIVE" },
      include: [
        {
          model: Inventory,
          where: inventoryWhere,
          attributes: [],
          as: "inventory",
        },
      ],
    });

    // Holds by reason
    const holdsByReason = await InventoryHold.findAll({
      where: { status: "ACTIVE" },
      attributes: [
        "hold_reason",
        [sequelize.fn("COUNT", sequelize.col("inventory_holds.id")), "count"],
        [
          sequelize.fn("SUM", sequelize.col("inventory_holds.qty")),
          "total_qty",
        ],
      ],
      include: [
        {
          model: Inventory,
          where: inventoryWhere,
          attributes: [],
          as: "inventory",
        },
      ],
      group: ["hold_reason"],
      raw: true,
    });

    // Total quantity on hold
    const totalQtyOnHold = await InventoryHold.sum("qty", {
      where: { status: "ACTIVE" },
      include: [
        {
          model: Inventory,
          where: inventoryWhere,
          attributes: [],
          as: "inventory",
        },
      ],
    });

    // Recent releases (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentReleases = await InventoryHold.count({
      where: {
        status: "RELEASED",
        released_at: { [Op.gte]: sevenDaysAgo },
      },
      include: [
        {
          model: Inventory,
          where: inventoryWhere,
          attributes: [],
          as: "inventory",
        },
      ],
    });

    res.json({
      success: true,
      data: {
        active_holds: activeHolds || 0,
        total_qty_on_hold: totalQtyOnHold || 0,
        holds_by_reason: holdsByReason,
        recent_releases: recentReleases || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update hold (modify qty or notes)
export const updateHold = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { qty, hold_notes, hold_reason } = req.body;

    const hold = await InventoryHold.findByPk(id, {
      include: [{ model: Inventory }],
      transaction: t,
    });

    if (!hold) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Hold record not found",
      });
    }

    if (hold.status !== "ACTIVE") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Can only update active holds",
      });
    }

    const oldQty = parseFloat(hold.qty);
    const inventory = hold.Inventory;

    // If quantity is being changed
    if (qty !== undefined && parseFloat(qty) !== oldQty) {
      const newQty = parseFloat(qty);
      const qtyDiff = newQty - oldQty;

      // Check if we have enough available to increase hold
      if (qtyDiff > 0 && parseFloat(inventory.available_qty) < qtyDiff) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot increase hold by ${qtyDiff}. Only ${inventory.available_qty} available.`,
        });
      }

      // Update inventory
      await inventory.update(
        {
          hold_qty: parseFloat(inventory.hold_qty) + qtyDiff,
          available_qty: parseFloat(inventory.available_qty) - qtyDiff,
        },
        { transaction: t },
      );
    }

    // Update hold record
    const updates = {};
    if (qty !== undefined) updates.qty = parseFloat(qty);
    if (hold_notes !== undefined) updates.hold_notes = hold_notes;
    if (hold_reason !== undefined) updates.hold_reason = hold_reason;

    await hold.update(updates, { transaction: t });

    await t.commit();

    const updatedHold = await InventoryHold.findByPk(id, {
      include: [
        {
          model: Inventory,
          include: [
            { model: SKU, attributes: ["id", "sku_code", "sku_name"] },
            { model: Location, attributes: ["id", "location_code", "zone"] },
          ],
        },
      ],
    });

    res.json({
      success: true,
      message: "Hold updated successfully",
      data: updatedHold,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// Delete hold (only if not active)
export const deleteHold = async (req, res, next) => {
  try {
    const { id } = req.params;

    const hold = await InventoryHold.findByPk(id);

    if (!hold) {
      return res.status(404).json({
        success: false,
        message: "Hold record not found",
      });
    }

    if (hold.status === "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete active hold. Please release it first.",
      });
    }

    await hold.destroy();

    res.json({
      success: true,
      message: "Hold deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createHold,
  releaseHold,
  getAllHolds,
  getHoldById,
  getHoldStats,
  updateHold,
  deleteHold,
};
