import { Dock, Warehouse } from "../models/index.js";

// Get all docks
const getAllDocks = async (req, res, next) => {
  try {
    const warehouseId = req.query.warehouse_id;
    const whereClause = warehouseId ? { warehouse_id: warehouseId } : {};

    const docks = await Dock.findAll({
      where: whereClause,
      include: [
        {
          model: Warehouse,
          as: "warehouse",
          attributes: ["id", "warehouse_name", "warehouse_code"],
        },
      ],
      order: [["dock_code", "ASC"]],
    });

    res.json({
      success: true,
      data: docks,
    });
  } catch (error) {
    next(error);
  }
};

// Get dock by ID
const getDockById = async (req, res, next) => {
  try {
    const dock = await Dock.findByPk(req.params.id, {
      include: [
        {
          model: Warehouse,
          as: "warehouse",
        },
      ],
    });

    if (!dock) {
      return res.status(404).json({
        success: false,
        message: "Dock not found",
      });
    }

    res.json({
      success: true,
      data: dock,
    });
  } catch (error) {
    next(error);
  }
};

// Create dock
const createDock = async (req, res, next) => {
  try {
    const { warehouse_id, dock_name, dock_code, dock_type, capacity } =
      req.body;

    // Verify warehouse exists
    const warehouse = await Warehouse.findByPk(warehouse_id);
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    const dock = await Dock.create({
      warehouse_id,
      dock_name,
      dock_code,
      dock_type,
      capacity,
    });

    res.status(201).json({
      success: true,
      message: "Dock created successfully",
      data: dock,
    });
  } catch (error) {
    next(error);
  }
};

// Update dock
const updateDock = async (req, res, next) => {
  try {
    const dock = await Dock.findByPk(req.params.id);

    if (!dock) {
      return res.status(404).json({
        success: false,
        message: "Dock not found",
      });
    }

    const { dock_name, dock_code, dock_type, capacity, is_active } = req.body;

    await dock.update({
      dock_name,
      dock_code,
      dock_type,
      capacity,
      is_active,
    });

    res.json({
      success: true,
      message: "Dock updated successfully",
      data: dock,
    });
  } catch (error) {
    next(error);
  }
};

// Delete dock (soft delete)
const deleteDock = async (req, res, next) => {
  try {
    const dock = await Dock.findByPk(req.params.id);

    if (!dock) {
      return res.status(404).json({
        success: false,
        message: "Dock not found",
      });
    }

    await dock.update({ is_active: false });

    res.json({
      success: true,
      message: "Dock deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export { getAllDocks, getDockById, createDock, updateDock, deleteDock };
