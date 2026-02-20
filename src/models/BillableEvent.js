import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const BillableEvent = sequelize.define(
  "BillableEvent",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    event_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: "Auto-generated: EVT-00001",
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
    charge_type: {
      type: DataTypes.ENUM(
        "STORAGE",
        "INBOUND_HANDLING",
        "PUTAWAY",
        "PICKING",
        "PACKING",
        "SHIPPING_ADMIN",
        "VALUE_ADDED_SERVICE",
        "MANUAL",
        "OTHER",
      ),
      allowNull: false,
    },
    // What triggered this event
    reference_type: {
      type: DataTypes.ENUM(
        "GRN",
        "PUTAWAY",
        "SALES_ORDER",
        "SHIPMENT",
        "STORAGE_PERIOD",
        "MANUAL",
      ),
      allowNull: false,
    },
    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment:
        "FK to the source record (grn.id, sales_order.id, shipment.id, etc.)",
    },
    reference_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment:
        "Human readable ref: GRN-00001, ORD-00001, or date range for storage",
    },
    // Billing calculation
    billing_basis: {
      type: DataTypes.STRING(30),
      allowNull: false,
      comment:
        "Copied from rate card at time of event: PER_UNIT, PER_PALLET_PER_DAY, etc.",
    },
    qty: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: "Billable quantity: units, pallets, days, etc.",
    },
    rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Rate applied from rate card",
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: "Calculated: qty * rate (or custom for storage)",
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "INR",
    },
    rate_card_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "rate_cards",
        key: "id",
      },
      comment: "Which rate card was used. Null for manual charges",
    },
    // Storage-specific fields
    storage_start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "For STORAGE type: period start",
    },
    storage_end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "For STORAGE type: period end",
    },
    storage_details: {
      type: DataTypes.JSON,
      allowNull: true,
      comment:
        "For STORAGE: daily breakdown { day: qty } calculated from InventoryTransaction",
    },
    // Event metadata
    event_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "When the billable activity occurred",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Auto-generated or manual description of the charge",
    },
    status: {
      type: DataTypes.ENUM("PENDING", "READY", "BLOCKED", "INVOICED", "VOID"),
      allowNull: false,
      defaultValue: "PENDING",
      comment:
        "PENDING=calculated, READY=reviewed, BLOCKED=missing rate card, INVOICED=on an invoice",
    },
    blocked_reason: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment:
        "Why this event is blocked, e.g. 'Missing rate card for STORAGE'",
    },
    invoice_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "invoices",
        key: "id",
      },
      comment: "Set when this event is included in an invoice",
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
    tableName: "billable_events",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["client_id", "status"],
        name: "idx_billable_event_client_status",
      },
      {
        fields: ["warehouse_id", "event_date"],
        name: "idx_billable_event_wh_date",
      },
      {
        fields: ["reference_type", "reference_id"],
        name: "idx_billable_event_reference",
      },
    ],
  },
);

export default BillableEvent;
