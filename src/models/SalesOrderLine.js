import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const SalesOrderLine = sequelize.define(
  "SalesOrderLine",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "sales_orders",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    line_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Line number within the order (1, 2, 3...)",
    },
    sku_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "skus",
        key: "id",
      },
    },
    ordered_qty: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      comment: "Quantity ordered by customer",
    },
    allocated_qty: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
      comment: "Quantity allocated from inventory",
    },
    picked_qty: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
      comment: "Quantity picked by warehouse",
    },
    packed_qty: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
      comment: "Quantity packed in cartons",
    },
    shipped_qty: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
      comment: "Quantity shipped to customer",
    },
    short_qty: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
      comment: "Shortage quantity (ordered - shipped)",
    },
    uom: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "EA",
      comment: "Unit of measure: EA, BOX, CASE, etc.",
    },
    allocation_rule: {
      type: DataTypes.ENUM("FIFO", "FEFO", "LIFO"),
      allowNull: false,
      defaultValue: "FIFO",
      comment: "How to allocate inventory for this line",
    },
    batch_preference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Specific batch number if customer requires specific batch",
    },
    expiry_date_min: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Minimum acceptable expiry date for this line",
    },
    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: "Price per unit",
    },
    line_total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: "ordered_qty * unit_price",
    },
    discount_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
    },
    discount_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
    },
    tax_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
    },
    tax_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM(
        "PENDING",
        "ALLOCATED",
        "PARTIAL_ALLOCATION",
        "PICKING",
        "PICKED",
        "PACKED",
        "SHIPPED",
        "CANCELLED",
        "SHORT",
      ),
      allowNull: false,
      defaultValue: "PENDING",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "sales_order_lines",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["order_id"] },
      { fields: ["sku_id"] },
      { fields: ["status"] },
      { fields: ["order_id", "line_no"], unique: true },
    ],
  },
);

export default SalesOrderLine;
