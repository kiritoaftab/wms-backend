import { SKU, Client } from "../models/index.js";
import { Op } from "sequelize";

// Get all SKUs
const getAllSKUs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const clientId = req.query.client_id;
    const search = req.query.search || "";

    // Build where clause
    const whereClause = {};
    if (clientId) whereClause.client_id = clientId;
    if (search) {
      whereClause[Op.or] = [
        { sku_code: { [Op.like]: `%${search}%` } },
        { sku_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await SKU.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "client_name", "client_code"],
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: {
        skus: rows,
        pagination: {
          total: count,
          page,
          pages: Math.ceil(count / limit),
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get SKU by ID
const getSKUById = async (req, res, next) => {
  try {
    const sku = await SKU.findByPk(req.params.id, {
      include: [
        {
          model: Client,
          as: "client",
        },
      ],
    });

    if (!sku) {
      return res.status(404).json({
        success: false,
        message: "SKU not found",
      });
    }

    res.json({
      success: true,
      data: sku,
    });
  } catch (error) {
    next(error);
  }
};

// Create SKU
const createSKU = async (req, res, next) => {
  try {
    const {
      client_id,
      sku_code,
      sku_name,
      description,
      category,
      uom,
      dimensions_length,
      dimensions_width,
      dimensions_height,
      weight,
      requires_serial_tracking,
      requires_batch_tracking,
      requires_expiry_tracking,
      fragile,
      hazardous,
      pick_rule,
      putaway_zone,
      unit_price,
      currency,
    } = req.body;

    // Verify client exists
    const client = await Client.findByPk(client_id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const sku = await SKU.create({
      client_id,
      sku_code,
      sku_name,
      description,
      category,
      uom,
      dimensions_length,
      dimensions_width,
      dimensions_height,
      weight,
      requires_serial_tracking,
      requires_batch_tracking,
      requires_expiry_tracking,
      fragile,
      hazardous,
      pick_rule,
      putaway_zone,
      unit_price,
      currency,
    });

    res.status(201).json({
      success: true,
      message: "SKU created successfully",
      data: sku,
    });
  } catch (error) {
    next(error);
  }
};

// Update SKU
const updateSKU = async (req, res, next) => {
  try {
    const sku = await SKU.findByPk(req.params.id);

    if (!sku) {
      return res.status(404).json({
        success: false,
        message: "SKU not found",
      });
    }

    const {
      sku_code,
      sku_name,
      description,
      category,
      uom,
      dimensions_length,
      dimensions_width,
      dimensions_height,
      weight,
      requires_serial_tracking,
      requires_batch_tracking,
      requires_expiry_tracking,
      fragile,
      hazardous,
      pick_rule,
      putaway_zone,
      unit_price,
      currency,
      is_active,
    } = req.body;

    await sku.update({
      sku_code,
      sku_name,
      description,
      category,
      uom,
      dimensions_length,
      dimensions_width,
      dimensions_height,
      weight,
      requires_serial_tracking,
      requires_batch_tracking,
      requires_expiry_tracking,
      fragile,
      hazardous,
      pick_rule,
      putaway_zone,
      unit_price,
      currency,
      is_active,
    });

    res.json({
      success: true,
      message: "SKU updated successfully",
      data: sku,
    });
  } catch (error) {
    next(error);
  }
};

// Delete SKU (soft delete)
const deleteSKU = async (req, res, next) => {
  try {
    const sku = await SKU.findByPk(req.params.id);

    if (!sku) {
      return res.status(404).json({
        success: false,
        message: "SKU not found",
      });
    }

    await sku.update({ is_active: false });

    res.json({
      success: true,
      message: "SKU deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export { getAllSKUs, getSKUById, createSKU, updateSKU, deleteSKU };
