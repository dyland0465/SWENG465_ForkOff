import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";
import apiClients from "./apiClients";

//creates the application instance and sets up the middleware for JSON parsing, Swagger UI documentation, and API clients routing.
const app = express();
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(apiClients);

export default app;