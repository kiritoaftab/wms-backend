import { sequelize } from "../config/database.js";
import User from "./User.js";
import Module from "./Module.js";
import Permission from "./Permission.js";
import Role from "./Role.js";
import RoleModule from "./RoleModule.js";
import UserRole from "./UserRole.js";

// Define Associations

// User <-> Role (Many-to-Many through UserRole)
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: "user_id",
  otherKey: "role_id",
  as: "roles",
});

Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: "role_id",
  otherKey: "user_id",
  as: "users",
});

// Role <-> Module (Many-to-Many through RoleModule with Permission)
Role.belongsToMany(Module, {
  through: { model: RoleModule, unique: false },
  foreignKey: "role_id",
  otherKey: "module_id",
  as: "modules",
});

Module.belongsToMany(Role, {
  through: { model: RoleModule, unique: false },
  foreignKey: "module_id",
  otherKey: "role_id",
  as: "roles",
});

// RoleModule belongs to Permission, Role, and Module
RoleModule.belongsTo(Permission, {
  foreignKey: "permission_id",
  as: "permission",
});

RoleModule.belongsTo(Role, {
  foreignKey: "role_id",
  as: "role",
});

RoleModule.belongsTo(Module, {
  foreignKey: "module_id",
  as: "module",
});

// Self-referencing for User (created_by, updated_by)
User.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

User.belongsTo(User, {
  foreignKey: "updated_by",
  as: "updater",
});

// Role created_by
Role.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

// Sync function
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log("✅ All models synchronized successfully.");
  } catch (error) {
    console.error("❌ Error synchronizing models:", error);
    throw error;
  }
};

export {
  sequelize,
  User,
  Module,
  Permission,
  Role,
  RoleModule,
  UserRole,
  syncDatabase,
};
