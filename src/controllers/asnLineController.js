import {
  ASNLine,
  ASN,
  SKU,
  Pallet,
  ASNLinePallet,
  Dock,
  User,
} from "../models/index.js";
import { sequelize } from "../config/database.js";
import { generatePalletID } from "./palletController.js";
import { getReceivingLocation } from "../utils/locationHelper.js";

// Add line to ASN
const addLineToASN = async (req, res, next) => {
  try {
    const { asn_id, sku_id, expected_qty, uom, remarks } = req.body;

    // Verify ASN exists and is editable
    const asn = await ASN.findByPk(asn_id);
    if (!asn) {
      return res.status(404).json({
        success: false,
        message: "ASN not found",
      });
    }

    if (!["DRAFT", "CREATED"].includes(asn.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot add lines to ASN with status ${asn.status}`,
      });
    }

    // Verify SKU exists
    const sku = await SKU.findByPk(sku_id);
    if (!sku) {
      return res.status(404).json({
        success: false,
        message: "SKU not found",
      });
    }

    // Create line
    const line = await ASNLine.create({
      asn_id,
      sku_id,
      expected_qty,
      uom: uom || sku.uom,
      remarks,
    });

    // Update ASN totals
    await asn.update({
      total_lines: asn.total_lines + 1,
      total_expected_units: asn.total_expected_units + expected_qty,
    });

    res.status(201).json({
      success: true,
      message: "Line added to ASN successfully",
      data: line,
    });
  } catch (error) {
    next(error);
  }
};

// Update ASN line
const updateASNLine = async (req, res, next) => {
  try {
    const line = await ASNLine.findByPk(req.params.id, {
      include: [{ model: ASN, as: "asn" }],
    });

    if (!line) {
      return res.status(404).json({
        success: false,
        message: "ASN Line not found",
      });
    }

    if (!["DRAFT", "CREATED"].includes(line.asn.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update line for ASN with status ${line.asn.status}`,
      });
    }

    const { expected_qty, uom, remarks } = req.body;
    const oldQty = line.expected_qty;

    await line.update({
      expected_qty,
      uom,
      remarks,
    });

    // Update ASN totals
    const qtyDiff = expected_qty - oldQty;
    await line.asn.update({
      total_expected_units: line.asn.total_expected_units + qtyDiff,
    });

    res.json({
      success: true,
      message: "ASN Line updated successfully",
      data: line,
    });
  } catch (error) {
    next(error);
  }
};

// Receive items for an ASN line (create ASNLinePallet)
const receiveLineItems = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const lineId = req.params.lineId;
    console.log("Receiving items for ASN Line ID:", lineId);
    const {
      pallet_id, // existing pallet or null to create new
      pallet_type, // if creating new pallet
      batch_no,
      serial_no,
      expiry_date,
      good_qty,
      damaged_qty,
    } = req.body;

    // Get ASN Line with ASN
    const asnLine = await ASNLine.findByPk(lineId, {
      include: [
        {
          model: ASN,
          as: "asn",
          include: [{ model: Dock, as: "dock" }],
        },
        { model: SKU, as: "sku" },
      ],
    });

    if (!asnLine) {
      return res.status(404).json({
        success: false,
        message: "ASN Line not found",
      });
    }

    // Check ASN status
    if (asnLine.asn.status !== "IN_RECEIVING") {
      return res.status(400).json({
        success: false,
        message: `Cannot receive items for ASN with status ${asnLine.asn.status}`,
      });
    }

    let pallet;

    // Create new pallet or use existing
    if (pallet_id) {
      pallet = await Pallet.findByPk(pallet_id);
      if (!pallet) {
        return res.status(404).json({
          success: false,
          message: "Pallet not found",
        });
      }
    } else {
      const receivingLocation = await getReceivingLocation(
        asnLine.asn.warehouse_id,
        asnLine.asn.dock?.dock_code,
      );

      // Generate new pallet
      const newPalletId = await generatePalletID();
      pallet = await Pallet.create(
        {
          pallet_id: newPalletId,
          warehouse_id: asnLine.asn.warehouse_id,
          pallet_type: pallet_type || "STANDARD",
          current_location_id: receivingLocation.id, // ✅ Use location FK
          status: "IN_RECEIVING",
        },
        { transaction: t },
      );
    }

    // Create ASNLinePallet entry
    const asnLinePallet = await ASNLinePallet.create(
      {
        asn_line_id: lineId,
        pallet_id: pallet.id,
        batch_no,
        serial_no,
        expiry_date,
        good_qty,
        damaged_qty,
        received_at: new Date(),
        received_by: req.user.id,
      },
      { transaction: t },
    );

    // Update ASN Line quantities
    const newReceivedQty = asnLine.received_qty + good_qty;
    const newDamagedQty = asnLine.damaged_qty + damaged_qty;
    const newShortageQty = asnLine.expected_qty - newReceivedQty;

    let lineStatus = "PENDING";
    if (newReceivedQty >= asnLine.expected_qty) {
      lineStatus = "COMPLETED";
    } else if (newReceivedQty > 0) {
      lineStatus = "PARTIAL";
    }

    await asnLine.update(
      {
        received_qty: newReceivedQty,
        damaged_qty: newDamagedQty,
        shortage_qty: newShortageQty > 0 ? newShortageQty : 0,
        status: lineStatus,
      },
      { transaction: t },
    );

    // Update ASN totals
    await asnLine.asn.update(
      {
        total_received_units: asnLine.asn.total_received_units + good_qty,
        total_damaged_units: asnLine.asn.total_damaged_units + damaged_qty,
        total_shortage_units:
          asnLine.asn.total_expected_units -
          (asnLine.asn.total_received_units + good_qty),
      },
      { transaction: t },
    );

    await t.commit();

    res.status(201).json({
      success: true,
      message: "Items received successfully",
      data: {
        asn_line_pallet: asnLinePallet,
        pallet,
        updated_line: asnLine,
      },
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// Get all pallets for an ASN line
const getLinePallets = async (req, res, next) => {
  try {
    const pallets = await ASNLinePallet.findAll({
      where: { asn_line_id: req.params.lineId },
      include: [
        {
          model: Pallet,
          as: "pallet",
        },
        {
          model: User,
          as: "receiver",
          attributes: ["id", "username"],
        },
      ],
    });

    res.json({
      success: true,
      data: pallets,
    });
  } catch (error) {
    next(error);
  }
};

// Delete ASN line
const deleteASNLine = async (req, res, next) => {
  try {
    const line = await ASNLine.findByPk(req.params.id, {
      include: [{ model: ASN, as: "asn" }],
    });

    if (!line) {
      return res.status(404).json({
        success: false,
        message: "ASN Line not found",
      });
    }

    if (!["DRAFT", "CREATED"].includes(line.asn.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete line for ASN with status ${line.asn.status}`,
      });
    }

    // Update ASN totals before deleting
    await line.asn.update({
      total_lines: line.asn.total_lines - 1,
      total_expected_units: line.asn.total_expected_units - line.expected_qty,
    });

    await line.destroy();

    res.json({
      success: true,
      message: "ASN Line deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get lines for a specific ASN
const getLinesByASN = async (req, res, next) => {
  try {
    const lines = await ASNLine.findAll({
      where: { asn_id: req.params.asnId },
      include: [
        {
          model: SKU,
          as: "sku",
          attributes: ["id", "sku_code", "sku_name", "uom", "category"],
        },
      ],
      order: [["id", "ASC"]],
    });

    res.json({
      success: true,
      data: lines,
    });
  } catch (error) {
    next(error);
  }
};

export {
  addLineToASN,
  updateASNLine,
  deleteASNLine,
  getLinesByASN,
  receiveLineItems,
  getLinePallets,
};
