import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const ASNLine = sequelize.define(
  "asn_lines",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    asn_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "asns",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    sku_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "skus",
        key: "id",
      },
    },

    // Expected quantity
    expected_qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Expected quantity",
    },
    uom: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "EA",
      comment: "Unit of Measure",
    },

    // Receiving quantities
    received_qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Actually received quantity",
    },
    damaged_qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Damaged quantity",
    },
    shortage_qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Shortage quantity (expected - received)",
    },

    // Shortage details
    shortage_reason: {
      type: DataTypes.ENUM(
        "DAMAGED_IN_TRANSIT",
        "MISSING",
        "WRONG_SKU",
        "PARTIAL_SHIPMENT",
        "OTHER",
      ),
      allowNull: true,
    },
    shortage_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Status
    status: {
      type: DataTypes.ENUM("PENDING", "PARTIAL", "COMPLETED"),
      defaultValue: "PENDING",
    },

    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default ASNLine;
