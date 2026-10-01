import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";
import apiClients from "./apiClients";

const app = express();
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(apiClients);

export default app;