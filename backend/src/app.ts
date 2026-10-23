import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./Config/swagger";
import lobbyApi from "./services/lobbyApi";
import { originGuard, sessionMiddleware } from "./services/session";
import { HttpError } from "./services/lobbyState";
import type { Request, Response, NextFunction } from "express";
import apiClients from "./services/api";

//creates the application instance and sets up the middleware for JSON parsing, Swagger UI documentation, and API clients routing.
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));
app.use(originGuard);
app.use(sessionMiddleware);
app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(lobbyApi);
app.use(apiClients);
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = error instanceof HttpError ? error.status : (error as { status?: number })?.status === 400 ? 400 : 500;
  if (status === 500) console.error("API request failed:", error);
  res.status(status).json({ message: error instanceof HttpError ? error.message : status === 400 ? "Invalid JSON request." : "Request failed. Please try again." });
});

const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

app.use(express.static(frontendDistPath));

app.get("/", (_req, res) => {
  if (!existsSync(frontendIndexPath)) {
    return res.status(404).json({
      message: "Frontend build not found. Run the frontend build first.",
    });
  }

  return res.sendFile(frontendIndexPath);
});

// Let the client-side router handle direct navigation to frontend routes such
// as /lobbies/join, while keeping unknown API paths as JSON 404 responses.
app.use((req, res, next) => {
  if (req.path === "/api" || req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "API endpoint not found." });
  }
  return next();
});

app.get(/.*/, (_req, res) => {
  if (!existsSync(frontendIndexPath)) {
    return res.status(404).json({
      message: "Frontend build not found. Run the frontend build first.",
    });
  }

  return res.sendFile(frontendIndexPath);
});

export default app;
