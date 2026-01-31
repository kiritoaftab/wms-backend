import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Location = sequelize.define(
  "locations",
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
    location_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "Unique code: A-01-02, DOCK-01",
    },

    // Hierarchy
    zone: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: "Zone: A, B, C",
    },
    aisle: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: "Aisle: 01, 02, 03",
    },
    rack: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: "Rack: 01, 02",
    },
    level: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: "Level/Shelf: 01, 02, 03",
    },

    // Type & Capacity
    location_type: {
      type: DataTypes.ENUM(
        "DOCK",
        "RECEIVING",
        "STORAGE",
        "STAGING",
        "SHIPPING",
        "QUARANTINE",
      ),
      allowNull: false,
      defaultValue: "STORAGE",
    },

    capacity: {
      type: DataTypes.INTEGER,
      defaultValue: 1000,
      comment: "Maximum units this location can hold",
    },

    current_usage: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Currently occupied units",
    },

    // Flags
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_pickable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Can pick from this location",
    },
    is_putawayable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Can putaway to this location",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["warehouse_id", "location_code"],
      },
    ],
  },
);

export default Location;
