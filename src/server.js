import dotenv from "dotenv";
import express from "express";
import https from "https";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

import { testConnection } from "./config/database.js";
import { syncDatabase } from "./models/index.js";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/api", routes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "WMS Backend API",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      users: "/api/users",
    },
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Initialize server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Sync database (don't use { force: true } in production!)
    await syncDatabase();

    const isProduction = process.env.NODE_ENV === "production";
    const domain = process.env.DOMAIN || "localhost";

    if (isProduction && process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
      const sslOptions = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH),
      };

      // HTTPS server
      https.createServer(sslOptions, app).listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════╗
║   🚀 WMS Backend Server Running       ║
║                                        ║
║   Environment: ${process.env.NODE_ENV?.padEnd(23)}║
║   Port: ${PORT.toString().padEnd(31)}║
║   URL: https://${domain}:${PORT.toString().padEnd(14)}║
║   SSL: Enabled                         ║
╚════════════════════════════════════════╝
        `);
      });
    } else {
      // HTTP server (development)
      app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════╗
║   🚀 WMS Backend Server Running       ║
║                                        ║
║   Environment: ${process.env.NODE_ENV?.padEnd(23)}║
║   Port: ${PORT.toString().padEnd(31)}║
║   URL: http://localhost:${PORT.toString().padEnd(15)}║
╚════════════════════════════════════════╝
        `);
      });
    }
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export default app;
