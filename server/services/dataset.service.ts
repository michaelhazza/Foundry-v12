import { db } from '../db/index.js';
import { datasets, processingRuns, projects } from '../db/schema.js';
import { eq, desc, count } from 'drizzle-orm';
import { NotFoundError } from '../errors/index.js';
import * as projectService from './project.service.js';

/**
 * List datasets for project.
 */
export async function listDatasets(
  projectId: number,
  organisationId: number,
  pagination: { page: number; limit: number; offset: number }
) {
  // Verify project access
  await projectService.verifyProjectAccess(projectId, organisationId);

  const datasetList = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      format: datasets.format,
      recordCount: datasets.recordCount,
      fileSize: datasets.fileSize,
      createdAt: datasets.createdAt,
    })
    .from(datasets)
    .where(eq(datasets.projectId, projectId))
    .limit(pagination.limit)
    .offset(pagination.offset)
    .orderBy(desc(datasets.createdAt));

  const [totalCount] = await db
    .select({ count: count() })
    .from(datasets)
    .where(eq(datasets.projectId, projectId));

  return {
    datasets: datasetList,
    total: totalCount.count,
  };
}

/**
 * Get dataset by ID.
 */
export async function getDataset(datasetId: number, organisationId: number) {
  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });

  if (!dataset) {
    throw new NotFoundError('Dataset');
  }

  // Verify project access
  await projectService.verifyProjectAccess(dataset.projectId, organisationId);

  // Get associated run info
  const run = await db.query.processingRuns.findFirst({
    where: eq(processingRuns.id, dataset.processingRunId),
  });

  return {
    ...dataset,
    run: run
      ? {
          id: run.id,
          status: run.status,
          inputRecordCount: run.inputRecordCount,
          outputRecordCount: run.outputRecordCount,
          filteredRecordCount: run.filteredRecordCount,
          completedAt: run.completedAt,
        }
      : null,
  };
}

/**
 * Preview dataset (sample records).
 */
export async function previewDataset(datasetId: number, organisationId: number) {
  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });

  if (!dataset) {
    throw new NotFoundError('Dataset');
  }

  // Verify project access
  await projectService.verifyProjectAccess(dataset.projectId, organisationId);

  const data = (dataset.data as unknown[]) || [];
  const previewRecords = data.slice(0, 100);

  return {
    records: previewRecords,
    totalRecords: data.length,
    previewCount: previewRecords.length,
  };
}

/**
 * Export dataset in specified format.
 */
export async function exportDataset(
  datasetId: number,
  organisationId: number,
  format?: string
) {
  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });

  if (!dataset) {
    throw new NotFoundError('Dataset');
  }

  // Verify project access
  await projectService.verifyProjectAccess(dataset.projectId, organisationId);

  const exportFormat = format || dataset.format;
  const data = (dataset.data as unknown[]) || [];

  let content: string;
  let contentType: string;
  let filename: string;

  switch (exportFormat) {
    case 'jsonl':
      content = data.map((record) => JSON.stringify(record)).join('\n');
      contentType = 'application/x-jsonlines';
      filename = `${dataset.name}.jsonl`;
      break;

    case 'json':
      content = JSON.stringify(data, null, 2);
      contentType = 'application/json';
      filename = `${dataset.name}.json`;
      break;

    case 'csv':
      content = convertToCSV(data);
      contentType = 'text/csv';
      filename = `${dataset.name}.csv`;
      break;

    default:
      content = data.map((record) => JSON.stringify(record)).join('\n');
      contentType = 'application/x-jsonlines';
      filename = `${dataset.name}.jsonl`;
  }

  return {
    content,
    contentType,
    filename,
  };
}

/**
 * Convert data to CSV format.
 */
function convertToCSV(data: unknown[]): string {
  if (data.length === 0) {
    return '';
  }

  const first = data[0] as Record<string, unknown>;
  const headers = Object.keys(first);

  const headerRow = headers.map(escapeCSV).join(',');
  const dataRows = (data as Record<string, unknown>[]).map((record) =>
    headers.map((header) => escapeCSV(String(record[header] ?? ''))).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
