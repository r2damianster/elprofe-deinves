import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, LogIn, LogOut, Loader2, CheckCircle } from 'lucide-react';

interface OpenGroup {
  id: string;
  name: string;
  course_name: string;
  course_id: string;
  enrollment_open: boolean;
  max_members: number | null;
  member_count: number;
  i_am_member: boolean;
}

export default function GroupEnrollment() {
  const { profile } = useAuth();
  const [groups, setGroups]   = useState<OpenGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null);

  useEffect(() => { load(); }, [profile?.id]);

  async function load() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // Cursos del estudiante
      const { data: coursesData } = await supabase
        .from('course_students')
        .select('course_id, courses(id, name)')
        .eq('student_id', profile.id);

      if (!coursesData || coursesData.length === 0) { setGroups([]); return; }

      const courseIds = coursesData.map((c: any) => c.course_id);
      const courseNames: Record<string, string> = {};
      coursesData.forEach((c: any) => { courseNames[c.course_id] = c.courses.name; });

      // Grupos abiertos de esos cursos
      const { data: openGroups } = await supabase
        .from('groups')
        .select('id, name, course_id, enrollment_open, max_members')
        .in('course_id', courseIds)
        .eq('enrollment_open', true);

      if (!openGroups || openGroups.length === 0) { setGroups([]); return; }

      // Mis grupos actuales (en cualquier curso)
      const { data: myMemberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('student_id', profile.id);
      const myGroupIds = new Set((myMemberships || []).map((m: any) => m.group_id));

      // Conteo de miembros por grupo
      const { data: memberCounts } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', openGroups.map(g => g.id));

      const counts: Record<string, number> = {};
      (memberCounts || []).forEach((m: any) => {
        counts[m.group_id] = (counts[m.group_id] || 0) + 1;
      });

      const result: OpenGroup[] = openGroups.map((g: any) => ({
        id: g.id,
        name: g.name,
        course_id: g.course_id,
        course_name: courseNames[g.course_id] || '',
        enrollment_open: g.enrollment_open,
        max_members: g.max_members,
        member_count: counts[g.id] || 0,
        i_am_member: myGroupIds.has(g.id),
      }));

      setGroups(result);
    } finally {
      setLoading(false);
    }
  }

  async function joinGroup(groupId: string) {
    if (!profile?.id) return;
    setBusy(groupId);
    try {
      const { error } = await supabase.from('group_members')
        .insert({ group_id: groupId, student_id: profile.id });
      if (error) throw error;
      await load();
    } catch (err: any) {
      alert('Error al unirse: ' + err.message);
    } finally { setBusy(null); }
  }

  async function leaveGroup(groupId: string) {
    if (!profile?.id) return;
    if (!confirm('¿Salir de este grupo?')) return;
    setBusy(groupId);
    try {
      await supabase.from('group_members')
        .delete().eq('group_id', groupId).eq('student_id', profile.id);
      await load();
    } catch (err: any) {
      alert('Error al salir: ' + err.message);
    } finally { setBusy(null); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando grupos...
    </div>
  );

  // Agrupar por curso
  const byCourse: Record<string, OpenGroup[]> = {};
  groups.forEach(g => {
    if (!byCourse[g.course_id]) byCourse[g.course_id] = [];
    byCourse[g.course_id].push(g);
  });

  // Mis grupos consolidados (para saber si ya estoy en un grupo de ese curso)
  const myGroupByCourse: Record<string, OpenGroup> = {};
  groups.filter(g => g.i_am_member).forEach(g => { myGroupByCourse[g.course_id] = g; });

  if (groups.length === 0) return (
    <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
      <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
      <p className="font-medium">No hay grupos abiertos en tus cursos.</p>
      <p className="text-sm mt-1">Tu profesor habilitará la inscripción cuando esté listo.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {Object.entries(byCourse).map(([courseId, courseGroups]) => {
        const courseName = courseGroups[0].course_name;
        const myGroup    = myGroupByCourse[courseId];

        return (
          <div key={courseId} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-800 text-sm truncate">{courseName}</h3>
              {myGroup ? (
                <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Ya estás en <strong>{myGroup.name}</strong>
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-0.5">Selecciona un grupo para unirte</p>
              )}
            </div>

            <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {courseGroups.map(group => {
                const isFull     = group.max_members !== null && group.member_count >= group.max_members;
                const isMine     = group.i_am_member;
                const isInOther  = myGroup && !isMine;
                const isBusy     = busy === group.id;

                return (
                  <div key={group.id}
                    className={`border rounded-xl p-4 transition ${
                      isMine
                        ? 'border-blue-400 bg-blue-50'
                        : isFull
                        ? 'border-gray-200 bg-gray-50 opacity-60'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isMine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{group.name}</p>
                          <p className="text-xs text-gray-500">
                            {group.member_count} miembro{group.member_count !== 1 ? 's' : ''}
                            {group.max_members ? ` / ${group.max_members}` : ''}
                          </p>
                        </div>
                      </div>
                      {isFull && !isMine && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Lleno</span>
                      )}
                    </div>

                    {/* Barra de capacidad */}
                    {group.max_members && (
                      <div className="mb-3">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-red-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(100, (group.member_count / group.max_members) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {isMine ? (
                      <button
                        onClick={() => leaveGroup(group.id)}
                        disabled={isBusy}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-blue-300 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition disabled:opacity-50">
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                        Salir del grupo
                      </button>
                    ) : (
                      <button
                        onClick={() => joinGroup(group.id)}
                        disabled={isBusy || isFull || !!isInOther}
                        title={isInOther ? `Ya estás en ${myGroup?.name}` : isFull ? 'Grupo lleno' : ''}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition disabled:opacity-40">
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                        {isInOther ? 'Ya en otro grupo' : 'Unirme'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
