import { Role, User, Module, Permission, RoleModule } from "../models/index.js";

// Get all roles
const getAllRoles = async (req, res, next) => {
  try {
    const roles = await Role.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "email"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
};

// Get role by ID with permissions
const getRoleById = async (req, res, next) => {
  try {
    const role = await Role.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "email"],
        },
      ],
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Get role permissions
    const permissions = await RoleModule.findAll({
      where: { role_id: role.id },
      include: [
        {
          model: Module,
          as: "module",
          attributes: ["id", "name", "code"],
        },
        {
          model: Permission,
          as: "permission",
          attributes: ["id", "name", "code"],
        },
      ],
    });

    res.json({
      success: true,
      data: {
        role,
        permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create role
const createRole = async (req, res, next) => {
  try {
    const { role_name, role_code, description } = req.body;

    const role = await Role.create({
      role_name,
      role_code,
      description,
      created_by: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

// Update role
const updateRole = async (req, res, next) => {
  try {
    const role = await Role.findByPk(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    const { role_name, role_code, description, is_active } = req.body;

    await role.update({
      role_name,
      role_code,
      description,
      is_active,
    });

    res.json({
      success: true,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

// Delete role
const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findByPk(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Prevent deleting system roles
    if (["ADMIN", "USER"].includes(role.role_code)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete system roles",
      });
    }

    await role.update({ is_active: false });

    res.json({
      success: true,
      message: "Role deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Assign permission to role
const assignPermission = async (req, res, next) => {
  try {
    const { role_id, module_id, permission_id, is_granted } = req.body;

    // Check if already exists
    const existing = await RoleModule.findOne({
      where: { role_id, module_id, permission_id },
    });

    if (existing) {
      await existing.update({ is_granted });
      return res.json({
        success: true,
        message: "Permission updated successfully",
      });
    }

    // Create new permission
    await RoleModule.create({
      role_id,
      module_id,
      permission_id,
      is_granted: is_granted !== undefined ? is_granted : true,
    });

    res.status(201).json({
      success: true,
      message: "Permission assigned successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Remove permission from role
const removePermission = async (req, res, next) => {
  try {
    const { role_id, module_id, permission_id } = req.body;

    const roleModule = await RoleModule.findOne({
      where: { role_id, module_id, permission_id },
    });

    if (!roleModule) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    await roleModule.destroy();

    res.json({
      success: true,
      message: "Permission removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignPermission,
  removePermission,
};
