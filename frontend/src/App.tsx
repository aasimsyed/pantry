import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';

const Inventory = lazy(() => import('./pages/Inventory'));
const Expiring = lazy(() => import('./pages/Expiring'));
const Recipes = lazy(() => import('./pages/Recipes'));
const Statistics = lazy(() => import('./pages/Statistics'));
const RecipeBox = lazy(() => import('./pages/RecipeBox'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/*"
            element={
              <Layout>
                <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-gray-500">Loading…</div>}>
                  <Routes>
                    <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                    <Route path="/expiring" element={<ProtectedRoute><Expiring /></ProtectedRoute>} />
                    <Route path="/recipes" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
                    <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
                    <Route path="/recipe-box" element={<ProtectedRoute><RecipeBox /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  </Routes>
                </Suspense>
              </Layout>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
