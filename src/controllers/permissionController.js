import { Permission } from "../models/index.js";

// Get all permissions
const getAllPermissions = async (req, res, next) => {
  try {
    const permissions = await Permission.findAll({
      order: [["code", "ASC"]],
    });

    res.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    next(error);
  }
};

// Get permission by ID
const getPermissionById = async (req, res, next) => {
  try {
    const permission = await Permission.findByPk(req.params.id);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    res.json({
      success: true,
      data: permission,
    });
  } catch (error) {
    next(error);
  }
};

// Create permission
const createPermission = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;

    const permission = await Permission.create({
      name,
      code,
      description,
    });

    res.status(201).json({
      success: true,
      message: "Permission created successfully",
      data: permission,
    });
  } catch (error) {
    next(error);
  }
};

// Update permission
const updatePermission = async (req, res, next) => {
  try {
    const permission = await Permission.findByPk(req.params.id);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    const { name, code, description } = req.body;

    await permission.update({
      name,
      code,
      description,
    });

    res.json({
      success: true,
      message: "Permission updated successfully",
      data: permission,
    });
  } catch (error) {
    next(error);
  }
};

// Delete permission
const deletePermission = async (req, res, next) => {
  try {
    const permission = await Permission.findByPk(req.params.id);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    // Prevent deleting system permissions
    if (
      ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT"].includes(permission.code)
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete system permissions",
      });
    }

    await permission.destroy();

    res.json({
      success: true,
      message: "Permission deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
};
