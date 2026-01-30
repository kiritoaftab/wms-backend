import { ASNLine, ASN, SKU } from "../models/index.js";
import { sequelize } from "../config/database.js";

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

export { addLineToASN, updateASNLine, deleteASNLine, getLinesByASN };
