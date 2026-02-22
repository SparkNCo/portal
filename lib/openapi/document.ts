import { registry } from './registry';

export const openApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'API Documentation',
    version: '1.0.0',
    description: 'API documentation generated from route handlers',
  },
  paths: registry.getPaths(),
  components: {
    schemas: registry.getSchemas(),
  },
};
