import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const SalesOrder = sequelize.define(
  "SalesOrder",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "SO-00001",
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
    customer_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "End customer/consignee name",
    },
    customer_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    customer_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    ship_to_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Contact person at delivery address",
    },
    ship_to_address_line1: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ship_to_address_line2: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ship_to_city: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    ship_to_state: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    ship_to_country: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "India",
    },
    ship_to_pincode: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    ship_to_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    order_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    order_type: {
      type: DataTypes.ENUM(
        "STANDARD",
        "EXPRESS",
        "SAME_DAY",
        "NEXT_DAY",
        "RETURN",
        "REPLACEMENT",
      ),
      allowNull: false,
      defaultValue: "STANDARD",
    },
    priority: {
      type: DataTypes.ENUM("NORMAL", "HIGH", "URGENT"),
      allowNull: false,
      defaultValue: "NORMAL",
    },
    sla_due_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When order must be shipped by",
    },
    carrier: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "DHL, FedEx, Blue Dart, UPS, etc.",
    },
    carrier_service: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "STANDARD, EXPRESS, OVERNIGHT, etc.",
    },
    tracking_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "AWB/Tracking number from carrier",
    },
    reference_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Customer PO number or external reference",
    },
    total_lines: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of order lines",
    },
    total_ordered_units: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
      comment: "Total units ordered across all lines",
    },
    total_allocated_units: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
    },
    total_picked_units: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
    },
    total_packed_units: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
    },
    total_shipped_units: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM(
        "DRAFT",
        "CONFIRMED",
        "ALLOCATED",
        "PARTIAL_ALLOCATION",
        "PICKING",
        "PICKED",
        "PACKING",
        "PACKED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "ON_HOLD",
      ),
      allowNull: false,
      defaultValue: "DRAFT",
    },
    allocation_status: {
      type: DataTypes.ENUM("PENDING", "PARTIAL", "FULL", "FAILED"),
      allowNull: true,
      comment: "Allocation sub-status",
    },
    special_instructions: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Gift wrap, fragile, signature required, etc.",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    invoice_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    invoice_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    invoice_value: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "INR",
    },
    payment_mode: {
      type: DataTypes.ENUM("PREPAID", "COD", "CREDIT"),
      allowNull: true,
    },
    cod_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: "Amount to collect on delivery",
    },
    confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    allocated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    picking_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    picking_completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    packing_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    packing_completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    shipped_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: "sales_orders",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["order_no"] },
      { fields: ["warehouse_id"] },
      { fields: ["client_id"] },
      { fields: ["status"] },
      { fields: ["priority"] },
      { fields: ["order_date"] },
      { fields: ["sla_due_date"] },
      { fields: ["tracking_number"] },
      { fields: ["reference_no"] },
      { fields: ["carrier"] },
    ],
  },
);

export default SalesOrder;
