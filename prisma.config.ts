
import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  datasource: {
    // The CLI (migrations, db pull, etc.) will use the DIRECT_URL
    // The Application (Runtime) will use DATABASE_URL via its constructor/adapter
    url: process.env.DIRECT_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
