import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import bcrypt from "bcrypt";

const User = sequelize.define(
  "users",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    pass_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    last_login: {
      type: DataTypes.DATE,
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
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    hooks: {
      beforeCreate: async (user) => {
        if (user.pass_hash) {
          const salt = await bcrypt.genSalt(10);
          user.pass_hash = await bcrypt.hash(user.pass_hash, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("pass_hash")) {
          const salt = await bcrypt.genSalt(10);
          user.pass_hash = await bcrypt.hash(user.pass_hash, salt);
        }
      },
    },
  },
);

User.prototype.validatePassword = async function (password) {
  return await bcrypt.compare(password, this.pass_hash);
};

// Don't send password in JSON responses
User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.pass_hash;
  return values;
};

export default User;
