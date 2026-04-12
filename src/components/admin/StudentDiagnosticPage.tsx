import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, AlertTriangle, CheckCircle, XCircle, Search, RefreshCw, ArrowLeft } from 'lucide-react';

interface StudentDiagnosticPageProps {
  onBack: () => void;
}

interface CourseEnrollment {
  course_id: string;
  course_name: string;
  enrolled_at: string;
}

interface CourseLessons {
  course_id: string;
  course_name: string;
  lesson_count: number;
}

interface StudentDiagnostic {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  enrolled_courses: CourseEnrollment[];
  has_lesson_assignments: boolean;
  has_progress: boolean;
  issues: string[];
}

export default function StudentDiagnosticPage({ onBack }: StudentDiagnosticPageProps) {
  const { signOut } = useAuth();
  const [students, setStudents] = useState<StudentDiagnostic[]>([]);
  const [coursesWithLessons, setCoursesWithLessons] = useState<CourseLessons[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyWithIssues, setOnlyWithIssues] = useState(false);

  useEffect(() => {
    loadDiagnostic();
  }, []);

  async function loadDiagnostic() {
    setLoading(true);
    setError(null);

    try {
      // 1. Get all students
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (profilesError) throw new Error(`Error loading profiles: ${profilesError.message}`);
      if (!profiles || profiles.length === 0) {
        setStudents([]);
        setCoursesWithLessons([]);
        setLoading(false);
        return;
      }

      // 2. Get all course enrollments with course names
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_students')
        .select('student_id, course_id, enrolled_at, courses(name)');

      if (enrollError) console.warn('Warning loading enrollments:', enrollError.message);

      // 3. Get all lesson assignments
      const { data: assignments, error: assignError } = await supabase
        .from('lesson_assignments')
        .select('lesson_id, course_id, student_id');

      if (assignError) console.warn('Warning loading assignments:', assignError.message);

      // 4. Get all student progress
      const { data: progress, error: progressError } = await supabase
        .from('student_progress')
        .select('student_id, lesson_id');

      if (progressError) console.warn('Warning loading progress:', progressError.message);

      // 5. Get courses and their lesson counts
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, name');

      if (coursesError) console.warn('Warning loading courses:', coursesError.message);

      // 6. Get lesson assignments per course
      const { data: lessonAssignments } = await supabase
        .from('lesson_assignments')
        .select('lesson_id, course_id');

      // Build course -> lessons map
      const courseLessonsMap = new Map<string, Set<string>>();
      if (lessonAssignments) {
        for (const la of lessonAssignments) {
          if (la.course_id) {
            if (!courseLessonsMap.has(la.course_id)) {
              courseLessonsMap.set(la.course_id, new Set());
            }
            courseLessonsMap.get(la.course_id)!.add(la.lesson_id);
          }
        }
      }

      const coursesWithLessonsData: CourseLessons[] = (courses || []).map(c => ({
        course_id: c.id,
        course_name: c.name,
        lesson_count: courseLessonsMap.get(c.id)?.size || 0,
      }));
      setCoursesWithLessons(coursesWithLessonsData);

      // Build enrollment map
      const enrollmentMap = new Map<string, CourseEnrollment[]>();
      if (enrollments) {
        for (const e of enrollments) {
          if (!enrollmentMap.has(e.student_id)) {
            enrollmentMap.set(e.student_id, []);
          }
          enrollmentMap.get(e.student_id)!.push({
            course_id: e.course_id,
            course_name: e.courses?.name || 'Desconocido',
            enrolled_at: e.enrolled_at,
          });
        }
      }

      // Build assignment map
      const assignmentMap = new Map<string, boolean>();
      if (assignments) {
        for (const a of assignments) {
          if (a.course_id) assignmentMap.set(`course_${a.course_id}`, true);
          if (a.student_id) assignmentMap.set(`student_${a.student_id}`, true);
        }
      }

      // Build progress map
      const progressMap = new Map<string, boolean>();
      if (progress) {
        for (const p of progress) {
          progressMap.set(p.student_id, true);
        }
      }

      // Build diagnostic for each student
      const diagnostics: StudentDiagnostic[] = profiles.map(p => {
        const issues: string[] = [];
        const enrolledCourses = enrollmentMap.get(p.id) || [];
        const hasAssignments = assignmentMap.has(`student_${p.id}`) ||
          enrolledCourses.some(ec => assignmentMap.has(`course_${ec.course_id}`));
        const hasProgress = progressMap.has(p.id);

        if (enrolledCourses.length === 0) {
          issues.push('No está inscrito en ningún curso');
        }
        if (!hasAssignments) {
          issues.push('No tiene lecciones asignadas (ni directo ni vía curso)');
        }

        if (enrolledCourses.length > 0) {
          const coursesWithoutLessons = enrolledCourses.filter(
            ec => !courseLessonsMap.has(ec.course_id) || courseLessonsMap.get(ec.course_id)!.size === 0
          );
          if (coursesWithoutLessons.length > 0) {
            issues.push(`Curso sin lecciones asignadas: ${coursesWithoutLessons.map(c => c.course_name).join(', ')}`);
          }
        }

        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          created_at: p.created_at,
          enrolled_courses: enrolledCourses,
          has_lesson_assignments: hasAssignments,
          has_progress: hasProgress,
          issues,
        };
      });

      setStudents(diagnostics);
    } catch (err: any) {
      console.error('Error loading diagnostic:', err);
      setError(err.message || 'Error desconocido al cargar los datos');
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents = students.filter(s => {
    const matchesSearch = searchTerm === '' ||
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIssues = !onlyWithIssues || s.issues.length > 0;
    return matchesSearch && matchesIssues;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <BookOpen className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Diagnóstico de Estudiantes</h1>
              <p className="text-sm text-gray-500">Verifica el estado de acceso de todos los estudiantes</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadDiagnostic}
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recargar
            </button>
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
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 mb-1">Error al cargar los datos</h3>
                <p className="text-sm text-red-700 mb-3">{error}</p>
                <button
                  onClick={loadDiagnostic}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                >
                  Intentar de nuevo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {students.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Total Estudiantes</p>
              <p className="text-3xl font-bold text-gray-800">{students.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Sin Problemas</p>
              <p className="text-3xl font-bold text-green-600">
                {students.filter(s => s.issues.length === 0).length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Con Problemas</p>
              <p className="text-3xl font-bold text-orange-600">
                {students.filter(s => s.issues.length > 0).length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Cursos con Lecciones</p>
              <p className="text-3xl font-bold text-blue-600">
                {coursesWithLessons.filter(c => c.lesson_count > 0).length} / {coursesWithLessons.length}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        {students.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyWithIssues}
                onChange={(e) => setOnlyWithIssues(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Solo con problemas</span>
            </label>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando diagnóstico...</p>
          </div>
        )}

        {/* Student List */}
        {!loading && !error && (
          <div className="space-y-4">
            {filteredStudents.map(student => (
              <div key={student.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{student.full_name}</h3>
                        {student.issues.length > 0 ? (
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{student.email}</p>
                      <p className="text-xs text-gray-500">
                        Creado: {new Date(student.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Status Indicators */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-sm text-gray-700">Perfil OK</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {student.enrolled_courses.length > 0 ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className="text-sm text-gray-700">
                        Inscrito en {student.enrolled_courses.length} curso(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {student.has_lesson_assignments ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className="text-sm text-gray-700">Lecciones asignadas</span>
                    </div>
                  </div>

                  {/* Enrolled Courses */}
                  {student.enrolled_courses.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Cursos:</p>
                      <div className="flex flex-wrap gap-2">
                        {student.enrolled_courses.map(ec => (
                          <span key={ec.course_id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                            {ec.course_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Issues */}
                  {student.issues.length > 0 && (
                    <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-orange-800 mb-2">Problemas detectados:</p>
                      <ul className="space-y-1">
                        {student.issues.map((issue, idx) => (
                          <li key={idx} className="text-sm text-orange-700 flex items-start gap-2">
                            <span className="text-orange-500 mt-0.5">•</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredStudents.length === 0 && students.length > 0 && (
              <div className="text-center py-16 bg-white rounded-lg shadow">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No se encontraron estudiantes con esos filtros</p>
              </div>
            )}

            {students.length === 0 && !error && (
              <div className="text-center py-16 bg-white rounded-lg shadow">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay estudiantes registrados en la plataforma</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
