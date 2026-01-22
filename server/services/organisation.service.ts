import { db } from '../db/index.js';
import { organizations, users } from '../db/schema.js';
import { eq, count } from 'drizzle-orm';
import { NotFoundError, ForbiddenError, BadRequestError } from '../errors/index.js';

/**
 * Get organization by ID.
 * Verifies user belongs to the organization.
 */
export async function getOrganization(organisationId: number, userOrgId: number) {
  if (organisationId !== userOrgId) {
    throw new ForbiddenError('Access denied to this organization');
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organisationId),
  });

  if (!org) {
    throw new NotFoundError('Organization');
  }

  // Get member count
  const [memberCountResult] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.organizationId, organisationId));

  return {
    ...org,
    memberCount: memberCountResult.count,
  };
}

/**
 * Update organization (admin only).
 */
export async function updateOrganization(
  organisationId: number,
  userOrgId: number,
  data: { name?: string }
) {
  if (organisationId !== userOrgId) {
    throw new ForbiddenError('Access denied to this organization');
  }

  const updates: Partial<{ name: string; updatedAt: Date }> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) {
    updates.name = data.name;
  }

  const [updated] = await db
    .update(organizations)
    .set(updates)
    .where(eq(organizations.id, organisationId))
    .returning();

  return updated;
}

/**
 * List organization members (admin only).
 */
export async function getOrganizationMembers(
  organisationId: number,
  userOrgId: number,
  pagination: { page: number; limit: number; offset: number }
) {
  if (organisationId !== userOrgId) {
    throw new ForbiddenError('Access denied to this organization');
  }

  const members = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.organizationId, organisationId))
    .limit(pagination.limit)
    .offset(pagination.offset)
    .orderBy(users.createdAt);

  const [countResult] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.organizationId, organisationId));

  return {
    members,
    total: countResult.count,
  };
}

/**
 * Update member role (admin only).
 */
export async function updateMemberRole(
  organisationId: number,
  userOrgId: number,
  userId: number,
  role: 'admin' | 'member'
) {
  if (organisationId !== userOrgId) {
    throw new ForbiddenError('Access denied to this organization');
  }

  // Check user exists and belongs to org
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || user.organizationId !== organisationId) {
    throw new NotFoundError('Member');
  }

  // Prevent demoting last admin
  if (user.role === 'admin' && role === 'member') {
    const [adminCount] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.organizationId, organisationId));

    // Check how many admins there are
    const admins = await db.query.users.findMany({
      where: eq(users.organizationId, organisationId),
    });
    const adminUsersCount = admins.filter((u) => u.role === 'admin').length;

    if (adminUsersCount <= 1) {
      throw new BadRequestError('Cannot demote the last admin');
    }
  }

  const [updated] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
  };
}
