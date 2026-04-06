import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

// Use a placeholder during build-time module evaluation when DATABASE_URL is absent.
// The actual connection string is required at request time (runtime).
const sql = neon(process.env.DATABASE_URL ?? 'postgresql://user:pass@placeholder.host/db')
export const db = drizzle(sql, { schema })
