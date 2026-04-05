import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Plus, Trash2, BookOpen, ChevronDown, ChevronUp, Loader2, UserPlus } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  course_id: string;
  created_at: string;
}

interface GroupMember {
  student_id: string;
  full_name: string;
  email: string;
}

interface GroupLesson {
  id: string;          // group_lesson_assignment id
  lesson_id: string;
  lesson_title: string;
}

interface CourseStudent {
  id: string;
  full_name: string;
  email: string;
}

interface Lesson {
  id: string;
  title: string;
}

interface Props {
  courseId: string;
}

export default function GroupManager({ courseId }: Props) {
  const { profile } = useAuth();

  const [groups, setGroups]               = useState<Group[]>([]);
  const [expanded, setExpanded]           = useState<string | null>(null);
  const [membersByGroup, setMembersByGroup] = useState<Record<string, GroupMember[]>>({});
  const [lessonsByGroup, setLessonsByGroup] = useState<Record<string, GroupLesson[]>>({});
  const [courseStudents, setCourseStudents] = useState<CourseStudent[]>([]);
  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([]);
  const [loading, setLoading]             = useState(true);
  const [newGroupName, setNewGroupName]   = useState('');
  const [creating, setCreating]           = useState(false);
  const [addingMember, setAddingMember]   = useState<Record<string, string>>({});   // groupId → studentId
  const [addingLesson, setAddingLesson]   = useState<Record<string, string>>({});   // groupId → lessonId

  useEffect(() => { loadAll(); }, [courseId]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadGroups(), loadCourseStudents(), loadAvailableLessons()]);
    setLoading(false);
  }

  async function loadGroups() {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at');
    setGroups(data || []);
  }

  async function loadGroupDetail(groupId: string) {
    const [{ data: members }, { data: lessons }] = await Promise.all([
      supabase
        .from('group_members')
        .select('student_id, profiles!student_id(full_name, email)')
        .eq('group_id', groupId),
      supabase
        .from('group_lesson_assignments')
        .select('id, lesson_id, lessons!lesson_id(title)')
        .eq('group_id', groupId),
    ]);

    setMembersByGroup(prev => ({
      ...prev,
      [groupId]: (members || []).map((m: any) => ({
        student_id: m.student_id,
        full_name: m.profiles.full_name,
        email: m.profiles.email,
      })),
    }));

    setLessonsByGroup(prev => ({
      ...prev,
      [groupId]: (lessons || []).map((l: any) => ({
        id: l.id,
        lesson_id: l.lesson_id,
        lesson_title: l.lessons.title,
      })),
    }));
  }

  async function loadCourseStudents() {
    const { data } = await supabase
      .from('course_students')
      .select('student_id, profiles!student_id(full_name, email)')
      .eq('course_id', courseId);
    setCourseStudents((data || []).map((r: any) => ({
      id: r.student_id,
      full_name: r.profiles.full_name,
      email: r.profiles.email,
    })));
  }

  async function loadAvailableLessons() {
    const { data } = await supabase
      .from('lesson_assignments')
      .select('lesson_id, lessons!lesson_id(id, title)')
      .eq('course_id', courseId)
      .is('student_id', null);
    setAvailableLessons((data || []).map((r: any) => ({
      id: r.lesson_id,
      title: r.lessons.title,
    })));
  }

  function toggleGroup(groupId: string) {
    if (expanded === groupId) {
      setExpanded(null);
    } else {
      setExpanded(groupId);
      if (!membersByGroup[groupId]) loadGroupDetail(groupId);
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .insert({ course_id: courseId, name: newGroupName.trim(), created_by: profile?.id })
        .select().single();
      if (error) throw error;
      setGroups(prev => [...prev, data]);
      setNewGroupName('');
    } catch (err: any) { alert(err.message); }
    finally { setCreating(false); }
  }

  async function deleteGroup(groupId: string, name: string) {
    if (!confirm(`¿Eliminar el grupo "${name}"? Se perderá su progreso grupal.`)) return;
    await supabase.from('groups').delete().eq('id', groupId);
    setGroups(prev => prev.filter(g => g.id !== groupId));
    if (expanded === groupId) setExpanded(null);
  }

  async function addMember(groupId: string) {
    const studentId = addingMember[groupId];
    if (!studentId) return;
    try {
      await supabase.from('group_members').insert({ group_id: groupId, student_id: studentId });
      setAddingMember(prev => ({ ...prev, [groupId]: '' }));
      await loadGroupDetail(groupId);
    } catch (err: any) { alert(err.message); }
  }

  async function removeMember(groupId: string, studentId: string) {
    await supabase.from('group_members').delete()
      .eq('group_id', groupId).eq('student_id', studentId);
    setMembersByGroup(prev => ({
      ...prev,
      [groupId]: prev[groupId].filter(m => m.student_id !== studentId),
    }));
  }

  async function assignLesson(groupId: string) {
    const lessonId = addingLesson[groupId];
    if (!lessonId) return;
    try {
      await supabase.from('group_lesson_assignments').insert({
        group_id: groupId,
        lesson_id: lessonId,
        assigned_by: profile?.id,
      });
      setAddingLesson(prev => ({ ...prev, [groupId]: '' }));
      await loadGroupDetail(groupId);
    } catch (err: any) { alert(err.message); }
  }

  async function removeLesson(groupId: string, assignmentId: string) {
    await supabase.from('group_lesson_assignments').delete().eq('id', assignmentId);
    setLessonsByGroup(prev => ({
      ...prev,
      [groupId]: prev[groupId].filter(l => l.id !== assignmentId),
    }));
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando grupos...
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Crear grupo */}
      <div className="flex gap-2">
        <input
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createGroup()}
          placeholder="Nombre del nuevo grupo..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button onClick={createGroup} disabled={creating || !newGroupName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
          <Plus className="w-4 h-4" /> Crear grupo
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="font-medium">No hay grupos en este curso.</p>
          <p className="text-sm mt-1">Crea el primero arriba.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(group => {
            const members  = membersByGroup[group.id] || [];
            const lessons  = lessonsByGroup[group.id] || [];
            const isOpen   = expanded === group.id;

            // Estudiantes del curso que aún no están en este grupo
            const available = courseStudents.filter(
              s => !members.some(m => m.student_id === s.id)
            );
            // Lecciones que aún no están asignadas a este grupo
            const unassignedLessons = availableLessons.filter(
              l => !lessons.some(gl => gl.lesson_id === l.id)
            );

            return (
              <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">

                {/* Header del grupo */}
                <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
                  onClick={() => toggleGroup(group.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-800">{group.name}</p>
                      <p className="text-xs text-gray-500">
                        {membersByGroup[group.id]
                          ? `${members.length} miembro(s) · ${lessons.length} lección(es) grupal(es)`
                          : 'Click para ver detalles'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); deleteGroup(group.id, group.name); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* Detalle expandido */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-4 grid md:grid-cols-2 gap-6">

                    {/* Miembros */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" /> Miembros
                      </h4>

                      {members.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Sin miembros aún.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {members.map(m => (
                            <div key={m.student_id} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg text-sm">
                              <span className="font-medium text-gray-700">{m.full_name}</span>
                              <button onClick={() => removeMember(group.id, m.student_id)}
                                className="text-gray-400 hover:text-red-500 transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Agregar miembro */}
                      {available.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          <select
                            value={addingMember[group.id] || ''}
                            onChange={e => setAddingMember(prev => ({ ...prev, [group.id]: e.target.value }))}
                            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400">
                            <option value="">Agregar estudiante...</option>
                            {available.map(s => (
                              <option key={s.id} value={s.id}>{s.full_name}</option>
                            ))}
                          </select>
                          <button onClick={() => addMember(group.id)}
                            disabled={!addingMember[group.id]}
                            className="px-2 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Lecciones grupales */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-green-500" /> Lecciones grupales
                      </h4>

                      {lessons.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Sin lecciones grupales asignadas.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {lessons.map(l => (
                            <div key={l.id} className="flex items-center justify-between px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg text-sm">
                              <span className="font-medium text-green-800 truncate">{l.lesson_title}</span>
                              <button onClick={() => removeLesson(group.id, l.id)}
                                className="text-gray-400 hover:text-red-500 transition ml-2 shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Asignar lección grupal */}
                      {unassignedLessons.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          <select
                            value={addingLesson[group.id] || ''}
                            onChange={e => setAddingLesson(prev => ({ ...prev, [group.id]: e.target.value }))}
                            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400">
                            <option value="">Asignar lección grupal...</option>
                            {unassignedLessons.map(l => (
                              <option key={l.id} value={l.id}>{l.title}</option>
                            ))}
                          </select>
                          <button onClick={() => assignLesson(group.id)}
                            disabled={!addingLesson[group.id]}
                            className="px-2 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
