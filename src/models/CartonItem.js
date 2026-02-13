import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const CartonItem = sequelize.define(
  "CartonItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    carton_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "cartons",
        key: "id",
      },
    },
    sales_order_line_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "sales_order_lines",
        key: "id",
      },
      comment: "Which order line this item belongs to",
    },
    sku_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "skus",
        key: "id",
      },
    },
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Quantity of this SKU packed in this carton",
    },
    batch_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "From picked inventory",
    },
    serial_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "carton_items",
    timestamps: true,
    underscored: true,
  },
);

export default CartonItem;
