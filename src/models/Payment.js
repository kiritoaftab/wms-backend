import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Payment = sequelize.define(
  "Payment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    payment_no: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: "Auto-generated: PAY-00001",
    },
    invoice_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "invoices",
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
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "INR",
    },
    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    payment_method: {
      type: DataTypes.ENUM(
        "BANK_TRANSFER",
        "NEFT",
        "RTGS",
        "UPI",
        "CHEQUE",
        "CASH",
        "CREDIT_NOTE",
        "OTHER",
      ),
      allowNull: false,
    },
    reference_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "UTR number, cheque number, UPI ref, etc.",
    },
    bank_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    tds_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      defaultValue: 0,
      comment: "TDS deducted by client, if any",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("RECORDED", "CONFIRMED", "REVERSED"),
      allowNull: false,
      defaultValue: "RECORDED",
    },
    recorded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    confirmed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: "payments",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["invoice_id"],
        name: "idx_payment_invoice",
      },
      {
        fields: ["client_id", "payment_date"],
        name: "idx_payment_client_date",
      },
    ],
  },
);

export default Payment;
