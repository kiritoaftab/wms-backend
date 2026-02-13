import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Carrier = sequelize.define(
  "Carrier",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    carrier_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    carrier_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    carrier_type: {
      type: DataTypes.ENUM("COURIER", "FREIGHT", "OWN_FLEET", "AGGREGATOR"),
      allowNull: false,
      defaultValue: "COURIER",
    },
    contact_person: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    tracking_url_template: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment:
        "URL template with {awb} placeholder, e.g. https://www.delhivery.com/track/package/{awb}",
    },
    account_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Account number with the carrier",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    tableName: "carriers",
    timestamps: true,
    underscored: true,
  },
);

export default Carrier;
