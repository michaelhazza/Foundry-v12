import { Router } from 'express';
import authRoutes from './auth.routes.js';
import organisationsRoutes from './organisations.routes.js';
import invitationsRoutes from './invitations.routes.js';
import projectsRoutes from './projects.routes.js';
import sourcesRoutes from './sources.routes.js';
import processingRoutes from './processing.routes.js';
import datasetsRoutes from './datasets.routes.js';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/organisations', organisationsRoutes);
router.use('/invitations', invitationsRoutes);
router.use('/projects', projectsRoutes);
router.use('/', sourcesRoutes); // Sources has nested routes like /projects/:id/sources
router.use('/', processingRoutes); // Processing has nested routes
router.use('/datasets', datasetsRoutes);

export default router;
