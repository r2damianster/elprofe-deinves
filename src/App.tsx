import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import AdminDashboard from './components/admin/AdminDashboard';
import ProfessorDashboard from './components/professor/ProfessorDashboard';
import StudentDashboard from './components/student/StudentDashboard';
import { Shield, BookOpen } from 'lucide-react';

function DashboardSelector({ onSelect }: { onSelect: (dashboard: 'admin' | 'professor') => void }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Selecciona tu vista</h2>
          <p className="text-gray-600">Tienes permisos de administrador y profesor</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => onSelect('admin')}
            className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition border-2 border-transparent hover:border-purple-500 text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Administrador</h3>
                <p className="text-sm text-gray-500">Gestionar profesores, cursos y plataforma</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => onSelect('professor')}
            className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition border-2 border-transparent hover:border-blue-500 text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Profesor</h3>
                <p className="text-sm text-gray-500">Gestionar cursos, estudiantes y lecciones</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'admin' | 'professor' | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  // Dual role: professor + admin -> show selector
  if (profile.role === 'professor' && profile.is_admin) {
    if (!currentView) {
      return <DashboardSelector onSelect={setCurrentView} />;
    }
    if (currentView === 'admin') {
      return <AdminDashboard onSwitchView={() => setCurrentView('professor')} />;
    }
    return <ProfessorDashboard onSwitchView={() => setCurrentView('admin')} />;
  }

  // Single role routing
  switch (profile.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'professor':
      return <ProfessorDashboard />;
    case 'student':
      return <StudentDashboard />;
    default:
      return <Login />;
  }
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
