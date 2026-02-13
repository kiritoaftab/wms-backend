import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Shipment = sequelize.define(
  "Shipment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shipment_no: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: "Auto-generated: SHP-00001",
    },
    sales_order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "sales_orders",
        key: "id",
      },
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "warehouses",
        key: "id",
      },
    },
    carrier_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "carriers",
        key: "id",
      },
      comment: "Assigned at shipping time, not at order creation",
    },
    awb_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment:
        "Air Waybill / Tracking number - manual entry or from carrier API",
    },
    total_cartons: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_weight: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      comment: "Sum of all carton gross_weights in kg",
    },
    // Ship-to address (denormalized from sales order for shipping label)
    ship_to_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    ship_to_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ship_to_city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ship_to_state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ship_to_pincode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    ship_to_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Shipping details
    shipping_method: {
      type: DataTypes.ENUM("STANDARD", "EXPRESS", "SAME_DAY", "ECONOMY"),
      allowNull: true,
      defaultValue: "STANDARD",
    },
    estimated_delivery_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    shipping_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "CREATED",
        "DISPATCHED",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "RTO",
        "EXCEPTION",
        "CANCELLED",
      ),
      allowNull: false,
      defaultValue: "CREATED",
    },
    dispatched_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    dispatched_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: "shipments",
    timestamps: true,
    underscored: true,
  },
);

export default Shipment;
