import { pgTable, text, timestamp, jsonb, uuid, unique } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  githubRepoUrl: text('github_repo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const harnessFiles = pgTable('harness_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  filePath: text('file_path').notNull(),
  content: text('content').notNull(),
  fileHash: text('file_hash').notNull(),
  lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.projectId, t.filePath),
}))

export const harnessAnalyses = pgTable('harness_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  filesHash: text('files_hash').notNull(),
  scores: jsonb('scores').$type<{ context: number; enforcement: number; gc: number }>().notNull(),
  recommendations: jsonb('recommendations').$type<Recommendation[]>().notNull(),
  tokenUsage: jsonb('token_usage').$type<{ promptTokens: number; completionTokens: number; totalTokens: number } | null>().default(null),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const harnessVersions = pgTable('harness_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  fileId: uuid('file_id').references(() => harnessFiles.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Recommendation = {
  priority: 'urgent' | 'high' | 'medium'
  category: 'context' | 'enforcement' | 'gc'
  title: string
  description: string
  action: string
}
