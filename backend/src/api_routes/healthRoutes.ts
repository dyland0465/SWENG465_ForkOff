/**
 * healthRoutes.ts
 *
 * GET /api/health — reports whether the API is running and connected to MongoDB.
 * Used by the deployment platform's health check.
 */
import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

/** @swagger
 * /api/health/:
 *   get:
 *     summary: Check API and database health.
 *     tags: [health]
 *     responses:
 *       200: { description: API and MongoDB are healthy. }
 *       503: { description: MongoDB is unavailable. }
 */
router.get("/api/health/", (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  return res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
    database: databaseConnected ? "connected" : "disconnected",
  });
});

export default router;
