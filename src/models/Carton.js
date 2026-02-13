import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Carton = sequelize.define(
  "Carton",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    carton_no: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: "Auto-generated: CTN-00001",
    },
    sales_order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "sales_orders",
        key: "id",
      },
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "warehouses",
        key: "id",
      },
    },
    carton_type: {
      type: DataTypes.ENUM("SMALL", "MEDIUM", "LARGE", "EXTRA_LARGE", "CUSTOM"),
      allowNull: false,
      defaultValue: "MEDIUM",
    },
    length: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Length in cm",
    },
    width: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Width in cm",
    },
    height: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Height in cm",
    },
    gross_weight: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      comment: "Total weight in kg (tare + net)",
    },
    tare_weight: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      comment: "Empty box weight in kg",
    },
    net_weight: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      comment: "Items weight in kg",
    },
    total_items: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total item qty in this carton",
    },
    status: {
      type: DataTypes.ENUM("OPEN", "CLOSED", "SHIPPED"),
      allowNull: false,
      defaultValue: "OPEN",
    },
    packed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      comment: "User who packed this carton",
    },
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "cartons",
    timestamps: true,
    underscored: true,
  },
);

export default Carton;
