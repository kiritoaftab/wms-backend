import { GRNLine, GRN, SKU, Pallet, Location, User } from "../models/index.js";
import { suggestPutawayLocation } from "../utils/locationHelper.js";

// Get GRN Line by ID (with full details)
const getGRNLineById = async (req, res, next) => {
  try {
    const grnLine = await GRNLine.findByPk(req.params.id, {
      include: [
        {
          model: GRN,
          as: "grn",
          attributes: ["id", "grn_no", "status"],
        },
        {
          model: SKU,
          as: "sku",
          attributes: ["id", "sku_code", "sku_name", "uom", "putaway_zone"],
        },
        {
          model: Pallet,
          as: "pallet",
          attributes: ["id", "pallet_id", "status"],
        },
        {
          model: Location,
          as: "source_location",
          attributes: [
            "id",
            "location_code",
            "zone",
            "location_type",
            "capacity",
            "current_usage",
          ],
        },
        {
          model: Location,
          as: "destination_location",
          attributes: [
            "id",
            "location_code",
            "zone",
            "location_type",
            "capacity",
            "current_usage",
          ],
        },
        {
          model: User,
          as: "assignee",
          attributes: ["id", "username", "email"],
        },
      ],
    });

    if (!grnLine) {
      return res.status(404).json({
        success: false,
        message: "GRN Line not found",
      });
    }

    res.json({
      success: true,
      data: grnLine,
    });
  } catch (error) {
    next(error);
  }
};

// Update GRN Line (mainly for location updates)
const updateGRNLine = async (req, res, next) => {
  try {
    const grnLine = await GRNLine.findByPk(req.params.id, {
      include: [
        { model: GRN, as: "grn" },
        { model: SKU, as: "sku" },
      ],
    });

    if (!grnLine) {
      return res.status(404).json({
        success: false,
        message: "GRN Line not found",
      });
    }

    // Can only update if not completed
    if (grnLine.putaway_status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Cannot update completed putaway task",
      });
    }

    const { source_location_id, destination_location_id, assigned_to, qty } =
      req.body;

    // Validate locations if provided
    if (destination_location_id) {
      const destLocation = await Location.findByPk(destination_location_id);
      if (!destLocation) {
        return res.status(404).json({
          success: false,
          message: "Destination location not found",
        });
      }

      // Check capacity
      const availableCapacity =
        destLocation.capacity - destLocation.current_usage;
      const qtyToMove = qty || grnLine.qty;

      if (availableCapacity < qtyToMove) {
        return res.status(400).json({
          success: false,
          message: `Insufficient capacity at ${destLocation.location_code}. Available: ${availableCapacity}, Required: ${qtyToMove}`,
        });
      }
    }

    // Update the GRN Line
    await grnLine.update({
      source_location_id: source_location_id || grnLine.source_location_id,
      destination_location_id:
        destination_location_id || grnLine.destination_location_id,
      assigned_to:
        assigned_to !== undefined ? assigned_to : grnLine.assigned_to,
      qty: qty || grnLine.qty,
      putaway_status:
        destination_location_id && !grnLine.assigned_to
          ? "PENDING"
          : grnLine.putaway_status,
    });

    // Fetch updated line with details
    const updatedLine = await GRNLine.findByPk(grnLine.id, {
      include: [
        { model: SKU, as: "sku" },
        { model: Pallet, as: "pallet" },
        { model: Location, as: "source_location" },
        { model: Location, as: "destination_location" },
        { model: User, as: "assignee" },
      ],
    });

    res.json({
      success: true,
      message: "GRN Line updated successfully",
      data: updatedLine,
    });
  } catch (error) {
    next(error);
  }
};

// Get suggested putaway location for a GRN Line
const getSuggestedLocation = async (req, res, next) => {
  try {
    const zone = req.query.zone || null;
    const grnLine = await GRNLine.findByPk(req.params.id, {
      include: [
        {
          model: GRN,
          as: "grn",
          attributes: ["id", "warehouse_id"],
        },
        { model: SKU, as: "sku" },
      ],
    });

    if (!grnLine) {
      return res.status(404).json({
        success: false,
        message: "GRN Line not found",
      });
    }

    // Get suggested location based on SKU and quantity
    const suggestedLocation = await suggestPutawayLocation(
      grnLine.grn.warehouse_id,
      grnLine.sku,
      grnLine.qty,
    );

    if (!suggestedLocation) {
      return res.status(404).json({
        success: false,
        message: "No suitable location found with sufficient capacity",
      });
    }

    res.json({
      success: true,
      data: {
        suggested_location: suggestedLocation,
        sku: {
          id: grnLine.sku.id,
          sku_code: grnLine.sku.sku_code,
          sku_name: grnLine.sku.sku_name,
          putaway_zone: grnLine.sku.putaway_zone,
        },
        quantity: grnLine.qty,
        available_capacity:
          suggestedLocation.capacity - suggestedLocation.current_usage,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Bulk update multiple GRN Lines (for batch operations)
const bulkUpdateGRNLines = async (req, res, next) => {
  try {
    const { grn_line_ids, updates } = req.body;

    if (
      !grn_line_ids ||
      !Array.isArray(grn_line_ids) ||
      grn_line_ids.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "grn_line_ids array is required",
      });
    }

    // Validate all lines exist and are updatable
    const grnLines = await GRNLine.findAll({
      where: { id: grn_line_ids },
    });

    if (grnLines.length !== grn_line_ids.length) {
      return res.status(404).json({
        success: false,
        message: "Some GRN Lines not found",
      });
    }

    // Check if any are already completed
    const completedLines = grnLines.filter(
      (line) => line.putaway_status === "COMPLETED",
    );
    if (completedLines.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot update completed tasks: ${completedLines.map((l) => l.pt_task_id).join(", ")}`,
      });
    }

    // Perform bulk update
    await GRNLine.update(updates, {
      where: { id: grn_line_ids },
    });

    // Fetch updated lines
    const updatedLines = await GRNLine.findAll({
      where: { id: grn_line_ids },
      include: [
        { model: SKU, as: "sku" },
        { model: Location, as: "source_location" },
        { model: Location, as: "destination_location" },
      ],
    });

    res.json({
      success: true,
      message: `Successfully updated ${updatedLines.length} GRN Lines`,
      data: updatedLines,
    });
  } catch (error) {
    next(error);
  }
};

const getAllGRNLines = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { warehouse_id } = req.query;
    const grnLines = await GRNLine.findAll({
      where: warehouse_id ? { warehouse_id } : {},
      include: [
        { model: SKU, as: "sku" },
        { model: Pallet, as: "pallet" },
        { model: Location, as: "source_location" },
        { model: Location, as: "destination_location" },
        { model: User, as: "assignee" },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: grnLines,
    });
  } catch (error) {
    next(error);
  }
};

export {
  getGRNLineById,
  updateGRNLine,
  getSuggestedLocation,
  bulkUpdateGRNLines,
  getAllGRNLines,
};
