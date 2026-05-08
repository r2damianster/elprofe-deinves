import { useState } from 'react';
import { BookOpen, FlaskConical } from 'lucide-react';
import LessonAssignment from './LessonAssignment';
import ProjectAssignment from './ProjectAssignment';

type AssignTab = 'lessons' | 'projects';

interface Course { id: string; name: string; }

export default function Asignaciones({
  courses,
  initialCourseId,
}: {
  courses: Course[];
  initialCourseId?: string;
}) {
  const [tab, setTab] = useState<AssignTab>('lessons');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('lessons')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
            tab === 'lessons'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Lecciones
        </button>
        <button
          onClick={() => setTab('projects')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
            tab === 'projects'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          Proyectos
        </button>
      </div>

      {tab === 'lessons' ? (
        <LessonAssignment courses={courses} initialCourseId={initialCourseId} />
      ) : (
        <ProjectAssignment courses={courses} />
      )}
    </div>
  );
}
