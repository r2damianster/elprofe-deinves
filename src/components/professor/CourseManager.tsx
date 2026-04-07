import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, X, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CourseDetails from './CourseDetails';

interface Course {
  id: string;
  name: string;
  description: string | null;
  language: 'es' | 'en';
  created_at: string;
}

interface CourseManagerProps {
  courses: Course[];
  onUpdate: () => void;
  onAssignLessons: (courseId: string) => void;
}

export default function CourseManager({ courses, onUpdate, onAssignLessons }: CourseManagerProps) {
  const { profile } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseLanguage, setCourseLanguage] = useState<'es' | 'en'>('es');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('courses').insert({
        name: courseName,
        description: courseDescription,
        language: courseLanguage,
        professor_id: profile?.id,
      });

      if (error) throw error;

      setCourseName('');
      setCourseDescription('');
      setCourseLanguage('es');
      setShowCreateForm(false);
      onUpdate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Mis Cursos</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Crear Curso
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={createCourse} className="bg-blue-50 p-4 rounded-lg mb-6">
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nombre del Curso"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
            <textarea
              placeholder="Descripción"
              value={courseDescription}
              onChange={(e) => setCourseDescription(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              rows={3}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Idioma del curso</label>
              <div className="flex gap-3">
                {(['es', 'en'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setCourseLanguage(lang)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition ${
                      courseLanguage === lang
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 text-gray-600 hover:border-blue-400'
                    }`}
                  >
                    {lang === 'es' ? '🇪🇨 Español' : '🇺🇸 English'}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Curso'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map((course) => (
          <div
            key={course.id}
            className="border rounded-xl p-5 hover:border-blue-500 hover:shadow-md transition cursor-pointer bg-white flex flex-col justify-between"
            onClick={() => setSelectedCourseId(course.id)}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-lg text-gray-800">{course.name}</h3>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                  course.language === 'en'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {course.language === 'en' ? 'EN' : 'ES'}
                </span>
              </div>
              {course.description && (
                <p className="text-gray-600 text-sm mt-2 line-clamp-2">{course.description}</p>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
               <p className="text-gray-500 text-xs">
                {new Date(course.created_at).toLocaleDateString()}
              </p>
              <span className="text-blue-600 text-sm font-semibold flex items-center px-2 py-1 hover:bg-blue-50 rounded-lg">
                <Eye className="w-4 h-4 mr-1.5" />
                Ver Detalles
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full h-[90vh] overflow-hidden relative flex flex-col">
            <button
              onClick={() => setSelectedCourseId(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <CourseDetails 
              courseId={selectedCourse.id} 
              courseName={selectedCourse.name}
              onClose={() => setSelectedCourseId(null)}
              onAssignLessons={() => {
                setSelectedCourseId(null);
                onAssignLessons(selectedCourse.id);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
