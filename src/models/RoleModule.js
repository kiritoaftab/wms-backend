import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const RoleModule = sequelize.define(
  "role_module",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "roles",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    module_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "modules",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    permission_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "permissions",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    is_granted: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["role_id", "module_id", "permission_id"], // All 3 fields together
      },
    ],
  },
);

export default RoleModule;
