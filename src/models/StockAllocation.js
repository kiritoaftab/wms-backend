import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const StockAllocation = sequelize.define(
  "StockAllocation",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    allocation_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "ALLOC-00001",
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "sales_orders",
        key: "id",
      },
    },
    order_line_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "sales_order_lines",
        key: "id",
      },
    },
    sku_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "skus",
        key: "id",
      },
    },
    inventory_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "inventory",
        key: "id",
      },
      comment: "Which inventory record is allocated",
    },
    location_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "locations",
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
    allocated_qty: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      comment: "Quantity reserved from this inventory",
    },
    consumed_qty: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0,
      comment: "Quantity actually picked/consumed",
    },
    remaining_qty: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      comment: "allocated_qty - consumed_qty",
    },
    batch_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    serial_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    allocation_rule: {
      type: DataTypes.ENUM("FIFO", "FEFO", "LIFO"),
      allowNull: false,
      comment: "Rule used for this allocation",
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "CONSUMED", "RELEASED", "EXPIRED"),
      allowNull: false,
      defaultValue: "ACTIVE",
      comment: "ACTIVE=reserved, CONSUMED=picked, RELEASED=deallocated",
    },
    allocated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    consumed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When picking consumed this allocation",
    },
    released_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When allocation was released back",
    },
    released_reason: {
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
  },
  {
    tableName: "stock_allocations",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["allocation_no"] },
      { fields: ["order_id"] },
      { fields: ["order_line_id"] },
      { fields: ["sku_id"] },
      { fields: ["inventory_id"] },
      { fields: ["location_id"] },
      { fields: ["status"] },
      { fields: ["allocated_at"] },
      { fields: ["warehouse_id"] },
    ],
  },
);

export default StockAllocation;
