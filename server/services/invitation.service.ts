import { db } from '../db/index.js';
import { invitations, users, organizations } from '../db/schema.js';
import { eq, and, gte, isNull, count } from 'drizzle-orm';
import { random } from '../lib/random.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  AlreadyMemberError,
  InvitationExpiredError,
  InvitationUsedError,
} from '../errors/index.js';
import * as emailService from './email.service.js';

/**
 * List pending invitations for organization.
 */
export async function listInvitations(
  organisationId: number,
  userOrgId: number,
  pagination: { page: number; limit: number; offset: number }
) {
  if (organisationId !== userOrgId) {
    throw new ForbiddenError('Access denied to this organization');
  }

  const invitationsList = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organisationId),
        isNull(invitations.usedAt),
        gte(invitations.expiresAt, new Date())
      )
    )
    .limit(pagination.limit)
    .offset(pagination.offset)
    .orderBy(invitations.createdAt);

  const [countResult] = await db
    .select({ count: count() })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organisationId),
        isNull(invitations.usedAt),
        gte(invitations.expiresAt, new Date())
      )
    );

  return {
    invitations: invitationsList,
    total: countResult.count,
  };
}

/**
 * Create and send invitation.
 */
export async function createInvitation(
  organisationId: number,
  inviterId: number,
  inviterOrgId: number,
  inviterName: string,
  data: { email: string; role?: 'admin' | 'member' }
) {
  if (organisationId !== inviterOrgId) {
    throw new ForbiddenError('Access denied to this organization');
  }

  const email = data.email.toLowerCase();

  // Check if user already exists in organization
  const existingUser = await db.query.users.findFirst({
    where: and(
      eq(users.email, email),
      eq(users.organizationId, organisationId)
    ),
  });

  if (existingUser) {
    throw new AlreadyMemberError();
  }

  // Check for pending invitation
  const existingInvite = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.email, email),
      eq(invitations.organizationId, organisationId),
      isNull(invitations.usedAt),
      gte(invitations.expiresAt, new Date())
    ),
  });

  if (existingInvite) {
    throw new ConflictError('An invitation has already been sent to this email');
  }

  const token = random.uuid();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [invitation] = await db
    .insert(invitations)
    .values({
      organizationId: organisationId,
      invitedById: inviterId,
      email,
      token,
      role: data.role || 'member',
      expiresAt,
    })
    .returning();

  // Get organization name for email
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organisationId),
  });

  // Send invitation email
  await emailService.sendInvitationEmail(
    email,
    token,
    org?.name || 'Organization',
    inviterName
  );

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  };
}

/**
 * Cancel/delete an invitation.
 */
export async function deleteInvitation(
  organisationId: number,
  invitationId: number,
  userOrgId: number
) {
  if (organisationId !== userOrgId) {
    throw new ForbiddenError('Access denied to this organization');
  }

  const invitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.id, invitationId),
      eq(invitations.organizationId, organisationId)
    ),
  });

  if (!invitation) {
    throw new NotFoundError('Invitation');
  }

  await db.delete(invitations).where(eq(invitations.id, invitationId));
}

/**
 * Get invitation details by token (for registration page).
 */
export async function getInvitationByToken(token: string) {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });

  if (!invitation) {
    throw new NotFoundError('Invitation');
  }

  if (invitation.usedAt) {
    throw new InvitationUsedError();
  }

  if (invitation.expiresAt < new Date()) {
    throw new InvitationExpiredError();
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, invitation.organizationId),
  });

  return {
    email: invitation.email,
    role: invitation.role,
    organizationName: org?.name,
    expiresAt: invitation.expiresAt,
  };
}

/**
 * Accept invitation (for existing users).
 */
export async function acceptInvitation(
  token: string,
  userId: number,
  currentOrgId: number
) {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });

  if (!invitation) {
    throw new NotFoundError('Invitation');
  }

  if (invitation.usedAt) {
    throw new InvitationUsedError();
  }

  if (invitation.expiresAt < new Date()) {
    throw new InvitationExpiredError();
  }

  // Check if user is already in this organization
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  if (user.organizationId === invitation.organizationId) {
    throw new AlreadyMemberError();
  }

  // Check if email matches
  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new ForbiddenError('This invitation was sent to a different email address');
  }

  // Move user to new organization
  return await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        organizationId: invitation.organizationId,
        role: invitation.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await tx
      .update(invitations)
      .set({ usedAt: new Date(), updatedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    const org = await tx.query.organizations.findFirst({
      where: eq(organizations.id, invitation.organizationId),
    });

    const updatedUser = await tx.query.users.findFirst({
      where: eq(users.id, userId),
    });

    return {
      user: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        name: updatedUser!.name,
        role: updatedUser!.role,
        organizationId: updatedUser!.organizationId,
      },
      organization: org,
    };
  });
}
