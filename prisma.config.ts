import { config } from 'dotenv';
import type { PrismaConfig } from 'prisma';
import { env } from 'prisma/config';

// Load .env.local first (takes precedence), then .env
config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
} satisfies PrismaConfig;


