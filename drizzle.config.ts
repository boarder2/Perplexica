import { defineConfig } from 'drizzle-kit';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || process.cwd();

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: path.join(DATA_DIR, 'data', 'db.sqlite'),
  },
});
