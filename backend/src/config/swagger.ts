  import swaggerJsdoc from "swagger-jsdoc";
  import { policyFor } from "../middleware/rateLimit";

  const swaggerOptions: swaggerJsdoc.Options = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "ForkOff API",
        version: "1.0.0",
        description: "API documentation for the ForkOff backend",
      },
      servers: [
        {
          url: "https://forkoff.duckdns.org",
          description: "Production",
        },
        {
          url: "http://localhost:3000",
          description: "Local development server",
        },
      ],
    },

    // Swagger will scan these files for @swagger comments
    apis: ["./src/**/*.ts"],
  };

  const swaggerSpec = swaggerJsdoc(swaggerOptions);

  // Apply security requirements consistently to every generated operation.
  const paths = swaggerSpec.paths as Record<string, Record<string, any>>;
  for (const [path, operations] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      const protectedOperation = path.startsWith("/api/saved/") || path.startsWith("/api/admin/") ||
        path === "/api/users/{id}" ||
        (path.startsWith("/api/lobbies/{id}") && !(path.endsWith("/join") && method === "post")) ||
        (path === "/api/restaurants/{id}" && ["patch", "delete"].includes(method)) ||
        (path === "/api/restaurants/{id}/menu" && method === "patch") ||
        path === "/api/restaurants/{id}/analytics";
      if (protectedOperation) {
        operation.security = [{ lobbySession: [] }];
        operation.responses ??= {};
        operation.responses["401"] ??= { description: "A valid session is required." };
        operation.responses["403"] ??= { description: "The session is not authorized for this resource." };
      }
      if (policyFor(method.toUpperCase(), path)) {
        operation.responses ??= {};
        operation.responses["429"] ??= { description: "Rate limit exceeded; see Retry-After." };
        operation.responses["503"] ??= { description: "Rate limit or upstream service unavailable." };
      }
    }
  }

  export default swaggerSpec;
