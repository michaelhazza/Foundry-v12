import { db } from '../db/index.js';
import {
  sources,
  projects,
  schemaMappings,
  deidentificationConfigs,
} from '../db/schema.js';
import { eq, and, isNull, count } from 'drizzle-orm';
import {
  NotFoundError,
  BadRequestError,
  FileTooLargeError,
  UnsupportedFileTypeError,
} from '../errors/index.js';
import { encrypt } from '../lib/encryption.js';
import { isEncryptionConfigured } from '../lib/encryption.js';
import * as projectService from './project.service.js';
import { config } from '../config.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * List sources for a project.
 */
export async function listSources(
  projectId: number,
  organisationId: number,
  pagination: { page: number; limit: number; offset: number }
) {
  // Verify project access
  await projectService.verifyProjectAccess(projectId, organisationId);

  const sourceList = await db
    .select({
      id: sources.id,
      name: sources.name,
      type: sources.type,
      status: sources.status,
      fileName: sources.fileName,
      fileType: sources.fileType,
      lastSyncAt: sources.lastSyncAt,
      lastError: sources.lastError,
      createdAt: sources.createdAt,
      updatedAt: sources.updatedAt,
    })
    .from(sources)
    .where(eq(sources.projectId, projectId))
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [totalCount] = await db
    .select({ count: count() })
    .from(sources)
    .where(eq(sources.projectId, projectId));

  return {
    sources: sourceList,
    total: totalCount.count,
  };
}

/**
 * Create a new source (file or API).
 */
export async function createSource(
  projectId: number,
  organisationId: number,
  data: {
    name: string;
    type: 'file' | 'teamwork_desk';
    apiKey?: string;
    apiSubdomain?: string;
    dataTypes?: string[];
  }
) {
  // Verify project access
  await projectService.verifyProjectAccess(projectId, organisationId);

  // For API sources, encrypt API key
  let encryptedApiKey: string | undefined;
  if (data.type === 'teamwork_desk' && data.apiKey) {
    if (!isEncryptionConfigured()) {
      throw new BadRequestError(
        'ENCRYPTION_KEY must be configured for API integrations'
      );
    }
    encryptedApiKey = encrypt(data.apiKey);
  }

  return await db.transaction(async (tx) => {
    const [source] = await tx
      .insert(sources)
      .values({
        projectId,
        name: data.name,
        type: data.type,
        status: data.type === 'file' ? 'pending' : 'connected',
        apiKey: encryptedApiKey,
        apiSubdomain: data.apiSubdomain,
        dataTypes: data.dataTypes,
      })
      .returning();

    // Create default schema mapping
    await tx.insert(schemaMappings).values({
      sourceId: source.id,
      mappings: [],
      targetSchema: 'conversation',
    });

    // Create default deidentification config
    await tx.insert(deidentificationConfigs).values({
      sourceId: source.id,
      enabledTypes: ['email', 'phone'],
      customPatterns: [],
      maskingStrategy: 'replacement',
    });

    return source;
  });
}

/**
 * Get source with configs.
 */
export async function getSource(sourceId: number, organisationId: number) {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
  });

  if (!source) {
    throw new NotFoundError('Source');
  }

  // Verify project access
  await projectService.verifyProjectAccess(source.projectId, organisationId);

  const schemaMapping = await db.query.schemaMappings.findFirst({
    where: eq(schemaMappings.sourceId, sourceId),
  });

  const deidentificationConfig = await db.query.deidentificationConfigs.findFirst({
    where: eq(deidentificationConfigs.sourceId, sourceId),
  });

  return {
    ...source,
    apiKey: undefined, // Never return encrypted API key
    schemaMapping,
    deidentificationConfig,
  };
}

/**
 * Update source.
 */
export async function updateSource(
  sourceId: number,
  organisationId: number,
  data: {
    name?: string;
    apiKey?: string;
    apiSubdomain?: string;
    dataTypes?: string[];
  }
) {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
  });

  if (!source) {
    throw new NotFoundError('Source');
  }

  // Verify project access
  await projectService.verifyProjectAccess(source.projectId, organisationId);

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (data.name !== undefined) {
    updates.name = data.name;
  }

  if (data.apiKey !== undefined) {
    if (!isEncryptionConfigured()) {
      throw new BadRequestError(
        'ENCRYPTION_KEY must be configured for API integrations'
      );
    }
    updates.apiKey = encrypt(data.apiKey);
  }

  if (data.apiSubdomain !== undefined) {
    updates.apiSubdomain = data.apiSubdomain;
  }

  if (data.dataTypes !== undefined) {
    updates.dataTypes = data.dataTypes;
  }

  const [updated] = await db
    .update(sources)
    .set(updates)
    .where(eq(sources.id, sourceId))
    .returning();

  return { ...updated, apiKey: undefined };
}

/**
 * Delete source.
 */
export async function deleteSource(sourceId: number, organisationId: number) {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
  });

  if (!source) {
    throw new NotFoundError('Source');
  }

  // Verify project access
  await projectService.verifyProjectAccess(source.projectId, organisationId);

  // Delete file if exists
  if (source.filePath) {
    try {
      await fs.unlink(source.filePath);
    } catch {
      // Ignore file deletion errors
    }
  }

  // Cascade deletes schema mapping and deidentification config
  await db.delete(sources).where(eq(sources.id, sourceId));
}

/**
 * Handle file upload for source.
 */
export async function uploadFile(
  sourceId: number,
  organisationId: number,
  file: Express.Multer.File
) {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
  });

  if (!source) {
    throw new NotFoundError('Source');
  }

  // Verify project access
  await projectService.verifyProjectAccess(source.projectId, organisationId);

  if (source.type !== 'file') {
    throw new BadRequestError('Only file sources support upload');
  }

  // Detect file type
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (!config.allowedFileTypes.includes(ext)) {
    throw new UnsupportedFileTypeError(
      `File type ${ext} is not supported. Supported types: ${config.allowedFileTypes.join(', ')}`
    );
  }

  // Detect fields from file (simplified - would use proper parsers)
  const detectedFields = await detectFieldsFromFile(file, ext);

  const [updated] = await db
    .update(sources)
    .set({
      fileName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      fileType: ext,
      status: 'ready',
      detectedFields,
      updatedAt: new Date(),
    })
    .where(eq(sources.id, sourceId))
    .returning();

  return { ...updated, apiKey: undefined };
}

/**
 * Sync API source (Teamwork Desk).
 */
export async function syncSource(sourceId: number, organisationId: number) {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
  });

  if (!source) {
    throw new NotFoundError('Source');
  }

  // Verify project access
  await projectService.verifyProjectAccess(source.projectId, organisationId);

  if (source.type !== 'teamwork_desk') {
    throw new BadRequestError('Only API sources can be synced');
  }

  // Update status to syncing
  await db
    .update(sources)
    .set({ status: 'syncing', updatedAt: new Date() })
    .where(eq(sources.id, sourceId));

  // Sync would happen asynchronously in real implementation
  // For now, return accepted status
  return { status: 'syncing', sourceId };
}

/**
 * Detect fields from uploaded file.
 */
async function detectFieldsFromFile(
  file: Express.Multer.File,
  fileType: string
): Promise<Array<{ name: string; type: string; samples: string[] }>> {
  // Simplified field detection - in real implementation would parse file
  const content = await fs.readFile(file.path, 'utf-8');

  if (fileType === 'csv') {
    const lines = content.split('\n');
    const headers = lines[0]?.split(',').map((h) => h.trim()) || [];
    return headers.map((name) => ({
      name,
      type: 'string',
      samples: [],
    }));
  }

  if (fileType === 'json') {
    try {
      const data = JSON.parse(content);
      const sample = Array.isArray(data) ? data[0] : data;
      if (sample && typeof sample === 'object') {
        return Object.keys(sample).map((name) => ({
          name,
          type: typeof sample[name],
          samples: [String(sample[name])].slice(0, 3),
        }));
      }
    } catch {
      // Invalid JSON
    }
  }

  return [];
}

/**
 * Verify source access.
 */
export async function verifySourceAccess(sourceId: number, organisationId: number) {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
  });

  if (!source) {
    throw new NotFoundError('Source');
  }

  await projectService.verifyProjectAccess(source.projectId, organisationId);

  return source;
}
