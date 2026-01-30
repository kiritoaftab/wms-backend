import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Dock = sequelize.define(
  "docks",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "warehouses",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    dock_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "e.g., Dock A, Loading Bay 1",
    },
    dock_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "e.g., D-01, D-04",
    },
    dock_type: {
      type: DataTypes.ENUM("INBOUND", "OUTBOUND", "BOTH"),
      defaultValue: "BOTH",
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Number of vehicles that can be handled simultaneously",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["warehouse_id", "dock_code"],
      },
    ],
  },
);

export default Dock;
