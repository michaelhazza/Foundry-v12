import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// AUDIT COLUMNS (Applied to all tables)
// ============================================================================

const auditColumns = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
};

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  ...auditColumns,
});

// ============================================================================
// USERS
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name: text('name'),
    role: text('role').notNull().default('member'), // 'admin' | 'member'
    ...auditColumns,
  },
  (table) => ({
    organizationIdx: index('users_organization_idx').on(table.organizationId),
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  })
);

// ============================================================================
// INVITATIONS
// ============================================================================

export const invitations = pgTable(
  'invitations',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    invitedById: integer('invited_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    role: text('role').notNull().default('member'),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    ...auditColumns,
  },
  (table) => ({
    organizationIdx: index('invitations_organization_idx').on(table.organizationId),
    tokenIdx: uniqueIndex('invitations_token_idx').on(table.token),
    emailOrgIdx: index('invitations_email_org_idx').on(table.email, table.organizationId),
  })
);

// ============================================================================
// PASSWORD RESETS
// ============================================================================

export const passwordResets = pgTable(
  'password_resets',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('password_resets_user_idx').on(table.userId),
  })
);

// ============================================================================
// PROJECTS
// ============================================================================

export const projects = pgTable(
  'projects',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    deletedAt: timestamp('deleted_at'),
    ...auditColumns,
  },
  (table) => ({
    organizationIdx: index('projects_organization_idx').on(table.organizationId),
    nameOrgIdx: uniqueIndex('projects_name_org_idx')
      .on(table.organizationId, table.name)
      .where(sql`deleted_at IS NULL`),
  })
);

// ============================================================================
// SOURCES
// ============================================================================

export const sources = pgTable(
  'sources',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'file' | 'teamwork_desk'
    status: text('status').notNull().default('pending'), // 'pending' | 'connected' | 'syncing' | 'ready' | 'error'

    // File source fields
    fileName: text('file_name'),
    filePath: text('file_path'),
    fileSize: integer('file_size'),
    fileType: text('file_type'),

    // API source fields (Teamwork Desk)
    apiKey: text('api_key'), // ENCRYPTED
    apiSubdomain: text('api_subdomain'),
    dataTypes: jsonb('data_types'),

    // Cached data
    cachedData: jsonb('cached_data'),
    cachedAt: timestamp('cached_at'),
    cacheExpiresAt: timestamp('cache_expires_at'),

    // Detected schema
    detectedFields: jsonb('detected_fields'),

    lastSyncAt: timestamp('last_sync_at'),
    lastError: text('last_error'),
    ...auditColumns,
  },
  (table) => ({
    projectIdx: index('sources_project_idx').on(table.projectId),
    statusIdx: index('sources_status_idx').on(table.status),
  })
);

// ============================================================================
// SCHEMA MAPPINGS
// ============================================================================

export const schemaMappings = pgTable(
  'schema_mappings',
  {
    id: serial('id').primaryKey(),
    sourceId: integer('source_id')
      .notNull()
      .unique()
      .references(() => sources.id, { onDelete: 'cascade' }),
    mappings: jsonb('mappings').notNull().default([]),
    targetSchema: text('target_schema').notNull().default('conversation'),
    isConfigured: boolean('is_configured').notNull().default(false),
    ...auditColumns,
  },
  (table) => ({
    sourceIdx: uniqueIndex('schema_mappings_source_idx').on(table.sourceId),
  })
);

// ============================================================================
// DEIDENTIFICATION CONFIGS
// ============================================================================

export const deidentificationConfigs = pgTable(
  'deidentification_configs',
  {
    id: serial('id').primaryKey(),
    sourceId: integer('source_id')
      .notNull()
      .unique()
      .references(() => sources.id, { onDelete: 'cascade' }),
    enabledTypes: jsonb('enabled_types').notNull().default([]),
    customPatterns: jsonb('custom_patterns').notNull().default([]),
    maskingStrategy: text('masking_strategy').notNull().default('replacement'),
    isConfigured: boolean('is_configured').notNull().default(false),
    ...auditColumns,
  },
  (table) => ({
    sourceIdx: uniqueIndex('deidentification_configs_source_idx').on(table.sourceId),
  })
);

// ============================================================================
// PROCESSING CONFIGS
// ============================================================================

export const processingConfigs = pgTable(
  'processing_configs',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: 'cascade' }),
    stages: jsonb('stages').notNull().default([]),
    filters: jsonb('filters').notNull().default({}),
    roleIdentification: jsonb('role_identification').notNull().default({}),
    exportFormat: text('export_format').notNull().default('jsonl'),
    isConfigured: boolean('is_configured').notNull().default(false),
    ...auditColumns,
  },
  (table) => ({
    projectIdx: uniqueIndex('processing_configs_project_idx').on(table.projectId),
  })
);

// ============================================================================
// PROCESSING RUNS
// ============================================================================

export const processingRuns = pgTable(
  'processing_runs',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    progress: integer('progress').notNull().default(0),
    currentStage: text('current_stage'),
    configSnapshot: jsonb('config_snapshot').notNull(),
    inputRecordCount: integer('input_record_count'),
    outputRecordCount: integer('output_record_count'),
    filteredRecordCount: integer('filtered_record_count'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    error: text('error'),
    errorDetails: jsonb('error_details'),
    ...auditColumns,
  },
  (table) => ({
    projectIdx: index('processing_runs_project_idx').on(table.projectId),
    statusIdx: index('processing_runs_status_idx').on(table.status),
    createdAtIdx: index('processing_runs_created_at_idx').on(table.createdAt),
  })
);

// ============================================================================
// DATASETS
// ============================================================================

export const datasets = pgTable(
  'datasets',
  {
    id: serial('id').primaryKey(),
    processingRunId: integer('processing_run_id')
      .notNull()
      .unique()
      .references(() => processingRuns.id, { onDelete: 'cascade' }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    format: text('format').notNull(),
    recordCount: integer('record_count').notNull(),
    data: jsonb('data').notNull(),
    filePath: text('file_path'),
    fileSize: integer('file_size'),
    filteredSample: jsonb('filtered_sample'),
    ...auditColumns,
  },
  (table) => ({
    processingRunIdx: uniqueIndex('datasets_processing_run_idx').on(table.processingRunId),
    projectIdx: index('datasets_project_idx').on(table.projectId),
  })
);

// ============================================================================
// AUDIT LOGS
// ============================================================================

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: integer('resource_id').notNull(),
    details: jsonb('details'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index('audit_logs_organization_idx').on(table.organizationId),
    userIdx: index('audit_logs_user_idx').on(table.userId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
    resourceIdx: index('audit_logs_resource_idx').on(table.resourceType, table.resourceId),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;

export type PasswordReset = typeof passwordResets.$inferSelect;
export type NewPasswordReset = typeof passwordResets.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;

export type SchemaMapping = typeof schemaMappings.$inferSelect;
export type NewSchemaMapping = typeof schemaMappings.$inferInsert;

export type DeidentificationConfig = typeof deidentificationConfigs.$inferSelect;
export type NewDeidentificationConfig = typeof deidentificationConfigs.$inferInsert;

export type ProcessingConfig = typeof processingConfigs.$inferSelect;
export type NewProcessingConfig = typeof processingConfigs.$inferInsert;

export type ProcessingRun = typeof processingRuns.$inferSelect;
export type NewProcessingRun = typeof processingRuns.$inferInsert;

export type Dataset = typeof datasets.$inferSelect;
export type NewDataset = typeof datasets.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// ============================================================================
// JSONB TYPE DEFINITIONS
// ============================================================================

export interface FieldMapping {
  sourceField: string;
  targetField: string | null;
  confidence: 'high' | 'medium' | 'low' | 'manual';
  transform?: string;
}

export interface DetectedField {
  name: string;
  type: string;
  samples: string[];
}

export interface CustomPIIPattern {
  name: string;
  pattern: string;
  replacement: string;
}

export interface PipelineStage {
  name: 'ingest' | 'normalize' | 'deidentify' | 'filter' | 'role_identify' | 'export';
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface QualityFilters {
  minMessageLength?: number;
  requireCompleteConversation?: boolean;
  excludePatterns?: string[];
}

export interface RoleIdentificationConfig {
  enabled: boolean;
  agentPatterns?: string[];
  customerPatterns?: string[];
  systemPatterns?: string[];
}

export type PIIType = 'email' | 'phone' | 'name' | 'address' | 'ssn' | 'credit_card' | 'dob';
export type MaskingStrategy = 'replacement' | 'redaction' | 'pseudonymization';
export type SourceType = 'file' | 'teamwork_desk';
export type SourceStatus = 'pending' | 'connected' | 'syncing' | 'ready' | 'error';
export type RunStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';
export type ExportFormat = 'jsonl' | 'json' | 'csv' | 'qa_pairs';
export type TargetSchema = 'conversation' | 'qa_pairs' | 'raw';
export type UserRole = 'admin' | 'member';
