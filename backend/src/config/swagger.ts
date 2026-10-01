  import swaggerJsdoc from "swagger-jsdoc";

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
          url: "http://localhost:3000",
          description: "Local development server",
        },
        {
        url: "http://obt92niiz8kgddbd9qo97itt.45.8.201.95.sslip.io",
        description: "VPS",
      },
      ],
    },

    // Swagger will scan these files for @swagger comments
    apis: ["./src/**/*.ts"],
  };

  const swaggerSpec = swaggerJsdoc(swaggerOptions);

  export default swaggerSpec;
