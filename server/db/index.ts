import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

/**
 * Database connection using postgres-js driver.
 * Per Constitution Section D: MUST use postgres-js, NOT @neondatabase/serverless.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create postgres connection
const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance with schema
export const db = drizzle(queryClient, { schema });

// Export query client for direct queries if needed
export { queryClient };

// Export schema for type inference
export * from './schema.js';

// Close database connection
export async function closeDatabase() {
  await queryClient.end();
}
