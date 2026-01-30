import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const GRNLine = sequelize.define(
  "grn_lines",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    pt_task_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "Putaway Task ID: PT-10923, PT-10924",
    },
    grn_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "grns",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    asn_line_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "asn_lines",
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
    pallet_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "pallets",
        key: "id",
      },
    },

    // Batch tracking
    batch_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Quantity to putaway
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Quantity to be put away",
    },

    // Locations
    source_location: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Current location: DOCK-01",
    },
    destination_location: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Target location: BIN-A-01-02",
    },

    // Putaway status
    putaway_status: {
      type: DataTypes.ENUM("PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED"),
      defaultValue: "PENDING",
    },

    // Assignment
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      comment: "Warehouse worker assigned to putaway task",
    },

    // Timestamps
    putaway_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    putaway_completed_at: {
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

export default GRNLine;
