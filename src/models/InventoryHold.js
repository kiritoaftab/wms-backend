import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const InventoryHold = sequelize.define(
  "inventory_holds",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    hold_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "Unique Hold ID: HLD-9021",
    },

    // ✅ Just reference the Inventory record!
    inventory_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "inventory",
        key: "id",
      },
      onDelete: "CASCADE",
    },

    // Hold details
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Quantity on hold",
    },

    hold_reason: {
      type: DataTypes.ENUM(
        "QUALITY_CHECK",
        "DAMAGED",
        "EXPIRY_RISK",
        "RECALL",
        "CUSTOMER_DISPUTE",
        "OTHER",
      ),
      allowNull: false,
    },

    hold_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Status
    status: {
      type: DataTypes.ENUM("ACTIVE", "RELEASED"),
      defaultValue: "ACTIVE",
    },

    // Audit
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    released_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    released_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default InventoryHold;
