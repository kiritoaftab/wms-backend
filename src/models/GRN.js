import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const GRN = sequelize.define(
  "grns",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    grn_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "Auto-generated: GRN-10293-001",
    },
    asn_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "asns",
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

    // Summary quantities
    total_received_qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    total_damaged_qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    // Status
    status: {
      type: DataTypes.ENUM("DRAFT", "POSTED"),
      defaultValue: "DRAFT",
    },

    // Posting details
    posted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    posted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },

    notes: {
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

export default GRN;
