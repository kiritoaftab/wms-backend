import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Inventory = sequelize.define(
  "inventory",
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
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "clients",
        key: "id",
      },
    },
    sku_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "skus",
        key: "id",
      },
    },
    location_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "locations",
        key: "id",
      },
    },
    batch_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Batch/Lot number",
    },
    serial_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Serial number (if tracked)",
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Expiry date (if tracked)",
    },
    on_hand_qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Physical quantity in this location",
    },
    available_qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Available for picking = on_hand - hold - allocated",
    },
    hold_qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Quarantined/held quantity",
    },
    allocated_qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Reserved for outbound orders",
    },
    damaged_qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Damaged units",
    },
    status: {
      type: DataTypes.ENUM(
        "HEALTHY",
        "LOW_STOCK",
        "EXPIRY_RISK",
        "QC_HOLD",
        "DAMAGED",
      ),
      defaultValue: "HEALTHY",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["warehouse_id", "sku_id", "location_id", "batch_no"],
        name: "unique_inventory_record",
      },
    ],
  },
);

export default Inventory;
