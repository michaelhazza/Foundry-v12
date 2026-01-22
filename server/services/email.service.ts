import { config } from '../config.js';

/**
 * Email service with optional service pattern.
 * If email is not configured, logs to console in dev.
 * Never throws errors - gracefully degrades.
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email. If email is not configured, logs to console.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  if (config.isEmailEnabled && config.emailApiKey) {
    // In production with email configured, would send via provider
    console.log(`[EMAIL] Sending to ${options.to}: ${options.subject}`);
    // Actual implementation would call email provider API
  } else if (config.isDevelopment) {
    console.log(`[DEV EMAIL] Would send to ${options.to}: ${options.subject}`);
    console.log(`[DEV EMAIL] Content: ${options.html}`);
  } else {
    console.warn(`[EMAIL] Email not configured. Would have sent to ${options.to}`);
  }
}

/**
 * Send password reset email.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${config.baseUrl}/reset-password/${token}`;

  if (config.isEmailEnabled && config.emailApiKey) {
    await sendEmail({
      to: email,
      subject: 'Reset your password - Foundry',
      html: `
        <h2>Reset your password</h2>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  } else if (config.isDevelopment) {
    console.log(`[DEV] Password reset token for ${email}: ${token}`);
    console.log(`[DEV] Reset URL: ${resetUrl}`);
  }
}

/**
 * Send invitation email.
 */
export async function sendInvitationEmail(
  email: string,
  token: string,
  organizationName: string,
  inviterName: string
): Promise<void> {
  const inviteUrl = `${config.baseUrl}/invite/${token}`;

  if (config.isEmailEnabled && config.emailApiKey) {
    await sendEmail({
      to: email,
      subject: `You've been invited to ${organizationName} - Foundry`,
      html: `
        <h2>You've been invited to ${organizationName}</h2>
        <p>${inviterName} has invited you to join their team on Foundry.</p>
        <p><a href="${inviteUrl}">Accept Invitation</a></p>
        <p>This invitation expires in 7 days.</p>
      `,
    });
  } else if (config.isDevelopment) {
    console.log(`[DEV] Invitation for ${email} to ${organizationName}`);
    console.log(`[DEV] Invite URL: ${inviteUrl}`);
    console.log(`[DEV] Token: ${token}`);
  }
}
