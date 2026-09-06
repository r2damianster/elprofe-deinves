import { createClient, SupabaseAuthAdapter, defaultDeriveNeonUrls } from '@neondatabase/neon-js';

const ORIGIN = 'http://localhost:5173';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  if (!headers.has('origin')) headers.set('origin', ORIGIN);
  return originalFetch(input, { ...init, headers });
};

const neonUrl = 'https://ep-floral-credit-ax4v683g.c-4.us-east-2.aws.neon.tech/elprofe_deinves';
const { auth: authUrl, dataApi: dataApiUrl } = defaultDeriveNeonUrls(neonUrl);

function newClient() {
  return createClient({
    auth: { adapter: SupabaseAuthAdapter(), url: authUrl },
    dataApi: { url: dataApiUrl },
  });
}

const PASSWORD = 'TestPass123!';

async function signUpAndProfile(email, fullName, role) {
  const client = newClient();
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
  if (error) throw new Error(`signUp ${email}: ${error.message}`);
  const userId = data.user.id;
  const { error: profileError } = await client.from('profiles').insert({
    id: userId, email, full_name: fullName, role,
  });
  if (profileError) throw new Error(`profile insert ${email}: ${profileError.message}`);
  console.log(`OK signup+profile: ${email} (${role}) -> ${userId}`);
  return { client, userId };
}

async function main() {
  console.log('--- 1. Signup profesor ---');
  const prof = await signUpAndProfile('arturo.rodriguez@uleam.ddu.ec', 'Arturo Rodríguez', 'professor');

  console.log('--- 2. Signup 3 estudiantes ---');
  const s1 = await signUpAndProfile('estudiante1@test.com', 'Estudiante Uno', 'student');
  const s2 = await signUpAndProfile('estudiante2@test.com', 'Estudiante Dos', 'student');
  const s3 = await signUpAndProfile('estudiante3@test.com', 'Estudiante Tres', 'student');

  console.log('--- 3. Profesor crea curso ---');
  const { data: course, error: courseErr } = await prof.client
    .from('courses')
    .insert({ name: 'Inglés A1 - Prueba', professor_id: prof.userId, language: 'es' })
    .select()
    .single();
  if (courseErr) throw new Error('crear curso: ' + courseErr.message);
  console.log('OK curso creado:', course.id);

  console.log('--- 4. Profesor matricula a los 3 estudiantes ---');
  for (const s of [s1, s2, s3]) {
    const { error } = await prof.client.from('course_students').insert({ course_id: course.id, student_id: s.userId });
    if (error) throw new Error('matricular: ' + error.message);
  }
  console.log('OK 3 matriculados');

  console.log('--- 5. Estudiante 1 ve el curso (RLS enrolled) ---');
  const { data: coursesSeen, error: seeErr } = await s1.client.from('courses').select('*').eq('id', course.id);
  if (seeErr) throw new Error('estudiante ve curso: ' + seeErr.message);
  console.log(coursesSeen.length === 1 ? 'OK estudiante1 ve su curso' : `FALLO: estudiante1 ve ${coursesSeen.length} filas (esperaba 1)`);

  console.log('--- 6. Profesor crea lección ---');
  const { data: lesson, error: lessonErr } = await prof.client
    .from('lessons')
    .insert({ title: { es: 'Saludos', en: 'Greetings' }, content: {}, created_by: prof.userId })
    .select()
    .single();
  if (lessonErr) throw new Error('crear leccion: ' + lessonErr.message);
  console.log('OK leccion creada:', lesson.id);

  console.log('--- 7. Estudiante1 crea su produccion ---');
  const { data: prod, error: prodErr } = await s1.client
    .from('productions')
    .insert({ student_id: s1.userId, lesson_id: lesson.id, content: 'Hello, my name is student one.' })
    .select()
    .single();
  if (prodErr) throw new Error('crear produccion: ' + prodErr.message);
  console.log('OK produccion creada:', prod.id);

  console.log('--- 8. Estudiante2 intenta leer la produccion de estudiante1 (debe fallar/vacio) ---');
  const { data: peekAttempt } = await s2.client.from('productions').select('*').eq('id', prod.id);
  console.log(peekAttempt.length === 0 ? 'OK RLS bloquea: estudiante2 no ve la produccion ajena' : `FALLO RLS: estudiante2 ve ${peekAttempt.length} fila(s) ajenas`);

  console.log('--- 9. Profesor lee la produccion de estudiante1 (debe funcionar) ---');
  const { data: profSees, error: profSeesErr } = await prof.client.from('productions').select('*').eq('id', prod.id);
  if (profSeesErr) throw new Error('profesor lee produccion: ' + profSeesErr.message);
  console.log(profSees.length === 1 ? 'OK profesor ve la produccion del estudiante' : `FALLO: profesor ve ${profSees.length} filas`);

  console.log('--- 10. get_user_role() vía tabla profiles (chequeo directo) ---');
  const { data: profRow } = await prof.client.from('profiles').select('role, is_admin').eq('id', prof.userId).single();
  console.log('profile profesor:', profRow);

  console.log('\n=== TODO OK ===');
}

main().catch(err => { console.error('FALLO:', err.message); process.exitCode = 1; });
