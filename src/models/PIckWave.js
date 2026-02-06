import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const PickWave = sequelize.define(
  "PickWave",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    wave_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "PW-00001",
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "warehouses",
        key: "id",
      },
    },
    wave_type: {
      type: DataTypes.ENUM(
        "TIME_BASED",
        "CARRIER_BASED",
        "ZONE_BASED",
        "PRIORITY_BASED",
        "MANUAL",
      ),
      allowNull: false,
      defaultValue: "MANUAL",
      comment: "Strategy used to create this wave",
    },
    wave_strategy: {
      type: DataTypes.ENUM(
        "BATCH",
        "ZONE_PICKING",
        "CLUSTER_PICKING",
        "WAVE_PICKING",
      ),
      allowNull: false,
      defaultValue: "BATCH",
      comment: "Picking methodology",
    },
    priority: {
      type: DataTypes.ENUM("NORMAL", "HIGH", "URGENT"),
      allowNull: false,
      defaultValue: "NORMAL",
    },
    carrier: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "DHL, FedEx, etc. if carrier-based wave",
    },
    carrier_cutoff_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Carrier pickup deadline",
    },
    zone_filter: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Comma-separated zones: A,B,C if zone-based",
    },
    total_orders: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of sales orders in this wave",
    },
    total_lines: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of order lines in this wave",
    },
    total_units: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
      comment: "Total units to pick",
    },
    picked_units: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
      comment: "Units picked so far",
    },
    total_tasks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of pick tasks generated",
    },
    completed_tasks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of pick tasks completed",
    },
    status: {
      type: DataTypes.ENUM(
        "PENDING",
        "RELEASED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ),
      allowNull: false,
      defaultValue: "PENDING",
      comment: "Wave lifecycle status",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    released_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When wave was released to floor",
    },
    released_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    picking_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When first pick task started",
    },
    picking_completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When last pick task completed",
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
    tableName: "pick_waves",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["wave_no"] },
      { fields: ["warehouse_id"] },
      { fields: ["status"] },
      { fields: ["priority"] },
      { fields: ["wave_type"] },
      { fields: ["carrier"] },
      { fields: ["carrier_cutoff_time"] },
      { fields: ["released_at"] },
    ],
  },
);

export default PickWave;
