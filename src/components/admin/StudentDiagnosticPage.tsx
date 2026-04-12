import React, { useState, useEffect, Component, ErrorInfo, ReactNode, ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, AlertTriangle, CheckCircle, XCircle, Search, RefreshCw, ArrowLeft } from 'lucide-react';

// Simple class-based error boundary
class ErrorBoundary extends Component<
  { fallback: ReactNode; onBack: () => void },
  { hasError: boolean }
> {
  constructor(props: { fallback: ReactNode; onBack: () => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('StudentDiagnosticPage crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

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

function StudentDiagnosticContent({ onBack }: StudentDiagnosticPageProps) {
  const { signOut } = useAuth();
  const [students, setStudents] = useState<StudentDiagnostic[]>([]);
  const [coursesWithLessons, setCoursesWithLessons] = useState<CourseLessons[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyWithIssues, setOnlyWithIssues] = useState(false);

  useEffect(() => {
    void loadDiagnostic();
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

      if (profilesError) {
        setError('Error al cargar perfiles: ' + profilesError.message);
        setStudents([]);
        setCoursesWithLessons([]);
        setLoading(false);
        return;
      }

      if (!profiles || profiles.length === 0) {
        setStudents([]);
        setCoursesWithLessons([]);
        setLoading(false);
        return;
      }

      // 2. Get enrollments
      const { data: enrollments } = await supabase
        .from('course_students')
        .select('student_id, course_id, enrolled_at, courses(name)');

      // 3. Get lesson assignments
      const { data: assignments } = await supabase
        .from('lesson_assignments')
        .select('lesson_id, course_id, student_id');

      // 4. Get student progress
      const { data: progress } = await supabase
        .from('student_progress')
        .select('student_id, lesson_id');

      // 5. Get courses
      const { data: courses } = await supabase
        .from('courses')
        .select('id, name');

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

      const coursesWithLessonsData: CourseLessons[] = (courses || []).map(function(c) {
        return {
          course_id: c.id,
          course_name: c.name,
          lesson_count: courseLessonsMap.has(c.id) ? courseLessonsMap.get(c.id)!.size : 0,
        };
      });
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
            course_name: (e.courses && e.courses.name) || 'Desconocido',
            enrolled_at: e.enrolled_at,
          });
        }
      }

      // Build assignment map
      const assignmentMap = new Map<string, boolean>();
      if (assignments) {
        for (const a of assignments) {
          if (a.course_id) assignmentMap.set('course_' + a.course_id, true);
          if (a.student_id) assignmentMap.set('student_' + a.student_id, true);
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
      const diagnostics: StudentDiagnostic[] = profiles.map(function(p) {
        const issues: string[] = [];
        const enrolledCourses = enrollmentMap.get(p.id) || [];
        const hasAssignments = assignmentMap.has('student_' + p.id) ||
          enrolledCourses.some(function(ec) { return assignmentMap.has('course_' + ec.course_id); });
        const hasProgress = progressMap.has(p.id);

        if (enrolledCourses.length === 0) {
          issues.push('No está inscrito en ningún curso');
        }
        if (!hasAssignments) {
          issues.push('No tiene lecciones asignadas (ni directo ni vía curso)');
        }

        if (enrolledCourses.length > 0) {
          const coursesWithoutLessons = enrolledCourses.filter(
            function(ec) { return !courseLessonsMap.has(ec.course_id) || courseLessonsMap.get(ec.course_id)!.size === 0; }
          );
          if (coursesWithoutLessons.length > 0) {
            issues.push('Curso sin lecciones asignadas: ' + coursesWithoutLessons.map(function(c) { return c.course_name; }).join(', '));
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
          issues: issues,
        };
      });

      setStudents(diagnostics);
    } catch (err: any) {
      setError(err.message || 'Error desconocido al cargar los datos');
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents = students.filter(function(s) {
    const matchesSearch = searchTerm === '' ||
      s.full_name.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1 ||
      s.email.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1;
    const matchesIssues = !onlyWithIssues || s.issues.length > 0;
    return matchesSearch && matchesIssues;
  });

  // Always return a valid JSX element
  return React.createElement('div', { className: 'min-h-screen bg-gray-50' }, [
    React.createElement('header', { key: 'header', className: 'bg-white shadow' },
      React.createElement('div', { className: 'max-w-7xl mx-auto px-4 py-4 flex justify-between items-center' },
        React.createElement('div', { className: 'flex items-center' },
          React.createElement('button', {
            onClick: onBack,
            className: 'mr-4 p-2 hover:bg-gray-100 rounded-lg transition'
          }, React.createElement(ArrowLeft, { className: 'w-5 h-5 text-gray-600' })),
          React.createElement(BookOpen, { className: 'w-8 h-8 text-blue-600 mr-3' }),
          React.createElement('div', null,
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Diagnóstico de Estudiantes'),
            React.createElement('p', { className: 'text-sm text-gray-500' }, 'Verifica el estado de acceso de todos los estudiantes')
          )
        ),
        React.createElement('div', { className: 'flex gap-2' },
          React.createElement('button', {
            onClick: loadDiagnostic,
            className: 'px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition flex items-center'
          }, React.createElement(RefreshCw, { className: 'w-4 h-4 mr-2' }), 'Recargar'),
          React.createElement('button', {
            onClick: signOut,
            className: 'px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition'
          }, 'Cerrar Sesión')
        )
      )
    ),
    React.createElement('main', { key: 'main', className: 'max-w-7xl mx-auto px-4 py-8' },
      // Error display
      error ? React.createElement('div', {
        key: 'error',
        className: 'bg-red-50 border border-red-200 rounded-lg p-6 mb-6'
      },
        React.createElement('div', { className: 'flex items-start gap-3' },
          React.createElement(XCircle, { className: 'w-6 h-6 text-red-500 flex-shrink-0 mt-0.5' }),
          React.createElement('div', null,
            React.createElement('h3', { className: 'font-semibold text-red-800 mb-1' }, 'Error al cargar los datos'),
            React.createElement('p', { className: 'text-sm text-red-700 mb-3' }, error),
            React.createElement('button', {
              onClick: loadDiagnostic,
              className: 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm'
            }, 'Intentar de nuevo')
          )
        )
      ) : null,

      // Summary cards
      students.length > 0 ? React.createElement('div', {
        key: 'summary',
        className: 'grid grid-cols-1 md:grid-cols-4 gap-4 mb-8'
      },
        React.createElement('div', { className: 'bg-white rounded-lg shadow p-6' },
          React.createElement('p', { className: 'text-sm text-gray-500' }, 'Total Estudiantes'),
          React.createElement('p', { className: 'text-3xl font-bold text-gray-800' }, students.length)
        ),
        React.createElement('div', { className: 'bg-white rounded-lg shadow p-6' },
          React.createElement('p', { className: 'text-sm text-gray-500' }, 'Sin Problemas'),
          React.createElement('p', { className: 'text-3xl font-bold text-green-600' },
            students.filter(function(s) { return s.issues.length === 0; }).length)
        ),
        React.createElement('div', { className: 'bg-white rounded-lg shadow p-6' },
          React.createElement('p', { className: 'text-sm text-gray-500' }, 'Con Problemas'),
          React.createElement('p', { className: 'text-3xl font-bold text-orange-600' },
            students.filter(function(s) { return s.issues.length > 0; }).length)
        ),
        React.createElement('div', { className: 'bg-white rounded-lg shadow p-6' },
          React.createElement('p', { className: 'text-sm text-gray-500' }, 'Cursos con Lecciones'),
          React.createElement('p', { className: 'text-3xl font-bold text-blue-600' },
            coursesWithLessons.filter(function(c) { return c.lesson_count > 0; }).length + ' / ' + coursesWithLessons.length)
        )
      ) : null,

      // Filters
      students.length > 0 ? React.createElement('div', {
        key: 'filters',
        className: 'bg-white rounded-lg shadow p-4 mb-6 flex gap-4 items-center'
      },
        React.createElement('div', { className: 'flex-1 relative' },
          React.createElement(Search, { className: 'w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400' }),
          React.createElement('input', {
            type: 'text',
            placeholder: 'Buscar por nombre o email...',
            value: searchTerm,
            onChange: function(e: ChangeEvent<HTMLInputElement>) { setSearchTerm(e.target.value); },
            className: 'w-full pl-10 pr-4 py-2 border rounded-lg'
          })
        ),
        React.createElement('label', { className: 'flex items-center gap-2 cursor-pointer' },
          React.createElement('input', {
            type: 'checkbox',
            checked: onlyWithIssues,
            onChange: function(e: ChangeEvent<HTMLInputElement>) { setOnlyWithIssues(e.target.checked); },
            className: 'rounded border-gray-300'
          }),
          React.createElement('span', { className: 'text-sm text-gray-700' }, 'Solo con problemas')
        )
      ) : null,

      // Loading
      loading ? React.createElement('div', {
        key: 'loading',
        className: 'text-center py-16'
      },
        React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4' }),
        React.createElement('p', { className: 'text-gray-600' }, 'Cargando diagnóstico...')
      ) : null,

      // Student list
      !loading && !error ? React.createElement('div', { key: 'students', className: 'space-y-4' },
        filteredStudents.map(function(student) {
          return React.createElement('div', {
            key: student.id,
            className: 'bg-white rounded-lg shadow overflow-hidden'
          },
            React.createElement('div', { className: 'p-6' },
              React.createElement('div', { className: 'flex items-center gap-3 mb-2' },
                React.createElement('h3', { className: 'text-lg font-semibold text-gray-800' }, student.full_name),
                student.issues.length > 0
                  ? React.createElement(AlertTriangle, { className: 'w-5 h-5 text-orange-500' })
                  : React.createElement(CheckCircle, { className: 'w-5 h-5 text-green-500' })
              ),
              React.createElement('p', { className: 'text-sm text-gray-600' }, student.email),
              React.createElement('div', { className: 'mt-4 grid grid-cols-1 md:grid-cols-3 gap-4' },
                React.createElement('div', { className: 'flex items-center gap-2' },
                  React.createElement(CheckCircle, { className: 'w-5 h-5 text-green-500' }),
                  React.createElement('span', { className: 'text-sm text-gray-700' }, 'Perfil OK')
                ),
                React.createElement('div', { className: 'flex items-center gap-2' },
                  student.enrolled_courses.length > 0
                    ? React.createElement(CheckCircle, { className: 'w-5 h-5 text-green-500' })
                    : React.createElement(XCircle, { className: 'w-5 h-5 text-red-500' }),
                  React.createElement('span', { className: 'text-sm text-gray-700' },
                    'Inscrito en ' + student.enrolled_courses.length + ' curso(s)')
                ),
                React.createElement('div', { className: 'flex items-center gap-2' },
                  student.has_lesson_assignments
                    ? React.createElement(CheckCircle, { className: 'w-5 h-5 text-green-500' })
                    : React.createElement(XCircle, { className: 'w-5 h-5 text-red-500' }),
                  React.createElement('span', { className: 'text-sm text-gray-700' }, 'Lecciones asignadas')
                )
              ),
              student.enrolled_courses.length > 0 ? React.createElement('div', { className: 'mt-4' },
                React.createElement('p', { className: 'text-sm font-medium text-gray-700 mb-2' }, 'Cursos:'),
                React.createElement('div', { className: 'flex flex-wrap gap-2' },
                  student.enrolled_courses.map(function(ec) {
                    return React.createElement('span', {
                      key: ec.course_id,
                      className: 'px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm'
                    }, ec.course_name);
                  })
                )
              ) : null,
              student.issues.length > 0 ? React.createElement('div', {
                className: 'mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4'
              },
                React.createElement('p', { className: 'text-sm font-medium text-orange-800 mb-2' }, 'Problemas detectados:'),
                React.createElement('ul', { className: 'space-y-1' },
                  student.issues.map(function(issue, idx) {
                    return React.createElement('li', {
                      key: idx,
                      className: 'text-sm text-orange-700 flex items-start gap-2'
                    }, React.createElement('span', { className: 'text-orange-500 mt-0.5' }, '•'), issue);
                  })
                )
              ) : null
            )
          );
        }),
        filteredStudents.length === 0 && students.length > 0
          ? React.createElement('div', {
              key: 'no-results',
              className: 'text-center py-16 bg-white rounded-lg shadow'
            },
              React.createElement(Search, { className: 'w-12 h-12 text-gray-400 mx-auto mb-4' }),
              React.createElement('p', { className: 'text-gray-600' }, 'No se encontraron estudiantes con esos filtros')
            )
          : null,
        students.length === 0
          ? React.createElement('div', {
              key: 'no-students',
              className: 'text-center py-16 bg-white rounded-lg shadow'
            },
              React.createElement(CheckCircle, { className: 'w-12 h-12 text-green-400 mx-auto mb-4' }),
              React.createElement('p', { className: 'text-gray-600' }, 'No hay estudiantes registrados en la plataforma')
            )
          : null
      ) : null
    )
  ]);
}

export default function StudentDiagnosticPage(props: StudentDiagnosticPageProps) {
  return React.createElement(ErrorBoundary, {
    fallback: React.createElement('div', {
      className: 'min-h-screen bg-gray-50 flex items-center justify-center'
    },
      React.createElement('div', {
        className: 'text-center bg-red-50 border border-red-200 rounded-lg p-8 max-w-md'
      },
        React.createElement(XCircle, { className: 'w-12 h-12 text-red-500 mx-auto mb-4' }),
        React.createElement('h3', { className: 'font-semibold text-red-800 mb-2' }, 'Error al cargar la página'),
        React.createElement('p', { className: 'text-sm text-red-700 mb-4' }, 'Ha ocurrido un error inesperado'),
        React.createElement('button', {
          onClick: props.onBack,
          className: 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm'
        }, 'Volver al panel')
      )
    ),
    onBack: props.onBack
  }, React.createElement(StudentDiagnosticContent, props));
}
