import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const PickTask = sequelize.define(
  "PickTask",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    task_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "PICK-00001",
    },
    wave_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "pick_waves",
        key: "id",
      },
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "sales_orders",
        key: "id",
      },
    },
    order_line_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "sales_order_lines",
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
    inventory_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "inventory",
        key: "id",
      },
      comment: "Specific inventory record to pick from",
    },
    source_location_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "locations",
        key: "id",
      },
      comment: "Pick from this location",
    },
    staging_location_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "locations",
        key: "id",
      },
      comment: "Stage picked items here (optional)",
    },
    qty_to_pick: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      comment: "Quantity allocated to pick",
    },
    qty_picked: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
      comment: "Actual quantity picked",
    },
    qty_short: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
      comment: "Shortage quantity (to_pick - picked)",
    },
    batch_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Batch to pick",
    },
    serial_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Serial number if tracked",
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Expiry date of batch",
    },
    status: {
      type: DataTypes.ENUM(
        "PENDING",
        "ASSIGNED",
        "IN_PROGRESS",
        "COMPLETED",
        "SHORT_PICK",
        "CANCELLED",
        "FAILED",
      ),
      allowNull: false,
      defaultValue: "PENDING",
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: "1=highest, 10=lowest. For task ordering",
    },
    pick_sequence: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Optimized picking sequence within wave",
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      comment: "Picker assigned to this task",
    },
    short_pick_reason: {
      type: DataTypes.ENUM(
        "OUT_OF_STOCK",
        "DAMAGED_INVENTORY",
        "LOCATION_EMPTY",
        "WRONG_BATCH",
        "EXPIRED",
        "OTHER",
      ),
      allowNull: true,
    },
    short_pick_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    assigned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    pick_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    pick_completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    tableName: "pick_tasks",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["task_no"] },
      { fields: ["wave_id"] },
      { fields: ["order_id"] },
      { fields: ["order_line_id"] },
      { fields: ["sku_id"] },
      { fields: ["inventory_id"] },
      { fields: ["source_location_id"] },
      { fields: ["status"] },
      { fields: ["assigned_to"] },
      { fields: ["priority"] },
      { fields: ["pick_sequence"] },
      { fields: ["wave_id", "pick_sequence"] },
    ],
  },
);

export default PickTask;
