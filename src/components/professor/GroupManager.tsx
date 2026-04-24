import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, Plus, Trash2, BookOpen, ChevronDown, ChevronUp,
  Loader2, UserPlus, Shuffle, ToggleLeft, ToggleRight, MoveRight,
  Heart, FolderOpen, Layers, Power, GripVertical,
} from 'lucide-react';

// ── Nombres creativos para grupos ────────────────────────────────────────────
const GROUP_NAME_SETS = [
  ['Mercurio','Venus','Marte','Júpiter','Saturno','Urano','Neptuno','Plutón','Ceres','Eris'],
  ['Jade','Coral','Ámbar','Índigo','Topacio','Rubí','Zafiro','Esmeralda','Cuarzo','Ópalo'],
  ['Halcón','Delfín','Jaguar','Cóndor','Mantis','Gaviota','Iguana','Puma','Tapir','Guacamayo'],
  ['Andes','Titicaca','Orinoco','Amazonas','Chimborazo','Cotopaxi','Galápagos','Patagonia'],
  ['Alfa','Beta','Gamma','Delta','Épsilon','Zeta','Eta','Theta','Iota','Kappa'],
  ['Aquiles','Ulises','Héctor','Penélope','Atenea','Artemisa','Apolo','Hermes','Iris','Eos'],
];

function pickGroupNames(n: number): string[] {
  const set = GROUP_NAME_SETS[Math.floor(Math.random() * GROUP_NAME_SETS.length)];
  return Array.from({ length: n }, (_, i) =>
    i < set.length ? set[i] : `${set[i % set.length]} ${Math.floor(i / set.length) + 1}`
  );
}

interface GroupSet {
  id: string;
  name: string;
  course_id: string;
  created_at: string;
  is_active: boolean;
}

interface Group {
  id: string;
  name: string;
  course_id: string;
  group_set_id: string | null;
  created_at: string;
  enrollment_open: boolean;
  max_members: number | null;
}

interface GroupMember {
  student_id: string;
  full_name: string;
  email: string;
}

interface SetLesson {
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

interface Props { courseId: string; }

type CreateMode = 'random' | 'affinity' | 'manual';

export default function GroupManager({ courseId }: Props) {
  const { profile } = useAuth();

  const [groupSets, setGroupSets]           = useState<GroupSet[]>([]);
  const [groupsBySet, setGroupsBySet]       = useState<Record<string, Group[]>>({});
  const [ungrouped, setUngrouped]           = useState<Group[]>([]);
  const [membersByGroup, setMembersByGroup] = useState<Record<string, GroupMember[]>>({});
  const [lessonsBySet, setLessonsBySet]     = useState<Record<string, SetLesson[]>>({});
  const [courseStudents, setCourseStudents] = useState<CourseStudent[]>([]);
  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([]);
  const [loading, setLoading]               = useState(true);

  // Expanded state
  const [expandedSet, setExpandedSet]       = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup]   = useState<string | null>(null);

  // Create agrupación form
  const [newSetName, setNewSetName]         = useState('');
  const [createMode, setCreateMode]         = useState<CreateMode>('random');
  const [randomSize, setRandomSize]         = useState(4);
  const [affinityMode, setAffinityMode]     = useState<'count' | 'max'>('count');
  const [affinityCount, setAffinityCount]   = useState(4);
  const [affinityMax, setAffinityMax]       = useState<number>(4);
  const [manualCount, setManualCount]       = useState(3);
  const [randomPreview, setRandomPreview]   = useState<{ name: string; members: CourseStudent[] }[] | null>(null);
  const [creatingSet, setCreatingSet]       = useState(false);

  // Drag-and-drop para asignación manual
  const [dndSetId, setDndSetId]             = useState<string | null>(null);
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);

  // Per-set lesson assignment
  const [addingLessonToSet, setAddingLessonToSet] = useState<Record<string, string>>({});

  // Per-group manual management
  const [addingMember, setAddingMember]     = useState<Record<string, string>>({});
  const [addingGroupToSet, setAddingGroupToSet] = useState<Record<string, string>>({});
  const [moveTarget, setMoveTarget]         = useState<Record<string, string>>({});

  useEffect(() => { loadAll(); }, [courseId]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadGroupSets(), loadGroups(), loadCourseStudents(), loadAvailableLessons()]);
    setLoading(false);
  }

  async function loadGroupSets() {
    const { data } = await supabase.from('group_sets').select('*')
      .eq('course_id', courseId).order('created_at');
    setGroupSets(data || []);
  }

  async function loadGroups() {
    const { data } = await supabase.from('groups').select('*')
      .eq('course_id', courseId).order('created_at');
    const bySet: Record<string, Group[]> = {};
    const noSet: Group[] = [];
    (data || []).forEach((g: Group) => {
      if (g.group_set_id) {
        bySet[g.group_set_id] = [...(bySet[g.group_set_id] || []), g];
      } else {
        noSet.push(g);
      }
    });
    setGroupsBySet(bySet);
    setUngrouped(noSet);
  }

  async function loadSetLessons(setId: string) {
    // Consultar grupos directamente desde BD para no depender del estado
    const { data: groupsData } = await supabase.from('groups')
      .select('id').eq('group_set_id', setId);
    const groupIds = (groupsData || []).map((g: any) => g.id);
    if (groupIds.length === 0) return;
    const { data } = await supabase
      .from('group_lesson_assignments')
      .select('lesson_id, lessons!lesson_id(title)')
      .in('group_id', groupIds);
    const seen = new Set<string>();
    const unique: SetLesson[] = [];
    (data || []).forEach((r: any) => {
      if (!seen.has(r.lesson_id)) {
        seen.add(r.lesson_id);
        const t = r.lessons.title;
        unique.push({ lesson_id: r.lesson_id, lesson_title: typeof t === 'string' ? t : (t?.es || t?.en || '') });
      }
    });
    setLessonsBySet(prev => ({ ...prev, [setId]: unique }));
  }

  async function loadGroupMembers(groupId: string) {
    const { data } = await supabase
      .from('group_members')
      .select('student_id, profiles!student_id(full_name, email)')
      .eq('group_id', groupId);
    setMembersByGroup(prev => ({
      ...prev,
      [groupId]: (data || []).map((m: any) => ({
        student_id: m.student_id,
        full_name: m.profiles.full_name,
        email: m.profiles.email,
      })),
    }));
  }

  async function loadCourseStudents() {
    const { data } = await supabase
      .from('course_students')
      .select('student_id, profiles!student_id(full_name, email)')
      .eq('course_id', courseId);
    setCourseStudents((data || []).map((r: any) => ({
      id: r.student_id, full_name: r.profiles.full_name, email: r.profiles.email,
    })));
  }

  async function loadAvailableLessons() {
    const { data, error } = await supabase
      .from('lesson_courses')
      .select('lesson_id, lessons!lesson_id(id, title)')
      .eq('course_id', courseId);
    if (error) console.error('[GroupManager] Error cargando lecciones:', error);
    const seen = new Set<string>();
    const lessons: Lesson[] = [];
    (data || []).forEach((r: any) => {
      if (!seen.has(r.lesson_id) && r.lessons) {
        seen.add(r.lesson_id);
        const t = r.lessons.title;
        lessons.push({ id: r.lesson_id, title: typeof t === 'string' ? t : (t?.es || t?.en || 'Sin título') });
      }
    });
    setAvailableLessons(lessons);
  }

  // ── Generar preview aleatorio ──────────────────────────────
  function generatePreview() {
    if (courseStudents.length === 0) return;
    const shuffled = [...courseStudents].sort(() => Math.random() - 0.5);
    const n = shuffled.length;
    const numGroups = Math.ceil(n / randomSize);
    const names = pickGroupNames(numGroups);
    const preview: { name: string; members: CourseStudent[] }[] = [];
    let idx = 0;
    for (let i = 0; i < numGroups; i++) {
      const size = Math.ceil((n - idx) / (numGroups - i));
      preview.push({ name: names[i], members: shuffled.slice(idx, idx + size) });
      idx += size;
    }
    setRandomPreview(preview);
  }

  // ── Crear agrupación ──────────────────────────────────────
  async function createSet() {
    if (!newSetName.trim()) return;
    if (createMode === 'random' && !randomPreview) { generatePreview(); return; }
    setCreatingSet(true);
    try {
      const { data: setData, error } = await supabase
        .from('group_sets')
        .insert({ course_id: courseId, name: newSetName.trim(), created_by: profile?.id })
        .select().single();
      if (error) throw error;

      if (createMode === 'random' && randomPreview) {
        for (const g of randomPreview) {
          const { data: created, error: groupErr } = await supabase.from('groups')
            .insert({ course_id: courseId, name: g.name, created_by: profile?.id, group_set_id: setData.id })
            .select().single();
          if (groupErr) throw groupErr;
          
          if (created && g.members.length > 0) {
            const { error: memberErr } = await supabase.from('group_members').insert(
              g.members.map(m => ({ group_id: created.id, student_id: m.id }))
            );
            if (memberErr) throw memberErr;
          }
        }
        setRandomPreview(null);
      } else if (createMode === 'affinity') {
        const count = affinityMode === 'count'
          ? affinityCount
          : Math.ceil(courseStudents.length / affinityMax) || affinityCount;
        const maxM = affinityMode === 'max' ? affinityMax : null;
        const names = pickGroupNames(count);
        for (let i = 0; i < count; i++) {
          const { error: affErr } = await supabase.from('groups').insert({
            course_id: courseId, name: names[i],
            created_by: profile?.id, group_set_id: setData.id,
            enrollment_open: true, max_members: maxM,
          });
          if (affErr) throw affErr;
        }
      } else if (createMode === 'manual') {
        const names = pickGroupNames(manualCount);
        for (let i = 0; i < manualCount; i++) {
          const { error: manErr } = await supabase.from('groups').insert({
            course_id: courseId, name: names[i],
            created_by: profile?.id, group_set_id: setData.id,
            enrollment_open: false, max_members: null,
          });
          if (manErr) throw manErr;
        }
      }

      setNewSetName('');
      await loadAll();
      setExpandedSet(setData.id);
    } catch (err: any) { alert(err.message); }
    finally { setCreatingSet(false); }
  }

  async function deleteSet(setId: string, name: string) {
    if (!confirm(`¿Eliminar la agrupación "${name}" y todos sus grupos?`)) return;
    await supabase.from('group_sets').delete().eq('id', setId);
    setGroupSets(prev => prev.filter(s => s.id !== setId));
    if (expandedSet === setId) setExpandedSet(null);
    await loadGroups();
  }

  async function toggleSetActive(set: GroupSet) {
    const next = !set.is_active;
    await supabase.from('group_sets').update({ is_active: next }).eq('id', set.id);
    setGroupSets(prev => prev.map(s => s.id === set.id ? { ...s, is_active: next } : s));
  }

  // ── Lección a toda una agrupación ─────────────────────────
  async function assignLessonToSet(setId: string) {
    const lessonId = addingLessonToSet[setId];
    if (!lessonId) return;
    const { data: groupsData } = await supabase.from('groups')
      .select('id').eq('group_set_id', setId);
    const groups = groupsData || [];
    if (groups.length === 0) { alert('Esta agrupación no tiene grupos.'); return; }
    await supabase.from('group_lesson_assignments').upsert(
      groups.map((g: any) => ({ group_id: g.id, lesson_id: lessonId, assigned_by: profile?.id })),
      { onConflict: 'group_id,lesson_id' }
    );
    setAddingLessonToSet(prev => ({ ...prev, [setId]: '' }));
    await loadSetLessons(setId);
  }

  async function removeLessonFromSet(setId: string, lessonId: string) {
    const { data: groupsData } = await supabase.from('groups')
      .select('id').eq('group_set_id', setId);
    const groups = groupsData || [];
    await supabase.from('group_lesson_assignments')
      .delete().in('group_id', (groups as any[]).map(g => g.id)).eq('lesson_id', lessonId);
    setLessonsBySet(prev => ({
      ...prev, [setId]: (prev[setId] || []).filter(l => l.lesson_id !== lessonId),
    }));
  }

  // ── Gestión de grupos dentro de un set ────────────────────
  async function addGroupToSet(setId: string) {
    const name = addingGroupToSet[setId]?.trim();
    if (!name) return;
    const { data } = await supabase.from('groups')
      .insert({ course_id: courseId, name, created_by: profile?.id, group_set_id: setId })
      .select().single();
    if (data) {
      setGroupsBySet(prev => ({ ...prev, [setId]: [...(prev[setId] || []), data] }));
      setAddingGroupToSet(prev => ({ ...prev, [setId]: '' }));
    }
  }

  async function deleteGroup(groupId: string, setId: string | null) {
    await supabase.from('groups').delete().eq('id', groupId);
    if (setId) {
      setGroupsBySet(prev => ({ ...prev, [setId]: (prev[setId] || []).filter(g => g.id !== groupId) }));
    } else {
      setUngrouped(prev => prev.filter(g => g.id !== groupId));
    }
    if (expandedGroup === groupId) setExpandedGroup(null);
  }

  async function toggleGroupExpand(groupId: string) {
    if (expandedGroup === groupId) { setExpandedGroup(null); return; }
    setExpandedGroup(groupId);
    if (!membersByGroup[groupId]) await loadGroupMembers(groupId);
  }

  async function addMember(groupId: string) {
    const studentId = addingMember[groupId];
    if (!studentId) return;
    await supabase.from('group_members').insert({ group_id: groupId, student_id: studentId });
    setAddingMember(prev => ({ ...prev, [groupId]: '' }));
    await loadGroupMembers(groupId);
  }

  async function removeMember(groupId: string, studentId: string) {
    await supabase.from('group_members').delete()
      .eq('group_id', groupId).eq('student_id', studentId);
    setMembersByGroup(prev => ({
      ...prev, [groupId]: (prev[groupId] || []).filter(m => m.student_id !== studentId),
    }));
  }

  async function moveMember(fromGroupId: string, studentId: string) {
    const key = `${fromGroupId}_${studentId}`;
    const toGroupId = moveTarget[key];
    if (!toGroupId) return;
    await supabase.from('group_members').delete()
      .eq('group_id', fromGroupId).eq('student_id', studentId);
    await supabase.from('group_members').insert({ group_id: toGroupId, student_id: studentId });
    setMoveTarget(prev => ({ ...prev, [key]: '' }));
    await Promise.all([loadGroupMembers(fromGroupId), loadGroupMembers(toGroupId)]);
  }

  async function dropStudentToGroup(groupId: string) {
    if (!draggedStudentId) return;
    await supabase.from('group_members').upsert(
      { group_id: groupId, student_id: draggedStudentId },
      { onConflict: 'group_id,student_id', ignoreDuplicates: true }
    );
    setDraggedStudentId(null);
    await loadGroupMembers(groupId);
  }

  async function toggleEnrollment(group: Group) {
    await supabase.from('groups').update({ enrollment_open: !group.enrollment_open }).eq('id', group.id);
    const update = (prev: Record<string, Group[]>) => {
      const updated = { ...prev };
      if (group.group_set_id && updated[group.group_set_id]) {
        updated[group.group_set_id] = updated[group.group_set_id].map(
          g => g.id === group.id ? { ...g, enrollment_open: !g.enrollment_open } : g
        );
      }
      return updated;
    };
    setGroupsBySet(update);
    setUngrouped(prev => prev.map(g => g.id === group.id ? { ...g, enrollment_open: !g.enrollment_open } : g));
  }

  // ── Componente de grupo individual ────────────────────────
  function GroupCard({ group, allGroups }: { group: Group; allGroups: Group[] }) {
    const members   = membersByGroup[group.id] || [];
    const isOpen    = expandedGroup === group.id;
    const available = courseStudents.filter(s => !members.some(m => m.student_id === s.id));
    const otherGroups = allGroups.filter(g => g.id !== group.id);

    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition cursor-pointer"
          onClick={() => toggleGroupExpand(group.id)}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">{group.name}</p>
              <p className="text-xs text-gray-500">
                {membersByGroup[group.id] ? `${members.length} miembro(s)` : 'ver miembros'}
                {group.enrollment_open && <span className="ml-1 text-green-600">· abierto</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={e => { e.stopPropagation(); toggleEnrollment(group); }}
              className={`p-1 rounded transition text-xs ${group.enrollment_open ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
              title={group.enrollment_open ? 'Cerrar inscripción' : 'Abrir inscripción'}>
              {group.enrollment_open ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            </button>
            <button onClick={e => { e.stopPropagation(); deleteGroup(group.id, group.group_set_id); }}
              className="p-1 text-gray-400 hover:text-red-500 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>

        {isOpen && (
          <div className="border-t border-gray-100 p-3 space-y-2">
            {members.length === 0
              ? <p className="text-xs text-gray-400 italic">Sin miembros.</p>
              : members.map(m => {
                  const key = `${group.id}_${m.student_id}`;
                  return (
                    <div key={m.student_id} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{m.full_name}</span>
                        <button onClick={() => removeMember(group.id, m.student_id)}
                          className="text-gray-400 hover:text-red-500 transition">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      {otherGroups.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          <select value={moveTarget[key] || ''}
                            onChange={e => setMoveTarget(prev => ({ ...prev, [key]: e.target.value }))}
                            className="flex-1 border border-gray-200 rounded px-1 py-0.5 text-xs bg-white focus:outline-none">
                            <option value="">Mover a...</option>
                            {otherGroups.map(og => <option key={og.id} value={og.id}>{og.name}</option>)}
                          </select>
                          <button onClick={() => moveMember(group.id, m.student_id)}
                            disabled={!moveTarget[key]}
                            className="p-0.5 bg-blue-600 text-white rounded disabled:opacity-40">
                            <MoveRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

            {available.length > 0 && (
              <div className="flex gap-1.5 pt-1">
                <select value={addingMember[group.id] || ''}
                  onChange={e => setAddingMember(prev => ({ ...prev, [group.id]: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="">Agregar estudiante...</option>
                  {available.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
                <button onClick={() => addMember(group.id)} disabled={!addingMember[group.id]}
                  className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs disabled:opacity-50">
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando agrupaciones...
    </div>
  );

  const unassignedLessonsForSet = (setId: string) =>
    availableLessons.filter(l => !(lessonsBySet[setId] || []).some(sl => sl.lesson_id === l.id));

  return (
    <div className="space-y-6">

      {/* ── Crear nueva agrupación ── */}
      <div className="border-2 border-dashed border-blue-200 rounded-xl p-5 bg-blue-50">
        <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4" /> Nueva agrupación
        </h3>

        <div className="space-y-4">
          <input
            value={newSetName}
            onChange={e => { setNewSetName(e.target.value); setRandomPreview(null); }}
            placeholder="Nombre de la agrupación (ej: Dinámica Grupal 1)..."
            className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />

          {/* Modo */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'random',   label: 'Aleatoria',     icon: Shuffle, color: 'purple' },
              { key: 'affinity', label: 'Por afinidad',  icon: Heart,   color: 'pink' },
              { key: 'manual',   label: 'Manual',        icon: UserPlus, color: 'gray' },
            ].map(({ key, label, icon: Icon, color }) => (
              <button key={key} onClick={() => { setCreateMode(key as CreateMode); setRandomPreview(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  createMode === key
                    ? `bg-${color}-600 text-white border-${color}-600`
                    : `bg-white text-gray-600 border-gray-300 hover:bg-gray-50`
                }`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Opciones según modo */}
          {createMode === 'random' && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <label className="text-gray-700">Estudiantes por grupo:</label>
                <input type="number" min={2} max={20} value={randomSize}
                  onChange={e => { setRandomSize(Number(e.target.value)); setRandomPreview(null); }}
                  className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <span className="text-xs text-gray-500">
                {courseStudents.length} estudiantes matriculados → ~{Math.ceil(courseStudents.length / randomSize)} grupos
              </span>
              {courseStudents.length === 0 && (
                <p className="text-xs text-amber-600 w-full mt-1">
                  Requiere que los estudiantes ya estén matriculados en el curso, no importa si están conectados. Usa modo "Por afinidad" o "Manual" para crear grupos vacíos ahora.
                </p>
              )}
              <button onClick={generatePreview} disabled={courseStudents.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition">
                <Shuffle className="w-3.5 h-3.5" /> Preview
              </button>
            </div>
          )}

          {createMode === 'affinity' && (
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <button onClick={() => setAffinityMode('count')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${affinityMode === 'count' ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  Número de grupos
                </button>
                <button onClick={() => setAffinityMode('max')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${affinityMode === 'max' ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  Máximo por grupo
                </button>
              </div>
              {affinityMode === 'count' ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-gray-700">Grupos a crear:</label>
                    <input type="number" min={1} max={30} value={affinityCount}
                      onChange={e => setAffinityCount(Number(e.target.value))}
                      className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
                  </div>
                  <span className="text-xs text-gray-500">Los estudiantes eligen su grupo</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-gray-700">Máximo por grupo:</label>
                    <input type="number" min={1} value={affinityMax}
                      onChange={e => setAffinityMax(Number(e.target.value))}
                      className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
                  </div>
                  {courseStudents.length > 0 && (
                    <span className="text-xs text-gray-500">
                      → ~{Math.ceil(courseStudents.length / affinityMax)} grupos para {courseStudents.length} estudiantes
                    </span>
                  )}
                </div>
              )}
              <p className="text-xs text-pink-600">Los estudiantes verán los grupos y elegirán dónde inscribirse</p>
            </div>
          )}

          {createMode === 'manual' && (
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <label className="text-gray-700">Número de grupos:</label>
                <input type="number" min={1} max={30} value={manualCount}
                  onChange={e => setManualCount(Number(e.target.value))}
                  className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <p className="text-xs text-gray-500">Los grupos se crean con nombres automáticos. Luego arrastras estudiantes a cada grupo.</p>
            </div>
          )}

          {/* Preview aleatoria */}
          {randomPreview && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {randomPreview.map((g, i) => (
                <div key={i} className="bg-white border border-purple-200 rounded-lg p-2.5">
                  <p className="font-bold text-purple-800 text-xs mb-1">{g.name} ({g.members.length})</p>
                  {g.members.map(m => (
                    <p key={m.id} className="text-xs text-gray-600 truncate">{m.full_name}</p>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={createSet}
              disabled={creatingSet || !newSetName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              {creatingSet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {createMode === 'random' && !randomPreview ? 'Generar preview' : 'Crear agrupación'}
            </button>
            {randomPreview && (
              <button onClick={generatePreview}
                className="px-3 py-2 border border-purple-300 text-purple-700 rounded-lg text-sm hover:bg-purple-50 transition">
                Regenerar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Lista de agrupaciones ── */}
      {groupSets.length === 0 && ungrouped.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="font-medium">No hay agrupaciones aún.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupSets.map(set => {
            const groups = groupsBySet[set.id] || [];
            const isOpen = expandedSet === set.id;
            const setLessons = lessonsBySet[set.id] || [];
            const unassigned = unassignedLessonsForSet(set.id);

            return (
              <div key={set.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">

                {/* Header del set */}
                <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
                  onClick={() => {
                    const opening = expandedSet !== set.id;
                    setExpandedSet(opening ? set.id : null);
                    if (opening && !lessonsBySet[set.id]) loadSetLessons(set.id);
                  }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-800">{set.name}</p>
                      <p className="text-xs text-gray-500">
                        {groups.length} grupo(s) · {new Date(set.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); toggleSetActive(set); }}
                      title={set.is_active ? 'Agrupación activa — clic para desactivar' : 'Agrupación inactiva — clic para activar'}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
                        set.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}>
                      <Power className="w-3.5 h-3.5" />
                      {set.is_active ? 'Activa' : 'Inactiva'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteSet(set.id, set.name); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* Detalle del set */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-4 space-y-5">

                    {/* Lecciones de esta agrupación */}
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                      <h4 className="text-sm font-bold text-green-800 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" /> Lecciones grupales de esta agrupación
                      </h4>
                      <p className="text-xs text-green-600">Al asignar una lección aquí, todos los grupos la reciben automáticamente.</p>

                      {setLessons.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {setLessons.map(l => (
                            <span key={l.lesson_id} className="flex items-center gap-1 bg-white border border-green-200 text-green-800 text-xs px-2 py-1 rounded-full">
                              {l.lesson_title}
                              <button onClick={() => removeLessonFromSet(set.id, l.lesson_id)}
                                className="hover:text-red-500 transition ml-0.5">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {availableLessons.length === 0 ? (
                        <p className="text-xs text-amber-600 italic">No hay lecciones creadas aún. Crea lecciones en "Crear Contenido".</p>
                      ) : unassigned.length === 0 ? (
                        <p className="text-xs text-green-700 italic">✓ Todas las lecciones ya están asignadas a esta agrupación.</p>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex gap-2">
                            <select value=""
                              onChange={async e => {
                                const val = e.target.value;
                                if (!val) return;
                                setAddingLessonToSet(prev => ({ ...prev, [set.id]: val }));
                                // Wait a tick to allow state to update, then assign
                                setTimeout(() => {
                                  assignLessonToSet(set.id);
                                }, 0);
                              }}
                              disabled={groups.length === 0}
                              className="flex-1 border border-green-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50">
                              <option value="">{groups.length === 0 ? "Agrega grupos primero..." : "Selecciona para asignar lección a todos..."}</option>
                              {unassigned.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                            </select>
                            <button onClick={() => assignLessonToSet(set.id)}
                              disabled={!addingLessonToSet[set.id] || groups.length === 0}
                              title={groups.length === 0 ? 'Agrega al menos un grupo primero' : 'Asignar a todos los grupos'}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition flex items-center gap-1 hidden">
                              <Plus className="w-3.5 h-3.5" /> Asignar
                            </button>
                          </div>
                          {groups.length === 0 && (
                            <p className="text-xs text-amber-600">Agrega al menos un grupo para poder asignar la lección.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── Panel DnD de asignación ── */}
                    {groups.length > 0 && (
                      <div>
                        <button
                          onClick={() => {
                            if (dndSetId === set.id) { setDndSetId(null); return; }
                            setDndSetId(set.id);
                            groups.forEach(g => { if (!membersByGroup[g.id]) loadGroupMembers(g.id); });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition">
                          <GripVertical className="w-3.5 h-3.5" />
                          {dndSetId === set.id ? 'Cerrar distribución' : 'Distribuir estudiantes (arrastrar)'}
                        </button>

                        {dndSetId === set.id && (
                          <div className="mt-3 border border-indigo-200 rounded-xl overflow-hidden">
                            <div className="grid grid-cols-[180px_1fr] divide-x divide-indigo-100">
                              {/* Columna: sin grupo */}
                              <div className="bg-indigo-50 p-3">
                                <p className="text-xs font-bold text-indigo-700 mb-2">Sin grupo</p>
                                <div className="space-y-1">
                                  {courseStudents
                                    .filter(s => !groups.some(g => (membersByGroup[g.id] || []).some(m => m.student_id === s.id)))
                                    .map(s => (
                                      <div key={s.id}
                                        draggable
                                        onDragStart={() => setDraggedStudentId(s.id)}
                                        className="flex items-center gap-1.5 bg-white border border-indigo-200 rounded-lg px-2 py-1 cursor-grab text-xs text-gray-700 hover:border-indigo-400 transition">
                                        <GripVertical className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="truncate">{s.full_name}</span>
                                      </div>
                                    ))}
                                  {courseStudents.filter(s => !groups.some(g => (membersByGroup[g.id] || []).some(m => m.student_id === s.id))).length === 0 && (
                                    <p className="text-xs text-indigo-400 italic">Todos asignados</p>
                                  )}
                                </div>
                              </div>
                              {/* Columna: grupos como zonas de drop */}
                              <div className="p-3 grid grid-cols-2 gap-2 bg-white">
                                {groups.map(g => (
                                  <div key={g.id}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={() => dropStudentToGroup(g.id)}
                                    className={`min-h-[80px] border-2 border-dashed rounded-xl p-2 transition ${draggedStudentId ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'}`}>
                                    <p className="text-xs font-bold text-gray-700 mb-1.5">{g.name}</p>
                                    {(membersByGroup[g.id] || []).map(m => (
                                      <div key={m.student_id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-600 mb-1">
                                        <span className="truncate">{m.full_name}</span>
                                        <button onClick={() => removeMember(g.id, m.student_id)} className="text-gray-300 hover:text-red-400 ml-1">
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    ))}
                                    {(membersByGroup[g.id] || []).length === 0 && (
                                      <p className="text-xs text-gray-300 italic">Suelta aquí</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Grupos del set */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-gray-700">Grupos</h4>
                      {groups.length === 0
                        ? <p className="text-xs text-gray-400 italic">Esta agrupación no tiene grupos aún.</p>
                        : <div className="grid sm:grid-cols-2 gap-2">
                            {groups.map(g => <GroupCard key={g.id} group={g} allGroups={groups} />)}
                          </div>
                      }

                      {/* Agregar grupo manual dentro del set */}
                      <div className="flex gap-2 pt-1">
                        <input
                          value={addingGroupToSet[set.id] || ''}
                          onChange={e => setAddingGroupToSet(prev => ({ ...prev, [set.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addGroupToSet(set.id)}
                          placeholder="Nombre del nuevo grupo..."
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button onClick={() => addGroupToSet(set.id)}
                          disabled={!addingGroupToSet[set.id]?.trim()}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition">
                          <Plus className="w-3.5 h-3.5" /> Grupo
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })}

          {/* Grupos sin agrupación (legado) */}
          {ungrouped.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-500 mb-3">Grupos sin agrupación</h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {ungrouped.map(g => <GroupCard key={g.id} group={g} allGroups={ungrouped} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
