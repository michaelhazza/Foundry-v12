import { db } from '../db/index.js';
import {
  processingConfigs,
  processingRuns,
  sources,
  datasets,
  projects,
} from '../db/schema.js';
import { eq, and, isNull, desc, count } from 'drizzle-orm';
import { NotFoundError, ProcessingInProgressError } from '../errors/index.js';
import * as projectService from './project.service.js';

/**
 * Get processing config for project.
 */
export async function getProcessingConfig(projectId: number, organisationId: number) {
  // Verify project access
  await projectService.verifyProjectAccess(projectId, organisationId);

  const config = await db.query.processingConfigs.findFirst({
    where: eq(processingConfigs.projectId, projectId),
  });

  if (!config) {
    throw new NotFoundError('Processing config');
  }

  return config;
}

/**
 * Update processing config.
 */
export async function updateProcessingConfig(
  projectId: number,
  organisationId: number,
  data: {
    stages?: Array<{ name: string; enabled: boolean; config?: object }>;
    filters?: object;
    roleIdentification?: object;
    exportFormat?: string;
  }
) {
  // Verify project access
  await projectService.verifyProjectAccess(projectId, organisationId);

  const existing = await db.query.processingConfigs.findFirst({
    where: eq(processingConfigs.projectId, projectId),
  });

  if (!existing) {
    throw new NotFoundError('Processing config');
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    isConfigured: true,
  };

  if (data.stages !== undefined) {
    updates.stages = data.stages;
  }

  if (data.filters !== undefined) {
    updates.filters = data.filters;
  }

  if (data.roleIdentification !== undefined) {
    updates.roleIdentification = data.roleIdentification;
  }

  if (data.exportFormat !== undefined) {
    updates.exportFormat = data.exportFormat;
  }

  const [updated] = await db
    .update(processingConfigs)
    .set(updates)
    .where(eq(processingConfigs.projectId, projectId))
    .returning();

  return updated;
}

/**
 * List processing runs for project.
 */
export async function listProcessingRuns(
  projectId: number,
  organisationId: number,
  pagination: { page: number; limit: number; offset: number }
) {
  // Verify project access
  await projectService.verifyProjectAccess(projectId, organisationId);

  const runs = await db
    .select({
      id: processingRuns.id,
      status: processingRuns.status,
      progress: processingRuns.progress,
      currentStage: processingRuns.currentStage,
      inputRecordCount: processingRuns.inputRecordCount,
      outputRecordCount: processingRuns.outputRecordCount,
      filteredRecordCount: processingRuns.filteredRecordCount,
      startedAt: processingRuns.startedAt,
      completedAt: processingRuns.completedAt,
      error: processingRuns.error,
      createdAt: processingRuns.createdAt,
    })
    .from(processingRuns)
    .where(eq(processingRuns.projectId, projectId))
    .limit(pagination.limit)
    .offset(pagination.offset)
    .orderBy(desc(processingRuns.createdAt));

  const [totalCount] = await db
    .select({ count: count() })
    .from(processingRuns)
    .where(eq(processingRuns.projectId, projectId));

  return {
    runs,
    total: totalCount.count,
  };
}

/**
 * Start a processing run.
 */
export async function startProcessingRun(projectId: number, organisationId: number) {
  // Verify project access
  await projectService.verifyProjectAccess(projectId, organisationId);

  // Check for existing in-progress run
  const inProgress = await db.query.processingRuns.findFirst({
    where: and(
      eq(processingRuns.projectId, projectId),
      eq(processingRuns.status, 'processing')
    ),
  });

  if (inProgress) {
    throw new ProcessingInProgressError();
  }

  // Get processing config
  const config = await db.query.processingConfigs.findFirst({
    where: eq(processingConfigs.projectId, projectId),
  });

  if (!config) {
    throw new NotFoundError('Processing config');
  }

  // Create run with config snapshot
  const [run] = await db
    .insert(processingRuns)
    .values({
      projectId,
      status: 'pending',
      progress: 0,
      configSnapshot: {
        stages: config.stages,
        filters: config.filters,
        roleIdentification: config.roleIdentification,
        exportFormat: config.exportFormat,
      },
    })
    .returning();

  // In real implementation, would queue async processing job
  // For demo, simulate starting processing
  setTimeout(() => {
    processRunAsync(run.id);
  }, 100);

  return run;
}

/**
 * Get processing run by ID.
 */
export async function getProcessingRun(runId: number, organisationId: number) {
  const run = await db.query.processingRuns.findFirst({
    where: eq(processingRuns.id, runId),
  });

  if (!run) {
    throw new NotFoundError('Processing run');
  }

  // Verify project access
  await projectService.verifyProjectAccess(run.projectId, organisationId);

  return run;
}

/**
 * Cancel a processing run.
 */
export async function cancelProcessingRun(runId: number, organisationId: number) {
  const run = await db.query.processingRuns.findFirst({
    where: eq(processingRuns.id, runId),
  });

  if (!run) {
    throw new NotFoundError('Processing run');
  }

  // Verify project access
  await projectService.verifyProjectAccess(run.projectId, organisationId);

  const [updated] = await db
    .update(processingRuns)
    .set({
      status: 'cancelled',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(processingRuns.id, runId))
    .returning();

  return updated;
}

/**
 * Get filtered records from a run.
 */
export async function getFilteredRecords(
  runId: number,
  organisationId: number,
  pagination: { page: number; limit: number; offset: number }
) {
  const run = await db.query.processingRuns.findFirst({
    where: eq(processingRuns.id, runId),
  });

  if (!run) {
    throw new NotFoundError('Processing run');
  }

  // Verify project access
  await projectService.verifyProjectAccess(run.projectId, organisationId);

  // Get dataset for this run
  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.processingRunId, runId),
  });

  if (!dataset) {
    return { records: [], total: 0 };
  }

  const filteredSample = (dataset.filteredSample as unknown[]) || [];
  const paginatedRecords = filteredSample.slice(
    pagination.offset,
    pagination.offset + pagination.limit
  );

  return {
    records: paginatedRecords,
    total: filteredSample.length,
  };
}

/**
 * Async processing simulation (in real implementation would be separate worker).
 */
async function processRunAsync(runId: number) {
  try {
    // Update to processing
    await db
      .update(processingRuns)
      .set({
        status: 'processing',
        startedAt: new Date(),
        currentStage: 'ingest',
        progress: 10,
        updatedAt: new Date(),
      })
      .where(eq(processingRuns.id, runId));

    // Check if cancelled
    const run = await db.query.processingRuns.findFirst({
      where: eq(processingRuns.id, runId),
    });

    if (!run || run.status === 'cancelled') {
      return;
    }

    // Simulate processing stages
    const stages = ['ingest', 'normalize', 'deidentify', 'filter', 'export'];
    for (let i = 0; i < stages.length; i++) {
      // Check if cancelled
      const currentRun = await db.query.processingRuns.findFirst({
        where: eq(processingRuns.id, runId),
      });

      if (!currentRun || currentRun.status === 'cancelled') {
        return;
      }

      await db
        .update(processingRuns)
        .set({
          currentStage: stages[i],
          progress: Math.min(100, (i + 1) * 20),
          updatedAt: new Date(),
        })
        .where(eq(processingRuns.id, runId));

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Get project for dataset naming
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, run.projectId),
    });

    // Create dataset
    await db.insert(datasets).values({
      processingRunId: runId,
      projectId: run.projectId,
      name: `${project?.name || 'Project'} - ${new Date().toISOString().split('T')[0]}`,
      format: 'jsonl',
      recordCount: 100, // Simulated
      data: [], // Would contain actual processed data
      filteredSample: [], // Sample of filtered records
    });

    // Complete
    await db
      .update(processingRuns)
      .set({
        status: 'completed',
        progress: 100,
        inputRecordCount: 150,
        outputRecordCount: 100,
        filteredRecordCount: 50,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(processingRuns.id, runId));
  } catch (error) {
    // Mark as failed
    await db
      .update(processingRuns)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(processingRuns.id, runId));
  }
}
