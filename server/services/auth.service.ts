import { db } from '../db/index.js';
import { users, organizations, invitations, passwordResets } from '../db/schema.js';
import { eq, and, gte, isNull } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { generateToken, TokenPayload } from '../lib/tokens.js';
import { random } from '../lib/random.js';
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  InvitationExpiredError,
  InvitationUsedError,
  ResetTokenExpiredError,
} from '../errors/index.js';

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  inviteToken?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ProfileUpdateData {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Register a new user.
 * If inviteToken provided: joins existing organization.
 * Otherwise: creates new organization.
 */
export async function register(data: RegisterData) {
  // Check if email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, data.email.toLowerCase()),
  });

  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await hashPassword(data.password);

  // Handle invitation flow
  if (data.inviteToken) {
    const invite = await db.query.invitations.findFirst({
      where: and(
        eq(invitations.token, data.inviteToken),
        gte(invitations.expiresAt, new Date()),
        isNull(invitations.usedAt)
      ),
    });

    if (!invite) {
      throw new BadRequestError('Invalid or expired invitation');
    }

    // Create user in invited organization
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: data.email.toLowerCase(),
          passwordHash,
          name: data.name,
          organizationId: invite.organizationId,
          role: invite.role,
        })
        .returning();

      // Mark invitation as used
      await tx
        .update(invitations)
        .set({ usedAt: new Date(), updatedAt: new Date() })
        .where(eq(invitations.id, invite.id));

      const token = generateToken({
        userId: user.id,
        organisationId: user.organizationId,
        role: user.role,
      });

      const org = await tx.query.organizations.findFirst({
        where: eq(organizations.id, user.organizationId),
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        },
        organization: org,
      };
    });
  }

  // Create new organization flow
  return await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({ name: `${data.name}'s Organization` })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        organizationId: org.id,
        role: 'admin',
      })
      .returning();

    const token = generateToken({
      userId: user.id,
      organisationId: user.organizationId,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
      organization: org,
    };
  });
}

/**
 * Login a user and return JWT token.
 */
export async function login(data: LoginData) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, data.email.toLowerCase()),
  });

  if (!user) {
    // Use generic message to avoid email enumeration
    throw new UnauthorizedError('Invalid email or password');
  }

  const validPassword = await verifyPassword(data.password, user.passwordHash);
  if (!validPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = generateToken({
    userId: user.id,
    organisationId: user.organizationId,
    role: user.role,
  });

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.organizationId),
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    },
    organization: org,
  };
}

/**
 * Get current user with organization.
 */
export async function getCurrentUser(userId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.organizationId),
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    organization: org,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Update user profile.
 */
export async function updateProfile(userId: number, data: ProfileUpdateData) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  const updates: Partial<{
    name: string | null;
    passwordHash: string;
    updatedAt: Date;
  }> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) {
    updates.name = data.name;
  }

  if (data.newPassword) {
    if (!data.currentPassword) {
      throw new BadRequestError('Current password is required');
    }

    const validPassword = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new BadRequestError('Current password is incorrect');
    }

    updates.passwordHash = await hashPassword(data.newPassword);
  }

  const [updatedUser] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning();

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
    organizationId: updatedUser.organizationId,
    updatedAt: updatedUser.updatedAt,
  };
}

/**
 * Request password reset - creates token.
 */
export async function requestPasswordReset(email: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return { message: 'If the email exists, a reset link will be sent' };
  }

  const token = random.token();
  const tokenHash = await hashPassword(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return { token, email: user.email };
}

/**
 * Validate password reset token.
 */
export async function validateResetToken(token: string) {
  const resets = await db.query.passwordResets.findMany({
    where: and(
      gte(passwordResets.expiresAt, new Date()),
      isNull(passwordResets.usedAt)
    ),
  });

  for (const reset of resets) {
    const isMatch = await verifyPassword(token, reset.tokenHash);
    if (isMatch) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, reset.userId),
      });
      return { valid: true, email: user?.email };
    }
  }

  throw new ResetTokenExpiredError();
}

/**
 * Complete password reset.
 */
export async function resetPassword(token: string, newPassword: string) {
  const resets = await db.query.passwordResets.findMany({
    where: and(
      gte(passwordResets.expiresAt, new Date()),
      isNull(passwordResets.usedAt)
    ),
  });

  for (const reset of resets) {
    const isMatch = await verifyPassword(token, reset.tokenHash);
    if (isMatch) {
      const passwordHash = await hashPassword(newPassword);

      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(users.id, reset.userId));

        await tx
          .update(passwordResets)
          .set({ usedAt: new Date() })
          .where(eq(passwordResets.id, reset.id));
      });

      return { message: 'Password reset successfully' };
    }
  }

  throw new ResetTokenExpiredError();
}
