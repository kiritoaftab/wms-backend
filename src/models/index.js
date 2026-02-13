import { sequelize } from "../config/database.js";
import User from "./User.js";
import Module from "./Module.js";
import Permission from "./Permission.js";
import Role from "./Role.js";
import RoleModule from "./RoleModule.js";
import UserRole from "./UserRole.js";
import Warehouse from "./Warehouse.js";
import Client from "./Client.js";
import Supplier from "./Supplier.js";
import Dock from "./Dock.js";
import SKU from "./SKU.js";
import Pallet from "./Pallet.js";
import ASN from "./ASN.js";
import ASNLine from "./ASNLine.js";
import ASNLinePallet from "./ASNLinePallet.js";
import GRN from "./GRN.js";
import GRNLine from "./GRNLine.js";
import Location from "./Location.js";
import Inventory from "./Inventory.js";
import InventoryHold from "./InventoryHold.js";
import InventoryTransaction from "./InventoryTransaction.js";
import SalesOrder from "./SaleOrder.js";
import SalesOrderLine from "./SalesOrderLine.js";
import PickWave from "./PIckWave.js";
import PickWaveOrder from "./PickWaveOrder.js";
import PickTask from "./PickTask.js";
import StockAllocation from "./StockAllocation.js";
import Carrier from "./Carrier.js";
import Carton from "./Carton.js";
import CartonItem from "./CartonItem.js";
import Shipment from "./Shipment.js";

// Define Associations

// User <-> Role (Many-to-Many through UserRole)
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: "user_id",
  otherKey: "role_id",
  as: "roles",
});

Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: "role_id",
  otherKey: "user_id",
  as: "users",
});

// Role <-> Module (Many-to-Many through RoleModule with Permission)
Role.belongsToMany(Module, {
  through: { model: RoleModule, unique: false },
  foreignKey: "role_id",
  otherKey: "module_id",
  as: "modules",
});

Module.belongsToMany(Role, {
  through: { model: RoleModule, unique: false },
  foreignKey: "module_id",
  otherKey: "role_id",
  as: "roles",
});

// RoleModule belongs to Permission, Role, and Module
RoleModule.belongsTo(Permission, {
  foreignKey: "permission_id",
  as: "permission",
});

RoleModule.belongsTo(Role, {
  foreignKey: "role_id",
  as: "role",
});

RoleModule.belongsTo(Module, {
  foreignKey: "module_id",
  as: "module",
});

// Self-referencing for User (created_by, updated_by)
User.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

User.belongsTo(User, {
  foreignKey: "updated_by",
  as: "updater",
});

// Role created_by
Role.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

UserRole.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

UserRole.belongsTo(Role, {
  foreignKey: "role_id",
  as: "role",
});

// Dock N-> 1 belongs to Warehouse
Dock.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
  as: "warehouse",
});

Warehouse.hasMany(Dock, {
  foreignKey: "warehouse_id",
  as: "docks",
});

// SKU N-> 1 belongs to Client
SKU.belongsTo(Client, {
  foreignKey: "client_id",
  as: "client",
});

Client.hasMany(SKU, {
  foreignKey: "client_id",
  as: "skus",
});

// Pallet belongs to Warehouse
Pallet.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
  as: "warehouse",
});

Warehouse.hasMany(Pallet, {
  foreignKey: "warehouse_id",
  as: "pallets",
});

// ASN Associations
ASN.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
  as: "warehouse",
});

ASN.belongsTo(Client, {
  foreignKey: "client_id",
  as: "client",
});

ASN.belongsTo(Supplier, {
  foreignKey: "supplier_id",
  as: "supplier",
});

ASN.belongsTo(Dock, {
  foreignKey: "dock_id",
  as: "dock",
});

ASN.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

ASN.belongsTo(User, {
  foreignKey: "updated_by",
  as: "updater",
});

ASN.hasMany(ASNLine, {
  foreignKey: "asn_id",
  as: "lines",
});

// ASN Line Associations
ASNLine.belongsTo(ASN, {
  foreignKey: "asn_id",
  as: "asn",
});

ASNLine.belongsTo(SKU, {
  foreignKey: "sku_id",
  as: "sku",
});

ASNLine.hasMany(ASNLinePallet, {
  foreignKey: "asn_line_id",
  as: "pallets",
});

// ASN Line Pallet Associations
ASNLinePallet.belongsTo(ASNLine, {
  foreignKey: "asn_line_id",
  as: "asn_line",
});

ASNLinePallet.belongsTo(Pallet, {
  foreignKey: "pallet_id",
  as: "pallet",
});

ASNLinePallet.belongsTo(User, {
  foreignKey: "received_by",
  as: "receiver",
});

// GRN Associations
GRN.belongsTo(ASN, {
  foreignKey: "asn_id",
  as: "asn",
});

GRN.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
  as: "warehouse",
});

GRN.belongsTo(User, {
  foreignKey: "posted_by",
  as: "poster",
});

GRN.hasMany(GRNLine, {
  foreignKey: "grn_id",
  as: "lines",
});

// GRN Line Associations
GRNLine.belongsTo(GRN, {
  foreignKey: "grn_id",
  as: "grn",
});

GRNLine.belongsTo(ASNLine, {
  foreignKey: "asn_line_id",
  as: "asn_line",
});

GRNLine.belongsTo(SKU, {
  foreignKey: "sku_id",
  as: "sku",
});

GRNLine.belongsTo(Pallet, {
  foreignKey: "pallet_id",
  as: "pallet",
});

GRNLine.belongsTo(User, {
  foreignKey: "assigned_to",
  as: "assignee",
});

GRNLine.belongsTo(Location, {
  foreignKey: "source_location_id",
  as: "source_location",
});

GRNLine.belongsTo(Location, {
  foreignKey: "destination_location_id",
  as: "destination_location",
});

Pallet.belongsTo(Location, {
  foreignKey: "current_location_id",
  as: "current_location",
});

Location.hasMany(Pallet, {
  foreignKey: "current_location_id",
  as: "pallets",
});

// Location belongs to Warehouse
Location.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
  as: "warehouse",
});

Warehouse.hasMany(Location, {
  foreignKey: "warehouse_id",
  as: "locations",
});

// Inventory Associations
Inventory.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
  as: "warehouse",
});

Inventory.belongsTo(Client, {
  foreignKey: "client_id",
  as: "client",
});

Inventory.belongsTo(SKU, {
  foreignKey: "sku_id",
  as: "sku",
});

Inventory.belongsTo(Location, {
  foreignKey: "location_id",
  as: "location",
});

// Inventory has many Holds
Inventory.hasMany(InventoryHold, {
  foreignKey: "inventory_id",
  as: "holds",
});

InventoryHold.belongsTo(Inventory, {
  foreignKey: "inventory_id",
  as: "inventory",
});

InventoryHold.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

InventoryHold.belongsTo(User, {
  foreignKey: "released_by",
  as: "releaser",
});

// Inventory Transaction Associations
InventoryTransaction.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
  as: "warehouse",
});

InventoryTransaction.belongsTo(SKU, {
  foreignKey: "sku_id",
  as: "sku",
});

InventoryTransaction.belongsTo(Location, {
  foreignKey: "from_location_id",
  as: "from_location",
});

InventoryTransaction.belongsTo(Location, {
  foreignKey: "to_location_id",
  as: "to_location",
});

InventoryTransaction.belongsTo(User, {
  foreignKey: "performed_by",
  as: "performer",
});

// SalesOrder associations
SalesOrder.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
  as: "warehouse",
});
SalesOrder.belongsTo(Client, { foreignKey: "client_id", as: "client" });
SalesOrder.belongsTo(User, { foreignKey: "created_by", as: "creator" });
SalesOrder.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
SalesOrder.hasMany(SalesOrderLine, { foreignKey: "order_id", as: "lines" });
SalesOrder.belongsToMany(PickWave, {
  through: PickWaveOrder,
  foreignKey: "order_id",
  otherKey: "wave_id",
  as: "waves",
});
SalesOrder.hasMany(PickTask, { foreignKey: "order_id", as: "pickTasks" });
SalesOrder.hasMany(StockAllocation, {
  foreignKey: "order_id",
  as: "allocations",
});

SalesOrderLine.belongsTo(SalesOrder, { foreignKey: "order_id", as: "order" });
SalesOrderLine.belongsTo(SKU, { foreignKey: "sku_id", as: "sku" });
SalesOrderLine.hasMany(PickTask, {
  foreignKey: "order_line_id",
  as: "pickTasks",
});
SalesOrderLine.hasMany(StockAllocation, {
  foreignKey: "order_line_id",
  as: "allocations",
});

PickWave.belongsTo(Warehouse, { foreignKey: "warehouse_id", as: "warehouse" });
PickWave.belongsTo(User, { foreignKey: "created_by", as: "creator" });
PickWave.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
PickWave.belongsTo(User, { foreignKey: "released_by", as: "releaser" });
PickWave.belongsToMany(SalesOrder, {
  through: PickWaveOrder,
  foreignKey: "wave_id",
  otherKey: "order_id",
  as: "orders",
});
PickWave.hasMany(PickTask, { foreignKey: "wave_id", as: "tasks" });

PickWaveOrder.belongsTo(PickWave, { foreignKey: "wave_id", as: "wave" });
PickWaveOrder.belongsTo(SalesOrder, { foreignKey: "order_id", as: "order" });

PickTask.belongsTo(PickWave, { foreignKey: "wave_id", as: "wave" });
PickTask.belongsTo(SalesOrder, { foreignKey: "order_id", as: "order" });
PickTask.belongsTo(SalesOrderLine, {
  foreignKey: "order_line_id",
  as: "orderLine",
});
PickTask.belongsTo(SKU, { foreignKey: "sku_id", as: "sku" });
PickTask.belongsTo(Inventory, { foreignKey: "inventory_id", as: "inventory" });
PickTask.belongsTo(Location, {
  foreignKey: "source_location_id",
  as: "sourceLocation",
});
PickTask.belongsTo(Location, {
  foreignKey: "staging_location_id",
  as: "stagingLocation",
});
PickTask.belongsTo(User, { foreignKey: "assigned_to", as: "picker" });
PickTask.belongsTo(User, { foreignKey: "created_by", as: "creator" });
PickTask.belongsTo(User, { foreignKey: "updated_by", as: "updater" });

StockAllocation.belongsTo(SalesOrder, { foreignKey: "order_id", as: "order" });
StockAllocation.belongsTo(SalesOrderLine, {
  foreignKey: "order_line_id",
  as: "orderLine",
});
StockAllocation.belongsTo(SKU, { foreignKey: "sku_id", as: "sku" });
StockAllocation.belongsTo(Inventory, {
  foreignKey: "inventory_id",
  as: "inventory",
});
StockAllocation.belongsTo(Location, {
  foreignKey: "location_id",
  as: "location",
});
StockAllocation.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
  as: "warehouse",
});
StockAllocation.belongsTo(User, { foreignKey: "created_by", as: "creator" });

Inventory.hasMany(PickTask, { foreignKey: "inventory_id", as: "pickTasks" });
Inventory.hasMany(StockAllocation, {
  foreignKey: "inventory_id",
  as: "allocations",
});

Location.hasMany(PickTask, {
  foreignKey: "source_location_id",
  as: "pickTasksFrom",
});
Location.hasMany(PickTask, {
  foreignKey: "staging_location_id",
  as: "pickTasksStaging",
});
Location.hasMany(StockAllocation, {
  foreignKey: "location_id",
  as: "allocations",
});

SKU.hasMany(SalesOrderLine, { foreignKey: "sku_id", as: "orderLines" });
SKU.hasMany(PickTask, { foreignKey: "sku_id", as: "pickTasks" });
SKU.hasMany(StockAllocation, { foreignKey: "sku_id", as: "allocations" });

Warehouse.hasMany(SalesOrder, {
  foreignKey: "warehouse_id",
  as: "salesOrders",
});
Warehouse.hasMany(PickWave, { foreignKey: "warehouse_id", as: "pickWaves" });
Warehouse.hasMany(StockAllocation, {
  foreignKey: "warehouse_id",
  as: "allocations",
});
Client.hasMany(SalesOrder, { foreignKey: "client_id", as: "salesOrders" });

User.hasMany(SalesOrder, { foreignKey: "created_by", as: "createdOrders" });
User.hasMany(PickWave, { foreignKey: "created_by", as: "createdWaves" });
User.hasMany(PickWave, { foreignKey: "released_by", as: "releasedWaves" });
User.hasMany(PickTask, { foreignKey: "assigned_to", as: "assignedPickTasks" });
User.hasMany(StockAllocation, {
  foreignKey: "created_by",
  as: "createdAllocations",
});

Carrier.belongsTo(User, { as: "creator", foreignKey: "created_by" });
Carrier.belongsTo(User, { as: "updater", foreignKey: "updated_by" });

// --- Carton ---
Carton.belongsTo(SalesOrder, { foreignKey: "sales_order_id" });
Carton.belongsTo(Warehouse, { foreignKey: "warehouse_id" });
Carton.belongsTo(User, { as: "packer", foreignKey: "packed_by" });
Carton.belongsTo(User, { as: "creator", foreignKey: "created_by" });
Carton.hasMany(CartonItem, { foreignKey: "carton_id", as: "items" });

SalesOrder.hasMany(Carton, { foreignKey: "sales_order_id", as: "cartons" });

// --- CartonItem ---
CartonItem.belongsTo(Carton, { foreignKey: "carton_id" });
CartonItem.belongsTo(SalesOrderLine, { foreignKey: "sales_order_line_id" });
CartonItem.belongsTo(SKU, { foreignKey: "sku_id" });

// --- Shipment ---
Shipment.belongsTo(SalesOrder, { foreignKey: "sales_order_id" });
Shipment.belongsTo(Warehouse, { foreignKey: "warehouse_id" });
Shipment.belongsTo(Carrier, { foreignKey: "carrier_id" });
Shipment.belongsTo(User, { as: "dispatcher", foreignKey: "dispatched_by" });
Shipment.belongsTo(User, { as: "creator", foreignKey: "created_by" });

SalesOrder.hasOne(Shipment, { foreignKey: "sales_order_id", as: "shipment" });
Carrier.hasMany(Shipment, { foreignKey: "carrier_id", as: "shipments" });

// Sync function
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log("✅ All models synchronized successfully.");
  } catch (error) {
    console.error("❌ Error synchronizing models:", error);
    throw error;
  }
};

export {
  sequelize,
  User,
  Module,
  Permission,
  Role,
  RoleModule,
  UserRole,
  Warehouse,
  Client,
  Supplier,
  Dock,
  SKU,
  ASN,
  ASNLine,
  ASNLinePallet,
  GRN,
  GRNLine,
  Pallet,
  Location,
  Inventory,
  InventoryHold,
  InventoryTransaction,
  SalesOrder,
  SalesOrderLine,
  PickWave,
  PickWaveOrder,
  PickTask,
  StockAllocation,
  Carrier,
  Carton,
  CartonItem,
  Shipment,
  syncDatabase,
};
