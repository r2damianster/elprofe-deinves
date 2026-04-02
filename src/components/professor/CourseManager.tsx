import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import StudentManager from './StudentManager';

interface Course {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface CourseManagerProps {
  courses: Course[];
  onUpdate: () => void;
}

export default function CourseManager({ courses, onUpdate }: CourseManagerProps) {
  const { profile } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('courses').insert({
        name: courseName,
        description: courseDescription,
        professor_id: profile?.id,
      });

      if (error) throw error;

      setCourseName('');
      setCourseDescription('');
      setShowCreateForm(false);
      onUpdate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

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
            className="border rounded-lg p-4 hover:border-blue-500 transition cursor-pointer"
            onClick={() => setSelectedCourse(course.id)}
          >
            <h3 className="font-semibold text-lg text-gray-800">{course.name}</h3>
            {course.description && (
              <p className="text-gray-600 text-sm mt-2">{course.description}</p>
            )}
            <p className="text-gray-500 text-xs mt-2">
              Creado: {new Date(course.created_at).toLocaleDateString()}
            </p>
            <button className="mt-3 text-blue-600 text-sm font-semibold hover:underline flex items-center">
              <UserPlus className="w-4 h-4 mr-1" />
              Gestionar Estudiantes
            </button>
          </div>
        ))}
      </div>

      {selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-bold">Gestionar Estudiantes</h3>
              <button
                onClick={() => setSelectedCourse(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <StudentManager courseId={selectedCourse} />
          </div>
        </div>
      )}
    </div>
  );
}
