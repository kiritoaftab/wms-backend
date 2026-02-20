import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Invoice = sequelize.define(
  "Invoice",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    invoice_no: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
      comment: "Auto-generated: INV-2026-0001",
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "warehouses",
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
    // Billing period
    period_start: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    period_end: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    invoice_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Calculated from client payment_terms",
    },
    // Amounts
    subtotal: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Sum of all billable event amounts before tax",
    },
    // GST fields for Indian market
    // Same state: CGST + SGST, Different state: IGST
    cgst_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 9.0,
      comment: "Central GST rate %",
    },
    cgst_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      defaultValue: 0,
    },
    sgst_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 9.0,
      comment: "State GST rate %",
    },
    sgst_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      defaultValue: 0,
    },
    igst_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
      comment: "Integrated GST rate % (for inter-state)",
    },
    igst_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      defaultValue: 0,
    },
    tax_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Total tax = CGST + SGST or IGST",
    },
    total_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Grand total = subtotal + tax_amount",
    },
    // Payment tracking
    paid_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Total payments received so far",
    },
    balance_due: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "total_amount - paid_amount",
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "INR",
    },
    // Tax identifiers
    supplier_gstin: {
      type: DataTypes.STRING(15),
      allowNull: true,
      comment: "Warehouse operator GSTIN",
    },
    client_gstin: {
      type: DataTypes.STRING(15),
      allowNull: true,
      comment: "Client GSTIN",
    },
    place_of_supply: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "State code for GST determination",
    },
    hsn_sac_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "996719",
      comment: "SAC code for warehousing services",
    },
    status: {
      type: DataTypes.ENUM(
        "DRAFT",
        "SENT",
        "PARTIAL",
        "PAID",
        "OVERDUE",
        "VOID",
        "CANCELLED",
      ),
      allowNull: false,
      defaultValue: "DRAFT",
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When fully paid",
    },
    notes: {
      type: DataTypes.TEXT,
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
    tableName: "invoices",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["client_id", "status"],
        name: "idx_invoice_client_status",
      },
      {
        fields: ["due_date", "status"],
        name: "idx_invoice_due_status",
      },
    ],
  },
);

export default Invoice;
