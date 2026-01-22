import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { generalLimiter } from './middleware/rate-limit.js';
import routes from './routes/index.js';

const app = express();

// Trust proxy (required for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: config.isProduction
      ? undefined
      : false, // Disable CSP in dev for easier debugging
  })
);

// CORS configuration
app.use(
  cors({
    origin: config.isDevelopment
      ? ['http://localhost:5000', 'http://localhost:3001', 'http://127.0.0.1:5000']
      : [config.baseUrl],
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting on all API routes
app.use('/api', generalLimiter);

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// API routes
app.use('/api', routes);

// Serve static files in production
if (config.isProduction) {
  const publicPath = path.join(process.cwd(), 'dist', 'public');

  // Serve static assets
  app.use(express.static(publicPath));

  // SPA fallback - serve index.html for all non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

// Start server
const port = config.port;
const host = '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
  console.log(`Environment: ${config.nodeEnv}`);

  if (config.isDevelopment) {
    console.log(`API available at http://localhost:${port}/api`);
    console.log(`Health check at http://localhost:${port}/api/health`);
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    console.log('HTTP server closed');

    try {
      // Close database connection
      const { closeDatabase } = await import('./db/index.js');
      await closeDatabase();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }

    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
