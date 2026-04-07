import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, Users, ClipboardList, Loader2, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CourseManager from './CourseManager';
import LessonAssignment from './LessonAssignment';
import ProductionReviewer from './ProductionReviewer';

interface Course {
  id: string;
  name: string;
  description: string | null;
  language: 'es' | 'en';
  created_at: string;
}

export default function ProfessorDashboard() {
  const { signOut, profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeTab, setActiveTab] = useState<'courses' | 'assignments' | 'productions'>('courses');
  const [preselectedCourseId, setPreselectedCourseId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  // Usamos useCallback para que la función sea estable y se pueda reutilizar
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
      if (data) setCourses(data);
    } catch (error: any) {
      console.error('Error cargando cursos:', error.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  // Este useEffect es la clave: se dispara cuando el componente monta 
  // Y CADA VEZ que el profile cambie (de null a cargado)
  useEffect(() => {
    if (profile?.id) {
      loadCourses();
    }
  }, [profile?.id, loadCourses]);

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
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex items-center px-4 py-2 rounded-lg transition ${
              activeTab === 'courses'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'
            }`}
          >
            <Users className="w-5 h-5 mr-2" />
            Mis Cursos
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex items-center px-4 py-2 rounded-lg transition ${
              activeTab === 'assignments'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'
            }`}
          >
            <ClipboardList className="w-5 h-5 mr-2" />
            Asignar Lecciones
          </button>
          <button
            onClick={() => setActiveTab('productions')}
            className={`flex items-center px-4 py-2 rounded-lg transition ${
              activeTab === 'productions'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'
            }`}
          >
            <FileText className="w-5 h-5 mr-2" />
            Producciones
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            <p>Cargando tus cursos...</p>
          </div>
        ) : (
          <>
            {activeTab === 'courses' ? (
              <CourseManager 
                courses={courses} 
                onUpdate={loadCourses} 
                onAssignLessons={(courseId) => {
                  setPreselectedCourseId(courseId);
                  setActiveTab('assignments');
                }}
              />
            ) : activeTab === 'assignments' ? (
              <LessonAssignment
                courses={courses}
                initialCourseId={preselectedCourseId}
              />
            ) : (
              <ProductionReviewer />
            )}
          </>
        )}
      </main>
    </div>
  );
}