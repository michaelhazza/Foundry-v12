// Configuration module
// Validates required environment variables at startup

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',

  // Server
  port: parseInt(process.env.PORT || '5000', 10),

  // Database
  get databaseUrl(): string {
    return requireEnv('DATABASE_URL');
  },

  // JWT
  get jwtSecret(): string {
    return requireEnv('JWT_SECRET');
  },

  // Encryption (for OAuth tokens, API keys)
  encryptionKey: process.env.ENCRYPTION_KEY,
  isEncryptionConfigured: !!process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length === 64,

  // Email
  isEmailEnabled: process.env.EMAIL_ENABLED === 'true',
  emailProvider: process.env.EMAIL_PROVIDER || 'resend',
  emailApiKey: process.env.EMAIL_API_KEY,

  // Application
  baseUrl: process.env.BASE_URL || 'http://localhost:5000',

  // File uploads
  maxFileSize: 100 * 1024 * 1024, // 100MB
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  allowedFileTypes: ['csv', 'xlsx', 'xls', 'json'],
};
