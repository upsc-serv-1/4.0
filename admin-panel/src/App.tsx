import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { useAdminAuth } from './hooks/useAdminAuth';
import Login from './components/auth/Login';
import AccessControlPage from './pages/AccessControlPage';

// Lazy-loaded page components
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const QuestionsPage = lazy(() => import('./components/questions/QuestionsPage'));
const TestsPage = lazy(() => import('./components/tests/TestsPage'));
const FlashcardsPage = lazy(() => import('./components/flashcards/FlashcardsPage'));
const UsersPage = lazy(() => import('./components/users/UsersPage'));
const DedupManager = lazy(() => import('./pages/DedupManager'));
const BulkOperationsPage = lazy(() => import('./pages/BulkOperationsPage'));

const AdminSettingsPage = () => <PlaceholderPage name="Settings" />;

// Placeholders for missing secondary files
function PlaceholderPage({ name }: { name: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-black mb-4 flex items-center gap-2">
        <div className="w-3 h-8 bg-primary rounded"></div>
        {name}
      </h1>
      <div className="bg-panel border border-border border-dashed rounded-xl p-12 text-center">
        <div className="text-lg font-bold mb-2">Under Construction</div>
        <p className="text-muted max-w-md mx-auto text-sm">
          This page component is currently under active development.
        </p>
      </div>
    </div>
  );
}

const AnalyticsPage = () => <PlaceholderPage name="Analytics" />;
const DataHealthPage = () => <PlaceholderPage name="Data Health" />;
const TaxonomyPage = () => <PlaceholderPage name="Taxonomy" />;
const SoftNotesAdminPage = () => <PlaceholderPage name="Soft Notes" />;
const NotesAdminPage = () => <PlaceholderPage name="Notes" />;
const QuestionStatesPage = () => <PlaceholderPage name="Question States" />;

function Loading() {
  return (
    <div className="h-full flex items-center justify-center text-muted p-12">
      <div className="text-sm">Loading admin view…</div>
    </div>
  );
}

export default function App() {
  const { session, loading, isAdmin } = useAdminAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-muted">Loading…</div>;
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
          Your account is not registered as an admin. Contact super-admin to enable access.
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
          <Route path="/access-control" element={<AccessControlPage />} />
          <Route path="/settings" element={<AdminSettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}