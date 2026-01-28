import { User, Role } from "../models/index.js";

// Get all users (with pagination & search)
const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // Build where clause for search
    const whereClause = search
      ? {
          [Op.or]: [
            { username: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { first_name: { [Op.like]: `%${search}%` } },
            { last_name: { [Op.like]: `%${search}%` } },
          ],
        }
      : {};

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: {
        users: rows,
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

// Get user by ID
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
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
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Create user (Admin function)
const createUser = async (req, res, next) => {
  try {
    const { username, email, password, first_name, last_name, phone } =
      req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      pass_hash: password,
      first_name,
      last_name,
      phone,
      created_by: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Update user
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { username, email, first_name, last_name, phone, is_active } =
      req.body;

    await user.update({
      username,
      email,
      first_name,
      last_name,
      phone,
      is_active,
      updated_by: req.user.id,
    });

    res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Delete user (soft delete by setting is_active = false)
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.update({
      is_active: false,
      updated_by: req.user.id,
    });

    res.json({
      success: true,
      message: "User deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Change password
const changePassword = async (req, res, next) => {
  try {
    const { old_password, new_password } = req.body;
    const userId = req.params.id;

    // Only allow users to change their own password, unless admin
    if (
      req.user.id !== parseInt(userId) &&
      !req.user.roles.some((r) => r.role_code === "ADMIN")
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only change your own password",
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify old password
    const isValidPassword = await user.validatePassword(old_password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    await user.update({
      pass_hash: new_password, // Will be hashed by beforeUpdate hook
      updated_by: req.user.id,
    });

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
};
