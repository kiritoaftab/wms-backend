import { Warehouse, Dock } from "../models/index.js";

// Get all warehouses
const getAllWarehouses = async (req, res, next) => {
  try {
    const warehouses = await Warehouse.findAll({
      include: [
        {
          model: Dock,
          as: "docks",
          attributes: [
            "id",
            "dock_name",
            "dock_code",
            "dock_type",
            "capacity_sqft",
            "is_active",
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: warehouses,
    });
  } catch (error) {
    next(error);
  }
};

// Get warehouse by ID
const getWarehouseById = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findByPk(req.params.id, {
      include: [
        {
          model: Dock,
          as: "docks",
        },
      ],
    });

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    res.json({
      success: true,
      data: warehouse,
    });
  } catch (error) {
    next(error);
  }
};

// Create warehouse
const createWarehouse = async (req, res, next) => {
  try {
    const {
      warehouse_name,
      warehouse_code,
      address,
      city,
      state,
      country,
      pincode,
      capacity_sqft,
      timezone,
      warehouse_type,
    } = req.body;

    const warehouse = await Warehouse.create({
      warehouse_name,
      warehouse_code,
      address,
      city,
      state,
      country,
      pincode,
      capacity_sqft,
      timezone,
      warehouse_type,
    });

    res.status(201).json({
      success: true,
      message: "Warehouse created successfully",
      data: warehouse,
    });
  } catch (error) {
    next(error);
  }
};

// Update warehouse
const updateWarehouse = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findByPk(req.params.id);

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    const {
      warehouse_name,
      warehouse_code,
      address,
      city,
      state,
      country,
      pincode,
      capacity_sqft,
      timezone,
      warehouse_type,
      is_active,
    } = req.body;

    await warehouse.update({
      warehouse_name,
      warehouse_code,
      address,
      city,
      state,
      country,
      pincode,
      capacity_sqft,
      timezone,
      warehouse_type,
      is_active,
    });

    res.json({
      success: true,
      message: "Warehouse updated successfully",
      data: warehouse,
    });
  } catch (error) {
    next(error);
  }
};

// Delete warehouse (soft delete)
const deleteWarehouse = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findByPk(req.params.id);

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    await warehouse.update({ is_active: false });

    res.json({
      success: true,
      message: "Warehouse deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
};
