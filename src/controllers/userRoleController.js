import { User, Role, UserRole } from "../models/index.js";

// Assign role to user
const assignRoleToUser = async (req, res, next) => {
  try {
    const { user_id, role_id } = req.body;

    // Check if user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if role exists
    const role = await Role.findByPk(role_id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Check if role assignment already exists
    const existingAssignment = await UserRole.findOne({
      where: { user_id, role_id },
    });

    if (existingAssignment) {
      return res.status(409).json({
        success: false,
        message: "User already has this role",
      });
    }

    // Create role assignment
    await UserRole.create({ user_id, role_id });

    res.status(201).json({
      success: true,
      message: "Role assigned to user successfully",
      data: {
        user_id,
        role_id,
        user: user.toJSON(),
        role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Remove role from user
const removeRoleFromUser = async (req, res, next) => {
  try {
    const { user_id, role_id } = req.body;

    const userRole = await UserRole.findOne({
      where: { user_id, role_id },
    });

    if (!userRole) {
      return res.status(404).json({
        success: false,
        message: "User role assignment not found",
      });
    }

    await userRole.destroy();

    res.json({
      success: true,
      message: "Role removed from user successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get all roles for a specific user
const getUserRoles = async (req, res, next) => {
  try {
    const userId = req.params.userId;

    const user = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: ["created_at"] },
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
        },
        roles: user.roles,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all users with a specific role
const getUsersByRole = async (req, res, next) => {
  try {
    const roleId = req.params.roleId;

    const role = await Role.findByPk(roleId, {
      include: [
        {
          model: User,
          as: "users",
          through: { attributes: ["created_at"] },
          attributes: [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
          ],
        },
      ],
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    res.json({
      success: true,
      data: {
        role: {
          id: role.id,
          role_name: role.role_name,
          role_code: role.role_code,
          description: role.description,
        },
        users: role.users,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Bulk assign roles to user (replace all existing roles)
const bulkAssignRolesToUser = async (req, res, next) => {
  try {
    const { user_id, role_ids } = req.body;

    // Validate user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate all roles exist
    const roles = await Role.findAll({
      where: { id: role_ids },
    });

    if (roles.length !== role_ids.length) {
      return res.status(404).json({
        success: false,
        message: "One or more roles not found",
      });
    }

    // Remove all existing roles
    await UserRole.destroy({
      where: { user_id },
    });

    // Assign new roles
    const assignments = role_ids.map((role_id) => ({
      user_id,
      role_id,
    }));

    await UserRole.bulkCreate(assignments);

    // Fetch user with new roles
    const updatedUser = await User.findByPk(user_id, {
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
        },
      ],
    });

    res.json({
      success: true,
      message: "User roles updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// Get all user-role assignments (for admin view)
const getAllUserRoles = async (req, res, next) => {
  try {
    const userRoles = await UserRole.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "email", "first_name", "last_name"],
        },
        {
          model: Role,
          as: "role",
          attributes: ["id", "role_name", "role_code"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: userRoles,
    });
  } catch (error) {
    next(error);
  }
};

export {
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles,
  getUsersByRole,
  bulkAssignRolesToUser,
  getAllUserRoles,
};
