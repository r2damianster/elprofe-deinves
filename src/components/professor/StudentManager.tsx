import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Student {
  id: string;
  email: string;
  full_name: string;
}

interface StudentManagerProps {
  courseId: string;
}

export default function StudentManager({ courseId }: StudentManagerProps) {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStudents();
  }, [courseId]);

  async function loadStudents() {
    const { data } = await supabase
      .from('course_students')
      .select('student_id, profiles(id, email, full_name)')
      .eq('course_id', courseId);

    if (data) {
      const studentsList = data
        .map((item: any) => item.profiles)
        .filter((s: any) => s !== null);
      setStudents(studentsList);
    }
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        await supabase.from('profiles').insert({
          id: authData.user.id,
          email,
          full_name: fullName,
          role: 'student',
        });

        await supabase.from('course_students').insert({
          course_id: courseId,
          student_id: authData.user.id,
        });
      }

      setEmail('');
      setFullName('');
      setPassword('');
      loadStudents();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeStudent(studentId: string) {
    if (!confirm('¿Estás seguro de remover este estudiante del curso?')) return;

    const { error } = await supabase
      .from('course_students')
      .delete()
      .eq('course_id', courseId)
      .eq('student_id', studentId);

    if (!error) {
      loadStudents();
    }
  }

  return (
    <div className="p-6">
      <form onSubmit={addStudent} className="bg-gray-50 p-4 rounded-lg mb-6">
        <h4 className="font-semibold mb-4 text-gray-800">Agregar Nuevo Estudiante</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Nombre Completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="px-4 py-2 border rounded-lg"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-4 py-2 border rounded-lg"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-2 border rounded-lg"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          {loading ? 'Agregando...' : 'Agregar Estudiante'}
        </button>
      </form>

      <div>
        <h4 className="font-semibold mb-4 text-gray-800">Estudiantes en el Curso</h4>
        {students.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay estudiantes en este curso</p>
        ) : (
          <div className="space-y-2">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-800">{student.full_name}</p>
                  <p className="text-sm text-gray-600">{student.email}</p>
                </div>
                <button
                  onClick={() => removeStudent(student.id)}
                  className="text-red-600 hover:text-red-800 transition"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
