import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Pallet = sequelize.define(
  "pallets",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    pallet_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "Unique barcode/ID e.g., P-10023",
    },
    pallet_type: {
      type: DataTypes.ENUM("STANDARD", "EURO", "CUSTOM", "GAYLORD"),
      defaultValue: "STANDARD",
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "warehouses",
        key: "id",
      },
    },
    current_location: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Current location: DOCK-01, BIN-A-01-02, etc",
    },
    status: {
      type: DataTypes.ENUM(
        "IN_RECEIVING",
        "IN_STORAGE",
        "IN_PICKING",
        "IN_STAGING",
        "EMPTY",
        "DAMAGED",
      ),
      defaultValue: "EMPTY",
    },
    is_mixed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "True if multiple SKUs on same pallet",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default Pallet;
