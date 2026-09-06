const AUTH_URL = 'https://ep-floral-credit-ax4v683g.neonauth.c-4.us-east-2.aws.neon.tech/elprofe_deinves/auth';
const DATA_API_URL = 'https://ep-floral-credit-ax4v683g.apirest.c-4.us-east-2.aws.neon.tech/elprofe_deinves/rest/v1';
const ORIGIN = 'http://localhost:5173';
const PASSWORD = 'TestPass123!';

function makeActor() {
  const cookies = new Map();
  let accessToken = null;

  async function authFetch(path, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('origin', ORIGIN);
    headers.set('content-type', 'application/json');
    if (cookies.size) headers.set('cookie', [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '));
    const res = await fetch(`${AUTH_URL}${path}`, { ...init, headers });
    const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const c of setCookies) {
      const [pair] = c.split(';');
      const idx = pair.indexOf('=');
      cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
    return res;
  }

  async function signUp(email, name) {
    const res = await authFetch('/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({ email, password: PASSWORD, name }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`signUp ${email}: ${JSON.stringify(json)}`);
    accessToken = json.token ?? json.session?.access_token ?? null;
    if (!accessToken) {
      // fallback: pedir token explícito
      const tokenRes = await authFetch('/token');
      const tokenJson = await tokenRes.json();
      accessToken = tokenJson.token;
    }
    if (!accessToken) throw new Error(`No se obtuvo JWT para ${email}: ${JSON.stringify(json)}`);
    return json.user;
  }

  async function dataApi(path, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('content-type', 'application/json');
    headers.set('authorization', `Bearer ${accessToken}`);
    const res = await fetch(`${DATA_API_URL}${path}`, { ...init, headers });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { ok: res.ok, status: res.status, data: json };
  }

  return { signUp, dataApi, getToken: () => accessToken };
}

async function insertProfile(actor, id, email, fullName, role) {
  const { ok, status, data } = await actor.dataApi('/profiles', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ id, email, full_name: fullName, role }),
  });
  if (!ok) throw new Error(`insert profile ${email}: ${status} ${JSON.stringify(data)}`);
  return data[0];
}

async function main() {
  console.log('--- 1. Signup profesor ---');
  const prof = makeActor();
  const profUser = await prof.signUp('arturo.rodriguez@uleam.ddu.ec', 'Arturo Rodríguez');
  await insertProfile(prof, profUser.id, profUser.email, 'Arturo Rodríguez', 'professor');
  console.log('OK profesor:', profUser.id);

  console.log('--- 2. Signup 3 estudiantes ---');
  const students = [];
  for (const [email, name] of [
    ['estudiante1@test.com', 'Estudiante Uno'],
    ['estudiante2@test.com', 'Estudiante Dos'],
    ['estudiante3@test.com', 'Estudiante Tres'],
  ]) {
    const actor = makeActor();
    const user = await actor.signUp(email, name);
    await insertProfile(actor, user.id, user.email, name, 'student');
    students.push({ actor, user });
    console.log('OK estudiante:', email, user.id);
  }
  const [s1, s2, s3] = students;

  console.log('--- 3. Profesor crea curso ---');
  const courseRes = await prof.dataApi('/courses', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name: 'Inglés A1 - Prueba', professor_id: profUser.id, language: 'es' }),
  });
  if (!courseRes.ok) throw new Error('crear curso: ' + JSON.stringify(courseRes.data));
  const course = courseRes.data[0];
  console.log('OK curso:', course.id);

  console.log('--- 4. Matricular 3 estudiantes ---');
  for (const s of students) {
    const r = await prof.dataApi('/course_students', {
      method: 'POST',
      body: JSON.stringify({ course_id: course.id, student_id: s.user.id }),
    });
    if (!r.ok) throw new Error('matricular: ' + JSON.stringify(r.data));
  }
  console.log('OK 3 matriculados');

  console.log('--- 5. Estudiante1 ve el curso (RLS enrolled) ---');
  const seenByS1 = await s1.actor.dataApi(`/courses?id=eq.${course.id}`);
  console.log(seenByS1.ok && seenByS1.data.length === 1 ? 'OK estudiante1 ve su curso' : `FALLO: ${JSON.stringify(seenByS1)}`);

  console.log('--- 6. Profesor crea leccion ---');
  const lessonRes = await prof.dataApi('/lessons', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ title: { es: 'Saludos', en: 'Greetings' }, content: {}, created_by: profUser.id }),
  });
  if (!lessonRes.ok) throw new Error('crear leccion: ' + JSON.stringify(lessonRes.data));
  const lesson = lessonRes.data[0];
  console.log('OK leccion:', lesson.id);

  console.log('--- 7. Estudiante1 crea su produccion ---');
  const prodRes = await s1.actor.dataApi('/productions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ student_id: s1.user.id, lesson_id: lesson.id, content: 'Hello, my name is student one.' }),
  });
  if (!prodRes.ok) throw new Error('crear produccion: ' + JSON.stringify(prodRes.data));
  const prod = prodRes.data[0];
  console.log('OK produccion:', prod.id);

  console.log('--- 8. Estudiante2 intenta leer la produccion de estudiante1 ---');
  const peek = await s2.actor.dataApi(`/productions?id=eq.${prod.id}`);
  console.log(peek.ok && peek.data.length === 0 ? 'OK RLS bloquea a estudiante2' : `FALLO RLS: ${JSON.stringify(peek)}`);

  console.log('--- 9. Profesor lee la produccion de estudiante1 ---');
  const profSees = await prof.dataApi(`/productions?id=eq.${prod.id}`);
  console.log(profSees.ok && profSees.data.length === 1 ? 'OK profesor ve la produccion' : `FALLO: ${JSON.stringify(profSees)}`);

  console.log('\n=== TODO OK ===');
}

main().catch(err => { console.error('FALLO:', err.message); process.exitCode = 1; });
