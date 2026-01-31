import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const InventoryTransaction = sequelize.define(
  "inventory_transactions",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    transaction_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "TSK-9921, MVE-881, ADJ-102",
    },

    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "warehouses",
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

    // Transaction Type
    transaction_type: {
      type: DataTypes.ENUM(
        "PUTAWAY", // GRN putaway
        "PICK", // Outbound pick
        "ADJUSTMENT", // Cycle count adjustment
        "MOVE", // Location transfer
        "HOLD", // Quarantine
        "RELEASE", // Release from hold
        "DAMAGE", // Damage write-off
      ),
      allowNull: false,
    },

    // Locations
    from_location_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "locations",
        key: "id",
      },
    },
    to_location_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "locations",
        key: "id",
      },
    },

    // Quantity (positive = increase, negative = decrease)
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Positive for additions, negative for removals",
    },

    // Batch tracking
    batch_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Reference
    reference_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "GRN, PICK_ORDER, ADJUSTMENT, etc",
    },
    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "ID of the reference record",
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Audit
    performed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default InventoryTransaction;
