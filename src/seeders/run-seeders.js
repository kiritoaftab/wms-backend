import dotenv from "dotenv";
import { testConnection, sequelize } from "../config/database.js";
import { syncDatabase } from "../models/index.js";
import seedDatabase from "./seed.js";

dotenv.config();

const runSeeders = async () => {
  try {
    // Test connection
    await testConnection();

    // Sync database (create tables)
    console.log("Synchronizing database...");
    await syncDatabase({ force: true, alter: true }); // WARNING: This will drop existing tables

    // Run seeders
    await seedDatabase();

    console.log("\n✅ All done! Database is ready.");
    process.exit(0);
  } catch (error) {
    console.error("Error running seeders:", error);
    process.exit(1);
  }
};

runSeeders();
