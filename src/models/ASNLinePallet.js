import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const ASNLinePallet = sequelize.define(
  "asn_line_pallets",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    asn_line_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "asn_lines",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    pallet_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "pallets",
        key: "id",
      },
    },

    // Batch/Serial/Expiry tracking
    batch_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Batch number: B-2023-X",
    },
    serial_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Serial number (if SKU requires serial tracking)",
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Expiry date (if SKU requires expiry tracking)",
    },

    // Quantities on this pallet
    good_qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Good/acceptable quantity",
    },
    damaged_qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Damaged quantity",
    },

    // Receiving details
    received_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    received_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      comment: "User who scanned/received this pallet",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default ASNLinePallet;
