import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger";
import apiClients from "./services/api";

//creates the application instance and sets up the middleware for JSON parsing, Swagger UI documentation, and API clients routing.
const app = express();
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(apiClients);

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

export default app;
