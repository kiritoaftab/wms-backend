import jwt from "jsonwebtoken";
import { User, Role, Module, Permission, RoleModule } from "../models/index.js";

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ["pass_hash"] },
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
        },
      ],
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: error.message,
    });
  }
};

// Check if user has specific permission for a module
const authorize = (moduleCode, permissionCode) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Get user's roles
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Role,
            as: "roles",
            where: { is_active: true },
          },
        ],
      });

      if (!user || !user.roles || user.roles.length === 0) {
        return res.status(403).json({
          success: false,
          message: "No active roles assigned",
        });
      }

      const roleIds = user.roles.map((role) => role.id);

      // Check if any role has the required permission for the module
      const permission = await RoleModule.findOne({
        where: {
          role_id: roleIds,
          is_granted: true,
        },
        include: [
          {
            model: Module,
            as: "module",
            where: { code: moduleCode, is_active: true },
          },
          {
            model: Permission,
            as: "permission",
            where: { code: permissionCode },
          },
        ],
      });

      if (!permission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${permissionCode} on module: ${moduleCode}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Authorization error",
        error: error.message,
      });
    }
  };
};

// Check if user has any of the specified roles
const hasRole = (...roleCodes) => {
  return async (req, res, next) => {
    try {
      const userRoles = req.user.roles.map((role) => role.role_code);
      const hasRequiredRole = roleCodes.some((code) =>
        userRoles.includes(code),
      );

      if (!hasRequiredRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${roleCodes.join(", ")}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Role check error",
        error: error.message,
      });
    }
  };
};

export { authenticate, authorize, hasRole };
