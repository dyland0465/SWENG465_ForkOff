import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger";
import apiClients from "./services/api";

//creates the application instance and sets up the middleware for JSON parsing, Swagger UI documentation, and API clients routing.
const app = express();
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(apiClients);

app.get("/", (req, res) => {

});

export default app;
