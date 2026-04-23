import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_URL') ?? Deno.env.get('GROQ_API_KEY') ?? '';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EnhanceTask =
  | 'improve_title'
  | 'improve_description'
  | 'improve_instructions'
  | 'generate_activity_options'
  | 'suggest_required_words'
  | 'review_production'
  | 'translate';

interface RequestBody {
  task: EnhanceTask;
  lang: 'es' | 'en';
  data: Record<string, any>;
}

function buildMessages(task: EnhanceTask, lang: 'es' | 'en', data: Record<string, any>) {
  const langLabel = lang === 'es' ? 'español' : 'English';
  const isEs = lang === 'es';

  switch (task) {
    case 'improve_title':
      return [
        {
          role: 'system',
          content: isEs
            ? `Eres un experto en diseño curricular. Mejora los títulos de lecciones educativas para que sean claros, atractivos y orientados al aprendizaje. Responde SOLO con el título mejorado, sin comillas, sin explicaciones.`
            : `You are a curriculum design expert. Improve educational lesson titles to be clear, engaging, and learning-oriented. Reply ONLY with the improved title, no quotes, no explanations.`,
        },
        {
          role: 'user',
          content: isEs
            ? `Mejora este título de lección en ${langLabel}: "${data.title}"\nContexto: ${data.context ?? 'plataforma de enseñanza de idiomas'}`
            : `Improve this lesson title in ${langLabel}: "${data.title}"\nContext: ${data.context ?? 'language teaching platform'}`,
        },
      ];

    case 'improve_description':
      return [
        {
          role: 'system',
          content: isEs
            ? `Eres experto en redacción pedagógica. Escribe descripciones breves (máx 2 oraciones) para lecciones de idiomas. Deben comunicar qué aprenderá el estudiante. Responde SOLO con la descripción, sin comillas.`
            : `You are a pedagogical writing expert. Write brief descriptions (max 2 sentences) for language lessons. They must communicate what the student will learn. Reply ONLY with the description, no quotes.`,
        },
        {
          role: 'user',
          content: isEs
            ? `Escribe una descripción en ${langLabel} para la lección titulada: "${data.title}".\nContenido de la lección: ${data.content ?? 'no especificado'}`
            : `Write a description in ${langLabel} for the lesson titled: "${data.title}".\nLesson content: ${data.content ?? 'not specified'}`,
        },
      ];

    case 'improve_instructions':
      return [
        {
          role: 'system',
          content: isEs
            ? `Eres un docente de idiomas. Mejora las instrucciones de actividades de producción escrita para que sean claras, motivadoras y con un propósito comunicativo auténtico. Máximo 3 oraciones. Responde SOLO con las instrucciones mejoradas.`
            : `You are a language teacher. Improve writing production activity instructions to be clear, motivating, and with an authentic communicative purpose. Maximum 3 sentences. Reply ONLY with the improved instructions.`,
        },
        {
          role: 'user',
          content: isEs
            ? `Mejora estas instrucciones en ${langLabel}: "${data.instructions}"\nTema de la lección: ${data.lessonTitle ?? ''}`
            : `Improve these instructions in ${langLabel}: "${data.instructions}"\nLesson topic: ${data.lessonTitle ?? ''}`,
        },
      ];

    case 'generate_activity_options':
      return [
        {
          role: 'system',
          content: isEs
            ? `Eres un diseñador instruccional experto en enseñanza de idiomas. Genera opciones de opción múltiple pedagógicamente correctas: un distractor plausible, uno incorrecto claro, y la respuesta correcta. Responde SOLO en JSON: {"options": [{"id": "a", "text": "..."}, ...], "correct_id": "b"}`
            : `You are an instructional designer expert in language teaching. Generate pedagogically sound multiple choice options: one plausible distractor, one clearly wrong, and the correct answer. Reply ONLY in JSON: {"options": [{"id": "a", "text": "..."}, ...], "correct_id": "b"}`,
        },
        {
          role: 'user',
          content: isEs
            ? `Genera 4 opciones para esta pregunta en ${langLabel}: "${data.question}"\nRespuesta correcta esperada: ${data.correct ?? 'no especificada'}`
            : `Generate 4 options for this question in ${langLabel}: "${data.question}"\nExpected correct answer: ${data.correct ?? 'not specified'}`,
        },
      ];

    case 'suggest_required_words':
      return [
        {
          role: 'system',
          content: isEs
            ? `Eres un lingüista especializado en enseñanza de idiomas. Sugiere palabras o frases clave que un estudiante DEBERÍA usar en una producción escrita sobre el tema dado. Responde SOLO en JSON: {"required_words": ["word1", "word2", ...]}`
            : `You are a linguist specializing in language teaching. Suggest key words or phrases that a student SHOULD use in a written production about the given topic. Reply ONLY in JSON: {"required_words": ["word1", "word2", ...]}`,
        },
        {
          role: 'user',
          content: isEs
            ? `Sugiere 5-8 palabras o frases clave en ${langLabel} para una producción escrita sobre: "${data.lessonTitle}"\nNivel de idioma: ${data.level ?? 'intermedio'}`
            : `Suggest 5-8 key words or phrases in ${langLabel} for a written production about: "${data.lessonTitle}"\nLanguage level: ${data.level ?? 'intermediate'}`,
        },
      ];

    case 'review_production':
      return [
        {
          role: 'system',
          content: `Eres un docente experto en evaluación de producción escrita en español. Analiza el ensayo del estudiante y devuelve SOLO JSON con este formato exacto (sin markdown, sin bloques de código):
{"score":<0-10>,"summary":"<resumen en 1 oración>","strengths":["<fortaleza1>","<fortaleza2>"],"improvements":["<mejora1>","<mejora2>","<mejora3>"]}

Criterios de puntuación: coherencia, gramática, vocabulario, cumplimiento de instrucciones y reglas.`,
        },
        {
          role: 'user',
          content: `Instrucciones de la tarea: ${data.instructions ?? 'Redacción libre'}
Reglas: mínimo ${data.min_words ?? 0} palabras${data.max_words ? `, máximo ${data.max_words}` : ''}.${data.required_words?.length ? `\nPalabras requeridas: ${data.required_words.join(', ')}` : ''}${data.prohibited_words?.length ? `\nPalabras prohibidas: ${data.prohibited_words.join(', ')}` : ''}

Ensayo:
${data.content}`,
        },
      ];

    case 'translate':
      return [
        {
          role: 'system',
          content: data.from_lang === 'es'
            ? 'You are a professional translator. Translate the given text from Spanish to English accurately. Reply ONLY with the translated text, no explanations, no quotes.'
            : 'Eres un traductor profesional. Traduce el texto dado del inglés al español con precisión. Responde SOLO con el texto traducido, sin explicaciones, sin comillas.',
        },
        {
          role: 'user',
          content: data.text,
        },
      ];

    default:
      throw new Error(`Unknown task: ${task}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured in Edge Function secrets');
    }

    const body: RequestBody = await req.json();
    const { task, lang, data } = body;

    const messages = buildMessages(task, lang, data);

    const groqRes = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 400,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      throw new Error(`GROQ error ${groqRes.status}: ${err}`);
    }

    const groqData = await groqRes.json();
    const result = groqData.choices[0]?.message?.content?.trim() ?? '';

    // Para tareas que esperan JSON, intentar parsear
    const jsonTasks: EnhanceTask[] = ['generate_activity_options', 'suggest_required_words', 'review_production'];
    if (jsonTasks.includes(task)) {
      try {
        const parsed = JSON.parse(result);
        return new Response(JSON.stringify({ result: parsed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        // Si no es JSON válido, devolver como texto igual
      }
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
