import {
  GRN,
  GRNLine,
  ASN,
  ASNLine,
  ASNLinePallet,
  Warehouse,
  Pallet,
  SKU,
  User,
} from "../models/index.js";
import { sequelize } from "../config/database.js";
import { Op } from "sequelize";

const generatePTTaskID = async () => {
  const lastTask = await GRNLine.findOne({
    order: [["id", "DESC"]],
  });

  const nextNumber = lastTask ? lastTask.id + 1 : 1;
  return `PT-${String(nextNumber).padStart(5, "0")}`;
};

// Generate GRN Number
const generateGRNNumber = async (asnNo) => {
  const lastGRN = await GRN.findOne({
    order: [["id", "DESC"]],
  });

  const nextNumber = lastGRN ? lastGRN.id + 1 : 1;
  return `GRN-${asnNo}-${String(nextNumber).padStart(3, "0")}`;
};

// Get all GRNs
const getAllGRNs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { warehouse_id, status } = req.query;

    const whereClause = {};
    if (warehouse_id) whereClause.warehouse_id = warehouse_id;
    if (status) whereClause.status = status;

    const { count, rows } = await GRN.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: ASN,
          as: "asn",
          attributes: ["id", "asn_no", "reference_no"],
        },
        {
          model: Warehouse,
          as: "warehouse",
          attributes: ["id", "warehouse_name", "warehouse_code"],
        },
        {
          model: User,
          as: "poster",
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
        grns: rows,
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

// Get GRN by ID
const getGRNById = async (req, res, next) => {
  try {
    const grn = await GRN.findByPk(req.params.id, {
      include: [
        {
          model: ASN,
          as: "asn",
        },
        {
          model: Warehouse,
          as: "warehouse",
        },
        {
          model: GRNLine,
          as: "lines",
          include: [
            {
              model: SKU,
              as: "sku",
              attributes: ["id", "sku_code", "sku_name", "uom"],
            },
            {
              model: Pallet,
              as: "pallet",
              attributes: ["id", "pallet_id", "current_location"],
            },
            {
              model: User,
              as: "assignee",
              attributes: ["id", "username"],
            },
          ],
        },
        {
          model: User,
          as: "poster",
          attributes: ["id", "username", "email"],
        },
      ],
    });

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: "GRN not found",
      });
    }

    res.json({
      success: true,
      data: grn,
    });
  } catch (error) {
    next(error);
  }
};

// Post GRN from ASN - Single atomic operation (creates GRN + GRN Lines + posts)
const postGRNFromASN = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { asn_id } = req.body;

    // Get ASN with lines and pallets
    const asn = await ASN.findByPk(asn_id, {
      include: [
        {
          model: ASNLine,
          as: "lines",
          include: [
            {
              model: ASNLinePallet,
              as: "pallets",
              include: [{ model: Pallet, as: "pallet" }],
            },
            {
              model: SKU,
              as: "sku",
            },
          ],
        },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE, // Lock the ASN row to prevent race conditions
    });

    if (!asn) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "ASN not found",
      });
    }

    // Only allow GRN creation from IN_RECEIVING status
    if (asn.status !== "IN_RECEIVING") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot post GRN for ASN with status ${asn.status}. ASN must be in IN_RECEIVING status.`,
      });
    }

    // Double-check: Ensure no GRN already exists for this ASN
    const existingGRN = await GRN.findOne({
      where: { asn_id: asn.id },
      transaction: t,
    });

    if (existingGRN) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `GRN already exists for this ASN: ${existingGRN.grn_no}`,
      });
    }

    // Generate GRN number
    const grn_no = await generateGRNNumber(asn.asn_no);

    // Create GRN with POSTED status directly
    const grn = await GRN.create(
      {
        grn_no,
        asn_id: asn.id,
        warehouse_id: asn.warehouse_id,
        total_received_qty: asn.total_received_units,
        total_damaged_qty: asn.total_damaged_units,
        status: "POSTED",
        posted_at: new Date(),
        posted_by: req.user.id,
      },
      { transaction: t },
    );

    // Create GRN Lines from ASN Line Pallets
    const grnLines = [];
    for (const asnLine of asn.lines) {
      for (const palletRecord of asnLine.pallets) {
        if (palletRecord.good_qty > 0) {
          const ptTaskId = await generatePTTaskID();
          grnLines.push({
            pt_task_id: ptTaskId,
            grn_id: grn.id,
            asn_line_id: asnLine.id,
            sku_id: asnLine.sku_id,
            pallet_id: palletRecord.pallet_id,
            batch_no: palletRecord.batch_no,
            qty: palletRecord.good_qty,
            source_location:
              palletRecord.pallet?.current_location ||
              asn.dock?.dock_code ||
              "RECEIVING",
            putaway_status: "PENDING",
          });
        }
      }
    }

    await GRNLine.bulkCreate(grnLines, { transaction: t });

    // Update ASN status to GRN_POSTED
    await asn.update(
      {
        status: "GRN_POSTED",
        grn_posted_at: new Date(),
      },
      { transaction: t },
    );

    await t.commit();

    // Fetch created GRN with details
    const createdGRN = await GRN.findByPk(grn.id, {
      include: [
        { model: ASN, as: "asn" },
        {
          model: GRNLine,
          as: "lines",
          include: [
            { model: SKU, as: "sku" },
            { model: Pallet, as: "pallet" },
          ],
        },
        {
          model: User,
          as: "poster",
          attributes: ["id", "username", "email"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "GRN posted successfully",
      data: createdGRN,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// Assign putaway task to user
const assignPutawayTask = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { line_id, user_id, destination_location } = req.body;

    const grnLine = await GRNLine.findByPk(line_id, {
      include: [
        {
          model: GRN,
          as: "grn",
          include: [{ model: ASN, as: "asn" }],
        },
      ],
      transaction: t,
    });

    if (!grnLine) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "GRN Line not found",
      });
    }

    await grnLine.update(
      {
        assigned_to: user_id,
        destination_location,
        putaway_status: "ASSIGNED",
      },
      { transaction: t },
    );

    // Auto-update ASN status to PUTAWAY_PENDING if currently GRN_POSTED
    const asn = grnLine.grn?.asn;
    if (asn && asn.status === "GRN_POSTED") {
      await asn.update(
        {
          status: "PUTAWAY_PENDING",
        },
        { transaction: t },
      );
    }

    await t.commit();

    res.json({
      success: true,
      message: "Putaway task assigned successfully",
      data: grnLine,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// Complete putaway task
const completePutawayTask = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const grnLine = await GRNLine.findByPk(req.params.lineId, {
      include: [
        { model: Pallet, as: "pallet" },
        {
          model: GRN,
          as: "grn",
          include: [{ model: ASN, as: "asn" }],
        },
      ],
      transaction: t,
    });

    if (!grnLine) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "GRN Line not found",
      });
    }

    // Update GRN Line
    await grnLine.update(
      {
        putaway_status: "COMPLETED",
        putaway_completed_at: new Date(),
      },
      { transaction: t },
    );

    // Update Pallet location
    if (grnLine.pallet) {
      await grnLine.pallet.update(
        {
          current_location: grnLine.destination_location,
          status: "IN_STORAGE",
        },
        { transaction: t },
      );
    }

    // Check if ALL GRN lines for this ASN are completed
    const asn = grnLine.grn?.asn;
    if (asn) {
      const pendingLines = await GRNLine.count({
        where: {
          putaway_status: { [Op.ne]: "COMPLETED" },
        },
        include: [
          {
            model: GRN,
            as: "grn",
            where: { asn_id: asn.id },
            required: true,
          },
        ],
        transaction: t,
      });

      // If no pending lines, mark ASN as CLOSED
      if (pendingLines === 0) {
        await asn.update(
          {
            status: "CLOSED",
            closed_at: new Date(),
            putaway_completed_at: new Date(),
          },
          { transaction: t },
        );
      }
    }

    await t.commit();

    res.json({
      success: true,
      message: "Putaway task completed successfully",
      data: grnLine,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

export {
  getAllGRNs,
  getGRNById,
  postGRNFromASN,
  assignPutawayTask,
  completePutawayTask,
};
