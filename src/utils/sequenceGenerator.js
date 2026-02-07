import SalesOrder from "../models/SaleOrder.js";
import StockAllocation from "../models/StockAllocation.js";
import PickWave from "../models/PIckWave.js";
import PickTask from "../models/PickTask.js";
import { sequelize } from "../config/database.js";
/**
 * Generate sequential Sales Order number
 * Format: SO-00001
 */
export async function generateOrderNo() {
  const lastOrder = await SalesOrder.findOne({
    order: [["id", "DESC"]],
    attributes: ["order_no"],
  });

  if (!lastOrder) {
    return "SO-00001";
  }

  const lastNumber = parseInt(lastOrder.order_no.split("-")[1]);
  const nextNumber = lastNumber + 1;
  return `SO-${String(nextNumber).padStart(5, "0")}`;
}

/**
 * Generate sequential Allocation number
 * Format: ALLOC-00001
 */
export async function generateAllocationNo(transaction) {
  // Atomically increment and store the value
  await sequelize.query(
    `
    UPDATE allocation_sequences
    SET current_value = LAST_INSERT_ID(current_value + 1)
    WHERE name = 'ALLOC'
    `,
    { transaction },
  );

  // Fetch the incremented value
  const [[{ value }]] = await sequelize.query(
    `SELECT LAST_INSERT_ID() AS value`,
    { transaction },
  );

  return `ALLOC-${String(value).padStart(5, "0")}`;
}

/**
 * Generate sequential Wave number
 * Format: PW-00001
 */
export async function generateWaveNo() {
  const lastWave = await PickWave.findOne({
    order: [["id", "DESC"]],
    attributes: ["wave_no"],
  });

  if (!lastWave) {
    return "PW-00001";
  }

  const lastNumber = parseInt(lastWave.wave_no.split("-")[1]);
  const nextNumber = lastNumber + 1;
  return `PW-${String(nextNumber).padStart(5, "0")}`;
}

/**
 * Generate sequential Pick Task number
 * Format: PICK-00001
 */
export async function generatePickTaskNo(transaction) {
  // Increment sequence atomically
  await sequelize.query(
    `
    UPDATE allocation_sequences
    SET current_value = LAST_INSERT_ID(current_value + 1)
    WHERE name = 'PICK'
    `,
    { transaction },
  );

  // Fetch incremented value (connection-scoped)
  const [[{ value }]] = await sequelize.query(
    `SELECT LAST_INSERT_ID() AS value`,
    { transaction },
  );

  return `PICK-${String(value).padStart(5, "0")}`;
}
