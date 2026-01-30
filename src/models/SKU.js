import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const SKU = sequelize.define(
  "skus",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "clients",
        key: "id",
      },
      onDelete: "CASCADE",
      comment: "SKU belongs to a client",
    },
    sku_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "e.g., SKU-99201",
    },
    sku_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: "e.g., Wireless Mouse - Black",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "ELECTRONICS, FOOD, APPAREL, etc",
    },
    uom: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "EA",
      comment: "Unit of Measure: EA, PCS, PK, BOX, KG, etc",
    },
    dimensions_length: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "in cm",
    },
    dimensions_width: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "in cm",
    },
    dimensions_height: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "in cm",
    },
    weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "in kg",
    },
    requires_serial_tracking: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Track individual serial numbers",
    },
    requires_batch_tracking: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Track by batch/lot numbers",
    },
    requires_expiry_tracking: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Track expiry dates",
    },
    fragile: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    hazardous: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    pick_rule: {
      type: DataTypes.ENUM("FIFO", "LIFO", "FEFO"),
      defaultValue: "FIFO",
      comment: "First In First Out, Last In First Out, First Expired First Out",
    },
    putaway_zone: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: "ABC analysis zone: A (fast), B (medium), C (slow)",
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: "INR",
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
        fields: ["client_id", "sku_code"],
      },
    ],
  },
);

export default SKU;
