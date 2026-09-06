import { Client } from 'pg';

const SUPA_URL = 'https://ckpmrmhkrbylibecezxn.supabase.co/rest/v1';
const SUPA_KEY = process.env.SUPA_KEY;
const NEON_URL = process.env.NEON_DB_URL;

if (!SUPA_KEY || !NEON_URL) {
  console.error('Faltan SUPA_KEY o NEON_DB_URL en el entorno');
  process.exit(1);
}

const client = new Client({ connectionString: NEON_URL });
await client.connect();

async function fetchAll(table) {
  const rows = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const res = await fetch(`${SUPA_URL}/${table}?select=*&offset=${offset}&limit=${pageSize}`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    if (!res.ok) throw new Error(`fetch ${table}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

function prepValue(v) {
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

async function copyTable(table) {
  const rows = await fetchAll(table);
  if (rows.length === 0) {
    console.log(`${table}: 0 filas (nada que copiar)`);
    return;
  }
  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(', ');
  let inserted = 0;
  for (const row of rows) {
    const values = cols.map(c => prepValue(row[c]));
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    try {
      await client.query(
        `INSERT INTO public."${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values
      );
      inserted++;
    } catch (err) {
      console.error(`  FALLO insert en ${table} id=${row.id ?? '(sin id)'}: ${err.message}`);
    }
  }
  console.log(`${table}: ${inserted}/${rows.length} filas copiadas`);
}

const TABLES_IN_ORDER = [
  'profiles',
  'lessons',
  'courses',
  'course_students',
  'activities',
  'lesson_activities',
  'lesson_assignments',
  'student_progress',
  'activity_responses',
  'production_rules',
  'productions',
  'group_sets',
  'groups',
  'group_members',
  'group_lesson_assignments',
  'group_progress',
  'group_activity_completions',
  'group_production_locks',
  'presentation_sessions',
  'projects',
  'project_assignments',
  'project_object_types',
  'lesson_project_objects',
  'project_objects',
  'project_object_edit_requests',
  'project_submissions',
];

for (const table of TABLES_IN_ORDER) {
  try {
    await copyTable(table);
  } catch (err) {
    console.error(`FALLO tabla ${table}: ${err.message}`);
  }
}

await client.end();
console.log('\n=== FIN ===');
