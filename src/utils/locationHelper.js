import { Location, sequelize } from "../models/index.js";
import { Op } from "sequelize";

/**
 * Get or create a receiving/dock location for a warehouse
 * @param {number} warehouseId
 * @param {string} dockCode - Optional dock code
 * @returns {Promise<Location>}
 */
const getReceivingLocation = async (warehouseId, dockCode = null) => {
  let locationCode = dockCode || "RECEIVING";

  // Try to find existing location
  let location = await Location.findOne({
    where: {
      warehouse_id: warehouseId,
      location_code: locationCode,
    },
  });

  // If not found, create a default receiving location
  if (!location) {
    location = await Location.create({
      warehouse_id: warehouseId,
      location_code: locationCode,
      location_type: "RECEIVING",
      zone: null,
      capacity: 10000, // Large capacity for receiving area
      is_active: true,
      is_pickable: false,
      is_putawayable: false,
    });
  }

  return location;
};

/**
 * Find suggested putaway location for a SKU
 * Based on: zone preference, available capacity, proximity
 * @param {number} warehouseId
 * @param {object} sku - SKU object with putaway_zone
 * @param {number} qty - Quantity to putaway
 * @returns {Promise<Location|null>}
 */
const suggestPutawayLocation = async (warehouseId, sku, qty) => {
  // Build query criteria
  const whereClause = {
    warehouse_id: warehouseId,
    location_type: "STORAGE",
    is_active: true,
    is_putawayable: true,
  };
  //TODO : Ask regarding this to PM
  // Prefer SKU's putaway zone if specified
  //   if (sku.putaway_zone) {
  //     whereClause.zone = sku.putaway_zone;
  //   }
  console.log(
    "Suggesting location with criteria:",
    whereClause,
    "for qty:",
    qty,
  );

  // Find location with enough capacity
  const location = await Location.findOne({
    where: {
      ...whereClause,
      // capacity - current_usage >= qty
      [Op.and]: [sequelize.literal(`(capacity - current_usage) >= ${qty}`)],
    },
    order: [
      ["zone", "ASC"], // Prefer closer zones
      ["current_usage", "ASC"], // Prefer emptier locations
    ],
  });

  return location;
};

export { getReceivingLocation, suggestPutawayLocation };
