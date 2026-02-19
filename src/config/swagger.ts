import swaggerJsdoc from 'swagger-jsdoc';
import { ORGANIZATION } from '../common/constants';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: `${ORGANIZATION.NAME} API`,
      version: '1.0.0',
      description: 'API documentation for the Lost & Found Platform',
      contact: {
        name: 'Support',
        email: ORGANIZATION.SUPPORT_EMAIL,
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'STAFF', 'CLAIMANT'] },
            isEmailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Item: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            category: { type: 'string' },
            description: { type: 'string' },
            locationFound: { type: 'string' },
            dateFound: { type: 'string', format: 'date-time' },
            status: { type: 'string' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.controller.ts', './src/modules/**/*.routes.ts', './dist/modules/**/*.controller.js', './dist/modules/**/*.routes.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
