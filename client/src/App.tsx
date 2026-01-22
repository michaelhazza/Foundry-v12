import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/error-boundary';
import { ProtectedRoute } from '@/components/protected-route';

// Auth pages
import LoginPage from '@/pages/auth/login';
import RegisterPage from '@/pages/auth/register';
import ForgotPasswordPage from '@/pages/auth/forgot-password';
import ResetPasswordPage from '@/pages/auth/reset-password';
import AcceptInvitePage from '@/pages/auth/accept-invite';

// Main pages
import DashboardPage from '@/pages/dashboard';
import ProjectNewPage from '@/pages/projects/new';
import ProjectOverviewPage from '@/pages/projects/overview';
import ProjectSettingsPage from '@/pages/projects/settings';

// Source pages
import SourcesListPage from '@/pages/sources/list';
import SourceUploadPage from '@/pages/sources/upload';
import SourceConnectPage from '@/pages/sources/connect';
import SourceDetailPage from '@/pages/sources/detail';
import SchemaMappingPage from '@/pages/sources/schema-mapping';
import DeidentificationPage from '@/pages/sources/deidentification';

// Processing pages
import ProcessingConfigPage from '@/pages/processing/config';
import ProcessingRunPage from '@/pages/processing/run';
import ProcessingHistoryPage from '@/pages/processing/history';

// Dataset pages
import DatasetsListPage from '@/pages/datasets/list';
import DatasetDetailPage from '@/pages/datasets/detail';
import FilteredRecordsPage from '@/pages/datasets/filtered';

// Settings pages
import OrganizationSettingsPage from '@/pages/settings/organization';
import TeamManagementPage from '@/pages/settings/team';
import ProfilePage from '@/pages/settings/profile';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/:token" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/invite/:token" element={<AcceptInvitePage />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Project routes */}
        <Route
          path="/projects/new"
          element={
            <ProtectedRoute>
              <ProjectNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute>
              <ProjectOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/settings"
          element={
            <ProtectedRoute>
              <ProjectSettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Source routes */}
        <Route
          path="/projects/:projectId/sources"
          element={
            <ProtectedRoute>
              <SourcesListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/sources/upload"
          element={
            <ProtectedRoute>
              <SourceUploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/sources/connect"
          element={
            <ProtectedRoute>
              <SourceConnectPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/sources/:sourceId"
          element={
            <ProtectedRoute>
              <SourceDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/sources/:sourceId/schema"
          element={
            <ProtectedRoute>
              <SchemaMappingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/sources/:sourceId/deidentification"
          element={
            <ProtectedRoute>
              <DeidentificationPage />
            </ProtectedRoute>
          }
        />

        {/* Processing routes */}
        <Route
          path="/projects/:projectId/processing"
          element={
            <ProtectedRoute>
              <ProcessingConfigPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/processing/run"
          element={
            <ProtectedRoute>
              <ProcessingRunPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/processing/history"
          element={
            <ProtectedRoute>
              <ProcessingHistoryPage />
            </ProtectedRoute>
          }
        />

        {/* Dataset routes */}
        <Route
          path="/projects/:projectId/datasets"
          element={
            <ProtectedRoute>
              <DatasetsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/datasets/:datasetId"
          element={
            <ProtectedRoute>
              <DatasetDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/datasets/:datasetId/filtered"
          element={
            <ProtectedRoute>
              <FilteredRecordsPage />
            </ProtectedRoute>
          }
        />

        {/* Settings routes */}
        <Route
          path="/settings/organization"
          element={
            <ProtectedRoute>
              <OrganizationSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/team"
          element={
            <ProtectedRoute>
              <TeamManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
