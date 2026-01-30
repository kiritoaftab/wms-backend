import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Client = sequelize.define(
  "clients",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    client_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    client_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "e.g., CLI-001",
    },
    contact_person: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    billing_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    billing_type: {
      type: DataTypes.ENUM("PREPAID", "POSTPAID", "COD"),
      defaultValue: "POSTPAID",
    },
    payment_terms: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "e.g., NET30, NET60, IMMEDIATE",
    },
    tax_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "GST/VAT/TAX ID",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default Client;
