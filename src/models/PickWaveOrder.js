import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const PickWaveOrder = sequelize.define(
  "PickWaveOrder",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    wave_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "pick_waves",
        key: "id",
      },
      onDelete: "CASCADE",
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
    added_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "When this order was added to the wave",
    },
  },
  {
    tableName: "pick_wave_orders",
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ["wave_id"] },
      { fields: ["order_id"] },
      { fields: ["wave_id", "order_id"], unique: true },
    ],
  },
);

export default PickWaveOrder;
