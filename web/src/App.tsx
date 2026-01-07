import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DailyPlanPage } from './pages/DailyPlanPage';
import { DashboardPage } from './pages/DashboardPage';
// Coach chat disabled - high AI costs. Can be enabled if users request it.
// import { CoachChatPage } from './pages/CoachChatPage';
import { useAuthStore } from './store/authStore';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Layout>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/daily-plan" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/daily-plan" replace /> : <RegisterPage />}
        />

        {/* Protected routes */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/daily-plan"
          element={
            <ProtectedRoute>
              <DailyPlanPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        {/* Coach chat disabled - high AI costs. Can be enabled if users request it. */}
        {/* <Route
          path="/coach"
          element={
            <ProtectedRoute>
              <CoachChatPage />
            </ProtectedRoute>
          }
        /> */}

        {/* Default redirect */}
        <Route
          path="/"
          element={
            <Navigate to={isAuthenticated ? '/daily-plan' : '/login'} replace />
          }
        />
      </Routes>
    </Layout>
  );
}

export default App;
