import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, Users, ClipboardList, Loader2, BarChart2, PenSquare, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CourseManager from './CourseManager';
import StudioPanel from './StudioPanel';
import Asignaciones from './Asignaciones';
import Evaluaciones from './Evaluaciones';

interface Course {
  id: string;
  name: string;
  description: string | null;
  language: 'es' | 'en';
  created_at: string;
}

type ActiveTab = 'courses' | 'studio' | 'assignments' | 'evaluations';

export default function ProfessorDashboard({ onSwitchView }: { onSwitchView?: () => void }) {
  const { signOut, profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('courses');
  const [preselectedCourseId, setPreselectedCourseId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const loadCourses = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('professor_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setCourses(data as Course[]);
    } catch (error: any) {
      console.error('Error cargando cursos:', error.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) loadCourses();
  }, [profile?.id, loadCourses]);

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; color: string }[] = [
    {
      id: 'courses',
      label: 'Mis Cursos',
      icon: <Users className="w-5 h-5 mr-2" />,
      color: 'bg-blue-600',
    },
    {
      id: 'studio',
      label: 'Studio',
      icon: <PenSquare className="w-5 h-5 mr-2" />,
      color: 'bg-purple-600',
    },
    {
      id: 'assignments',
      label: 'Asignaciones',
      icon: <ClipboardList className="w-5 h-5 mr-2" />,
      color: 'bg-indigo-600',
    },
    {
      id: 'evaluations',
      label: 'Evaluaciones',
      icon: <BarChart2 className="w-5 h-5 mr-2" />,
      color: 'bg-emerald-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <BookOpen className="w-8 h-8 text-blue-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-800">Panel Profesor</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:inline">
              {profile?.full_name || 'Profesor'}
            </span>
            {onSwitchView && (
              <button
                onClick={onSwitchView}
                className="px-4 py-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition flex items-center"
              >
                <Shield className="w-4 h-4 mr-1" />
                Vista Admin
              </button>
            )}
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center px-4 py-2 rounded-lg transition ${
                activeTab === t.id
                  ? `${t.color} text-white`
                  : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            <p>Cargando tus cursos...</p>
          </div>
        ) : (
          <>
            {activeTab === 'courses' && (
              <CourseManager
                courses={courses}
                onUpdate={loadCourses}
              />
            )}
            {activeTab === 'studio' && (
              <StudioPanel courses={courses} />
            )}
            {activeTab === 'assignments' && (
              <Asignaciones
                courses={courses}
                initialCourseId={preselectedCourseId}
              />
            )}
            {activeTab === 'evaluations' && (
              <Evaluaciones />
            )}
          </>
        )}
      </main>
    </div>
  );
}
