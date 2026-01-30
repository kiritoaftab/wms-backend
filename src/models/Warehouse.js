import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Warehouse = sequelize.define(
  "warehouses",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    warehouse_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    warehouse_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "e.g., WH-NYC-01",
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "INDIA",
    },
    pincode: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    capacity_sqft: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Total storage capacity in square feet",
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "India/Kolkata",
      comment: "Warehouse timezone for operations",
    },
    warehouse_type: {
      type: DataTypes.ENUM(
        "DISTRIBUTION_CENTER",
        "FULFILLMENT",
        "COLD_STORAGE",
        "CROSS_DOCK",
        "GENERAL",
      ),
      defaultValue: "GENERAL",
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
  },
);

export default Warehouse;
