import {
  ASN,
  ASNLine,
  Warehouse,
  Client,
  Supplier,
  Dock,
  SKU,
  User,
} from "../models/index.js";
import { Op } from "sequelize";
import { sequelize } from "../config/database.js";

// Generate ASN Number
const generateASNNumber = async () => {
  const lastASN = await ASN.findOne({
    order: [["id", "DESC"]],
  });

  const nextNumber = lastASN ? lastASN.id + 1 : 1;
  return `ASN-${String(nextNumber).padStart(5, "0")}`;
};

// Get all ASNs with filters and pagination
const getAllASNs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { warehouse_id, client_id, status, search } = req.query;

    // Build where clause
    const whereClause = {};
    if (warehouse_id) whereClause.warehouse_id = warehouse_id;
    if (client_id) whereClause.client_id = client_id;
    if (status) whereClause.status = status;
    if (search) {
      whereClause[Op.or] = [
        { asn_no: { [Op.like]: `%${search}%` } },
        { reference_no: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ASN.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Warehouse,
          as: "warehouse",
          attributes: ["id", "warehouse_name", "warehouse_code"],
        },
        {
          model: Client,
          as: "client",
          attributes: ["id", "client_name", "client_code"],
        },
        {
          model: Supplier,
          as: "supplier",
          attributes: ["id", "supplier_name", "supplier_code"],
        },
        {
          model: Dock,
          as: "dock",
          attributes: ["id", "dock_name", "dock_code"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "email"],
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: {
        asns: rows,
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

// Get ASN by ID with full details
const getASNById = async (req, res, next) => {
  try {
    const asn = await ASN.findByPk(req.params.id, {
      include: [
        {
          model: Warehouse,
          as: "warehouse",
        },
        {
          model: Client,
          as: "client",
        },
        {
          model: Supplier,
          as: "supplier",
        },
        {
          model: Dock,
          as: "dock",
        },
        {
          model: ASNLine,
          as: "lines",
          include: [
            {
              model: SKU,
              as: "sku",
              attributes: ["id", "sku_code", "sku_name", "uom"],
            },
          ],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "email"],
        },
      ],
    });

    if (!asn) {
      return res.status(404).json({
        success: false,
        message: "ASN not found",
      });
    }

    res.json({
      success: true,
      data: asn,
    });
  } catch (error) {
    next(error);
  }
};

// Create ASN (Draft)
const createASN = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const {
      warehouse_id,
      client_id,
      supplier_id,
      dock_id,
      reference_no,
      eta,
      transporter_name,
      vehicle_no,
      driver_name,
      driver_phone,
      special_handling,
      notes,
      lines, // Array of line items
    } = req.body;

    // Generate ASN number
    const asn_no = await generateASNNumber();

    // Calculate totals
    const total_lines = lines ? lines.length : 0;
    const total_expected_units = lines
      ? lines.reduce((sum, line) => sum + line.expected_qty, 0)
      : 0;

    // Create ASN
    const asn = await ASN.create(
      {
        asn_no,
        warehouse_id,
        client_id,
        supplier_id,
        dock_id,
        reference_no,
        eta,
        transporter_name,
        vehicle_no,
        driver_name,
        driver_phone,
        special_handling,
        notes,
        total_lines,
        total_expected_units,
        status: "DRAFT",
        created_by: req.user.id,
      },
      { transaction: t },
    );

    // Create ASN Lines if provided
    if (lines && lines.length > 0) {
      const asnLines = lines.map((line) => ({
        asn_id: asn.id,
        sku_id: line.sku_id,
        expected_qty: line.expected_qty,
        uom: line.uom || "EA",
        remarks: line.remarks,
      }));

      await ASNLine.bulkCreate(asnLines, { transaction: t });
    }

    await t.commit();

    // Fetch created ASN with details
    const createdASN = await ASN.findByPk(asn.id, {
      include: [
        { model: Warehouse, as: "warehouse" },
        { model: Client, as: "client" },
        { model: Supplier, as: "supplier" },
        { model: Dock, as: "dock" },
        { model: ASNLine, as: "lines", include: [{ model: SKU, as: "sku" }] },
      ],
    });

    res.status(201).json({
      success: true,
      message: "ASN created successfully",
      data: createdASN,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// Update ASN
const updateASN = async (req, res, next) => {
  try {
    const asn = await ASN.findByPk(req.params.id);

    if (!asn) {
      return res.status(404).json({
        success: false,
        message: "ASN not found",
      });
    }

    // Can't update if already in receiving or beyond
    if (
      ["IN_RECEIVING", "GRN_POSTED", "PUTAWAY_PENDING", "CLOSED"].includes(
        asn.status,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot update ASN with status ${asn.status}`,
      });
    }

    const {
      warehouse_id,
      client_id,
      supplier_id,
      dock_id,
      reference_no,
      eta,
      transporter_name,
      vehicle_no,
      driver_name,
      driver_phone,
      special_handling,
      notes,
    } = req.body;

    await asn.update({
      warehouse_id,
      client_id,
      supplier_id,
      dock_id,
      reference_no,
      eta,
      transporter_name,
      vehicle_no,
      driver_name,
      driver_phone,
      special_handling,
      notes,
      updated_by: req.user.id,
    });

    res.json({
      success: true,
      message: "ASN updated successfully",
      data: asn,
    });
  } catch (error) {
    next(error);
  }
};

// Confirm ASN (Change status from DRAFT to CONFIRMED)
const confirmASN = async (req, res, next) => {
  try {
    const asn = await ASN.findByPk(req.params.id);

    if (!asn) {
      return res.status(404).json({
        success: false,
        message: "ASN not found",
      });
    }

    if (asn.status !== "DRAFT" && asn.status !== "CREATED") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm ASN with status ${asn.status}`,
      });
    }

    await asn.update({
      status: "CONFIRMED",
      confirmed_at: new Date(),
      updated_by: req.user.id,
    });

    res.json({
      success: true,
      message: "ASN confirmed successfully",
      data: asn,
    });
  } catch (error) {
    next(error);
  }
};

// Start Receiving (Change status to IN_RECEIVING)
const startReceiving = async (req, res, next) => {
  try {
    const asn = await ASN.findByPk(req.params.id);

    if (!asn) {
      return res.status(404).json({
        success: false,
        message: "ASN not found",
      });
    }

    if (asn.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: `Cannot start receiving for ASN with status ${asn.status}`,
      });
    }

    await asn.update({
      status: "IN_RECEIVING",
      receiving_started_at: new Date(),
      updated_by: req.user.id,
    });

    res.json({
      success: true,
      message: "Receiving started successfully",
      data: asn,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel ASN
const cancelASN = async (req, res, next) => {
  try {
    const asn = await ASN.findByPk(req.params.id);

    if (!asn) {
      return res.status(404).json({
        success: false,
        message: "ASN not found",
      });
    }

    if (["GRN_POSTED", "PUTAWAY_PENDING", "CLOSED"].includes(asn.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel ASN with status ${asn.status}`,
      });
    }

    await asn.destroy();

    res.json({
      success: true,
      message: "ASN cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get ASN statistics
const getASNStats = async (req, res, next) => {
  try {
    const { warehouse_id } = req.query;
    const whereClause = warehouse_id ? { warehouse_id } : {};

    const stats = await ASN.findAll({
      where: whereClause,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    const formattedStats = stats.reduce((acc, stat) => {
      acc[stat.status] = parseInt(stat.get("count"));
      return acc;
    }, {});

    res.json({
      success: true,
      data: formattedStats,
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllASNs,
  getASNById,
  createASN,
  updateASN,
  confirmASN,
  startReceiving,
  cancelASN,
  getASNStats,
};
