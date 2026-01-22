import { db } from '../db/index.js';
import { projects, sources, datasets, processingConfigs, processingRuns } from '../db/schema.js';
import { eq, and, isNull, desc, count, sql } from 'drizzle-orm';
import { NotFoundError, ForbiddenError, ConflictError } from '../errors/index.js';

/**
 * List projects for organization with counts.
 */
export async function listProjects(
  organisationId: number,
  pagination: { page: number; limit: number; offset: number }
) {
  const projectList = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(
      and(eq(projects.organizationId, organisationId), isNull(projects.deletedAt))
    )
    .limit(pagination.limit)
    .offset(pagination.offset)
    .orderBy(desc(projects.updatedAt));

  // Get counts for each project
  const projectsWithCounts = await Promise.all(
    projectList.map(async (project) => {
      const [sourceCount] = await db
        .select({ count: count() })
        .from(sources)
        .where(eq(sources.projectId, project.id));

      const [datasetCount] = await db
        .select({ count: count() })
        .from(datasets)
        .where(eq(datasets.projectId, project.id));

      return {
        ...project,
        sourceCount: sourceCount.count,
        datasetCount: datasetCount.count,
      };
    })
  );

  const [totalCount] = await db
    .select({ count: count() })
    .from(projects)
    .where(
      and(eq(projects.organizationId, organisationId), isNull(projects.deletedAt))
    );

  return {
    projects: projectsWithCounts,
    total: totalCount.count,
  };
}

/**
 * Create a new project with processing config.
 */
export async function createProject(
  organisationId: number,
  data: { name: string; description?: string }
) {
  // Check for duplicate name in organization
  const existing = await db.query.projects.findFirst({
    where: and(
      eq(projects.organizationId, organisationId),
      eq(projects.name, data.name),
      isNull(projects.deletedAt)
    ),
  });

  if (existing) {
    throw new ConflictError('A project with this name already exists');
  }

  return await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        organizationId: organisationId,
        name: data.name,
        description: data.description,
      })
      .returning();

    // Create default processing config
    await tx.insert(processingConfigs).values({
      projectId: project.id,
      stages: [
        { name: 'ingest', enabled: true, config: {} },
        { name: 'normalize', enabled: true, config: {} },
        { name: 'deidentify', enabled: true, config: {} },
        { name: 'filter', enabled: true, config: {} },
        { name: 'export', enabled: true, config: {} },
      ],
      filters: {},
      roleIdentification: { enabled: false },
      exportFormat: 'jsonl',
    });

    return {
      ...project,
      sourceCount: 0,
      datasetCount: 0,
    };
  });
}

/**
 * Get project by ID with counts.
 */
export async function getProject(projectId: number, organisationId: number) {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organisationId),
      isNull(projects.deletedAt)
    ),
  });

  if (!project) {
    throw new NotFoundError('Project');
  }

  const [sourceCount] = await db
    .select({ count: count() })
    .from(sources)
    .where(eq(sources.projectId, projectId));

  const [datasetCount] = await db
    .select({ count: count() })
    .from(datasets)
    .where(eq(datasets.projectId, projectId));

  return {
    ...project,
    sourceCount: sourceCount.count,
    datasetCount: datasetCount.count,
  };
}

/**
 * Update project.
 */
export async function updateProject(
  projectId: number,
  organisationId: number,
  data: { name?: string; description?: string }
) {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organisationId),
      isNull(projects.deletedAt)
    ),
  });

  if (!project) {
    throw new NotFoundError('Project');
  }

  // Check for duplicate name if updating name
  if (data.name && data.name !== project.name) {
    const existing = await db.query.projects.findFirst({
      where: and(
        eq(projects.organizationId, organisationId),
        eq(projects.name, data.name),
        isNull(projects.deletedAt)
      ),
    });

    if (existing) {
      throw new ConflictError('A project with this name already exists');
    }
  }

  const [updated] = await db
    .update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return updated;
}

/**
 * Soft delete project.
 */
export async function deleteProject(projectId: number, organisationId: number) {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organisationId),
      isNull(projects.deletedAt)
    ),
  });

  if (!project) {
    throw new NotFoundError('Project');
  }

  await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

/**
 * Verify project access.
 */
export async function verifyProjectAccess(projectId: number, organisationId: number) {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organisationId),
      isNull(projects.deletedAt)
    ),
  });

  if (!project) {
    throw new NotFoundError('Project');
  }

  return project;
}
