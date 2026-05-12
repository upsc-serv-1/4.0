import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { useAdminAuth } from './hooks/useAdminAuth';
import Login from './components/auth/Login';

// Lazy-loaded page components
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const QuestionsPage = lazy(() => import('./components/questions/QuestionsPage'));
const TestsPage = lazy(() => import('./components/tests/TestsPage'));
const FlashcardsPage = lazy(() => import('./components/flashcards/FlashcardsPage'));
const UsersPage = lazy(() => import('./components/users/UsersPage'));
const AnalyticsPage = lazy(() => import('./components/analytics/AnalyticsPage'));
const DataHealthPage = lazy(() => import('./components/data-health/DataHealthPage'));
const BulkOperationsPage = lazy(() => import('./components/bulk-operations/BulkOperationsPage'));
const TaxonomyPage = lazy(() => import('./components/taxonomy/TaxonomyPage'));
const DedupManager = lazy(() => import('./components/dedup/DedupManager'));
const SoftNotesAdminPage = lazy(() => import('./components/softnotes/SoftNotesAdminPage'));
const NotesAdminPage = lazy(() => import('./components/notes/NotesAdminPage'));
const QuestionStatesPage = lazy(() => import('./components/analytics/QuestionStatesPage'));
const AdminSettingsPage = lazy(() => import('./components/settings/AdminSettingsPage'));

function Loading() {
  return (
    <div className="h-full flex items-center justify-center text-muted p-12">
      <div className="text-sm">Loading...</div>
    </div>
  );
}

export default function App() {
  const { session, loading, isAdmin } = useAdminAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-muted">Loading\u2026</div>;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (!isAdmin) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <h1 className="text-2xl font-bold">Not authorized</h1>
        <p className="text-muted max-w-md">
          Your account exists but is not in the <code>admin_users</code> table. Ask a super-admin to add you, then log in again.
        </p>
      </div>
    );
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  return (
    <Shell>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/questions" element={<QuestionsPage />} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/question-states" element={<QuestionStatesPage />} />
          <Route path="/data-health" element={<DataHealthPage />} />
          <Route path="/bulk-operations" element={<BulkOperationsPage />} />
          <Route path="/taxonomy" element={<TaxonomyPage />} />
          <Route path="/dedup" element={<DedupManager />} />
          <Route path="/softnotes" element={<SoftNotesAdminPage />} />
          <Route path="/notes" element={<NotesAdminPage />} />
          <Route path="/settings" element={<AdminSettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}