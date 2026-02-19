import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const ASN = sequelize.define(
  "asns",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    asn_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "Auto-generated: ASN-10293",
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
    supplier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "suppliers",
        key: "id",
      },
    },
    dock_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "docks",
        key: "id",
      },
    },

    // Reference
    reference_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Client PO reference: PO-99283-A",
    },

    // ETA
    eta: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Expected Time of Arrival",
    },

    // Shipment Details
    transporter_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "e.g., FedEx, UPS",
    },
    vehicle_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "e.g., NY-8829",
    },
    driver_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    driver_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    // Counts
    total_lines: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Total number of SKU lines",
    },
    total_expected_units: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Total expected units across all lines",
    },
    total_received_units: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Total received units",
    },
    total_damaged_units: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Total damaged units",
    },
    total_shortage_units: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Total shortage units",
    },

    // Status
    status: {
      type: DataTypes.ENUM(
        "DRAFT",
        "CREATED",
        "CONFIRMED",
        "IN_RECEIVING",
        "GRN_POSTED",
        "PUTAWAY_PENDING",
        "CLOSED",
      ),
      defaultValue: "DRAFT",
    },

    // Special Handling (JSON array)
    special_handling: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array: ["FRAGILE", "COLD_CHAIN", "TOP_LOAD_ONLY", "HAZARDOUS"]',
    },

    // Attachments (S3 links)
    attachments: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of S3 URLs: ["https://s3.../file1.pdf", ...]',
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Timestamps for status changes
    confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    receiving_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    grn_posted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    putaway_completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Audit
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
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default ASN;
