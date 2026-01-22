import { db } from '../db/index.js';
import { schemaMappings, sources } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '../errors/index.js';
import * as sourceService from './source.service.js';

interface FieldMapping {
  sourceField: string;
  targetField: string | null;
  confidence?: 'high' | 'medium' | 'low' | 'manual';
  transform?: string;
}

/**
 * Get schema mapping for source.
 */
export async function getSchemaMapping(sourceId: number, organisationId: number) {
  // Verify source access
  const source = await sourceService.verifySourceAccess(sourceId, organisationId);

  const mapping = await db.query.schemaMappings.findFirst({
    where: eq(schemaMappings.sourceId, sourceId),
  });

  if (!mapping) {
    throw new NotFoundError('Schema mapping');
  }

  return {
    ...mapping,
    detectedFields: source.detectedFields,
  };
}

/**
 * Update schema mapping.
 */
export async function updateSchemaMapping(
  sourceId: number,
  organisationId: number,
  data: {
    mappings?: FieldMapping[];
    targetSchema?: 'conversation' | 'qa_pairs' | 'raw';
  }
) {
  // Verify source access
  await sourceService.verifySourceAccess(sourceId, organisationId);

  const existing = await db.query.schemaMappings.findFirst({
    where: eq(schemaMappings.sourceId, sourceId),
  });

  if (!existing) {
    throw new NotFoundError('Schema mapping');
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    isConfigured: true,
  };

  if (data.mappings !== undefined) {
    updates.mappings = data.mappings;
  }

  if (data.targetSchema !== undefined) {
    updates.targetSchema = data.targetSchema;
  }

  const [updated] = await db
    .update(schemaMappings)
    .set(updates)
    .where(eq(schemaMappings.sourceId, sourceId))
    .returning();

  return updated;
}

/**
 * Preview schema mapping on sample data.
 */
export async function previewSchemaMapping(sourceId: number, organisationId: number) {
  // Verify source access
  const source = await sourceService.verifySourceAccess(sourceId, organisationId);

  const mapping = await db.query.schemaMappings.findFirst({
    where: eq(schemaMappings.sourceId, sourceId),
  });

  if (!mapping) {
    throw new NotFoundError('Schema mapping');
  }

  // Get cached data or sample
  const cachedData = (source.cachedData as unknown[] | null) || [];
  const sampleData = cachedData.slice(0, 100);

  // Apply mappings to sample data
  const mappingConfig = mapping.mappings as FieldMapping[];
  const previewRecords = (sampleData as Record<string, unknown>[]).map((record) => {
    const mapped: Record<string, unknown> = {};
    for (const map of mappingConfig) {
      if (map.targetField && record[map.sourceField] !== undefined) {
        mapped[map.targetField] = record[map.sourceField];
      }
    }
    return mapped;
  });

  // Identify any issues
  const mappingIssues: Array<{ field: string; issue: string }> = [];
  const detectedFields = (source.detectedFields as Array<{ name: string }>) || [];
  const mappedFields = new Set(mappingConfig.map((m) => m.sourceField));

  for (const field of detectedFields) {
    if (!mappedFields.has(field.name)) {
      mappingIssues.push({
        field: field.name,
        issue: 'Field not mapped',
      });
    }
  }

  return {
    previewRecords,
    mappingIssues,
    totalRecords: cachedData.length,
    previewCount: previewRecords.length,
  };
}
