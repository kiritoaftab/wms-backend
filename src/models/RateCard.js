import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const RateCard = sequelize.define(
  "RateCard",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    rate_card_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "e.g. 'Acme Standard Storage', 'Beta Ltd Inbound Handling'",
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "clients",
        key: "id",
      },
      comment: "Client-specific rate card",
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "warehouses",
        key: "id",
      },
      comment: "Nullable = applies to all warehouses for this client",
    },
    charge_type: {
      type: DataTypes.ENUM(
        "STORAGE",
        "INBOUND_HANDLING",
        "PUTAWAY",
        "PICKING",
        "PACKING",
        "SHIPPING_ADMIN",
        "VALUE_ADDED_SERVICE",
        "OTHER",
      ),
      allowNull: false,
    },
    billing_basis: {
      type: DataTypes.ENUM(
        "PER_UNIT_PER_DAY",
        "PER_PALLET_PER_DAY",
        "PER_SQFT_PER_DAY",
        "PER_UNIT",
        "PER_PALLET",
        "PER_CASE",
        "PER_LINE",
        "PER_ORDER",
        "PER_CARTON",
        "PER_SHIPMENT",
        "PER_KG",
        "FLAT_RATE",
      ),
      allowNull: false,
    },
    rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Rate amount in currency",
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "INR",
    },
    min_charge: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Minimum charge per billing period, if applicable",
    },
    effective_from: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Rate effective from this date",
    },
    effective_to: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Null = currently active, set when rate is superseded",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "rate_cards",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["client_id", "charge_type", "is_active"],
        name: "idx_rate_card_client_charge",
      },
    ],
  },
);

export default RateCard;
