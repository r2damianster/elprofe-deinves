import{createRequire as ___cr}from"module";import{fileURLToPath as ___f}from"url";import{dirname as ___d}from"path";const require=___cr(import.meta.url);const __filename=___f(import.meta.url);const __dirname=___d(__filename);

// neon-functions/ai-enhance.ts
var GROQ_API_KEY = process.env.GROQ_URL ?? process.env.GROQ_API_KEY ?? "";
var GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
var MODEL = "openai/gpt-oss-120b";
function cors(request) {
  return {
    "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
}
function buildMessages(task, lang, data) {
  const langLabel = lang === "es" ? "espa\xF1ol" : "English";
  const isEs = lang === "es";
  switch (task) {
    case "improve_title":
      return [
        {
          role: "system",
          content: isEs ? `Eres un experto en dise\xF1o de actividades educativas. Mejora el t\xEDtulo de una actividad para que sea espec\xEDfico y diferenciador. Usa el formato "Categor\xEDa General: Diferenciador Espec\xEDfico" cuando aplique (ej: "Vac\xEDo de Investigaci\xF3n: Contradicci\xF3n", "Presente Simple: Rutinas Diarias", "Caso Monkey Selfies"). El t\xEDtulo debe ser corto (m\xE1x 7 palabras), evocador y \xFAnico \u2014 no gen\xE9rico. Responde SOLO con el t\xEDtulo mejorado, sin comillas, sin explicaciones.` : `You are an educational activity design expert. Improve the activity title to be specific and differentiating. Use the format "General Category: Specific Differentiator" when applicable (e.g. "Research Gap: Contradiction", "Simple Present: Daily Routines", "Monkey Selfies Case"). Title must be short (max 7 words), evocative and unique \u2014 not generic. Reply ONLY with the improved title, no quotes, no explanations.`
        },
        {
          role: "user",
          content: isEs ? `Mejora este t\xEDtulo de actividad en ${langLabel}: "${data.title}"
Contexto: ${data.context ?? "plataforma de ense\xF1anza de idiomas"}` : `Improve this activity title in ${langLabel}: "${data.title}"
Context: ${data.context ?? "language teaching platform"}`
        }
      ];
    case "improve_description":
      return [
        {
          role: "system",
          content: isEs ? `Eres experto en redacci\xF3n pedag\xF3gica. Escribe descripciones breves (m\xE1x 2 oraciones) para lecciones de idiomas. Deben comunicar qu\xE9 aprender\xE1 el estudiante. Responde SOLO con la descripci\xF3n, sin comillas.` : `You are a pedagogical writing expert. Write brief descriptions (max 2 sentences) for language lessons. They must communicate what the student will learn. Reply ONLY with the description, no quotes.`
        },
        {
          role: "user",
          content: isEs ? `Escribe una descripci\xF3n en ${langLabel} para la lecci\xF3n titulada: "${data.title}".
Contenido de la lecci\xF3n: ${data.content ?? "no especificado"}` : `Write a description in ${langLabel} for the lesson titled: "${data.title}".
Lesson content: ${data.content ?? "not specified"}`
        }
      ];
    case "improve_instructions":
      return [
        {
          role: "system",
          content: isEs ? `Eres un docente de idiomas. Mejora las instrucciones de actividades de producci\xF3n escrita para que sean claras, motivadoras y con un prop\xF3sito comunicativo aut\xE9ntico. M\xE1ximo 3 oraciones. Responde SOLO con las instrucciones mejoradas.` : `You are a language teacher. Improve writing production activity instructions to be clear, motivating, and with an authentic communicative purpose. Maximum 3 sentences. Reply ONLY with the improved instructions.`
        },
        {
          role: "user",
          content: isEs ? `Mejora estas instrucciones en ${langLabel}: "${data.instructions}"
Tema de la lecci\xF3n: ${data.lessonTitle ?? ""}` : `Improve these instructions in ${langLabel}: "${data.instructions}"
Lesson topic: ${data.lessonTitle ?? ""}`
        }
      ];
    case "generate_activity_options":
      return [
        {
          role: "system",
          content: isEs ? `Eres un dise\xF1ador instruccional experto en ense\xF1anza de idiomas. Genera opciones de opci\xF3n m\xFAltiple pedag\xF3gicamente correctas: un distractor plausible, uno incorrecto claro, y la respuesta correcta. Responde SOLO en JSON: {"options": [{"id": "a", "text": "..."}, ...], "correct_id": "b"}` : `You are an instructional designer expert in language teaching. Generate pedagogically sound multiple choice options: one plausible distractor, one clearly wrong, and the correct answer. Reply ONLY in JSON: {"options": [{"id": "a", "text": "..."}, ...], "correct_id": "b"}`
        },
        {
          role: "user",
          content: isEs ? `Genera 4 opciones para esta pregunta en ${langLabel}: "${data.question}"
Respuesta correcta esperada: ${data.correct ?? "no especificada"}` : `Generate 4 options for this question in ${langLabel}: "${data.question}"
Expected correct answer: ${data.correct ?? "not specified"}`
        }
      ];
    case "suggest_required_words":
      return [
        {
          role: "system",
          content: isEs ? `Eres un ling\xFCista especializado en ense\xF1anza de idiomas. Sugiere palabras o frases clave que un estudiante DEBER\xCDA usar en una producci\xF3n escrita sobre el tema dado. Responde SOLO en JSON: {"required_words": ["word1", "word2", ...]}` : `You are a linguist specializing in language teaching. Suggest key words or phrases that a student SHOULD use in a written production about the given topic. Reply ONLY in JSON: {"required_words": ["word1", "word2", ...]}`
        },
        {
          role: "user",
          content: isEs ? `Sugiere 5-8 palabras o frases clave en ${langLabel} para una producci\xF3n escrita sobre: "${data.lessonTitle}"
Nivel de idioma: ${data.level ?? "intermedio"}` : `Suggest 5-8 key words or phrases in ${langLabel} for a written production about: "${data.lessonTitle}"
Language level: ${data.level ?? "intermediate"}`
        }
      ];
    case "review_production":
      return [
        {
          role: "system",
          content: `Eres un docente experto en evaluaci\xF3n de producci\xF3n escrita en espa\xF1ol. Analiza el ensayo del estudiante y devuelve SOLO JSON con este formato exacto (sin markdown, sin bloques de c\xF3digo):
{"score":<0-10>,"summary":"<resumen en 1 oraci\xF3n>","strengths":["<fortaleza1>","<fortaleza2>"],"improvements":["<mejora1>","<mejora2>","<mejora3>"]}

Criterios de puntuaci\xF3n: coherencia, gram\xE1tica, vocabulario, cumplimiento de instrucciones y reglas.`
        },
        {
          role: "user",
          content: `Instrucciones de la tarea: ${data.instructions ?? "Redacci\xF3n libre"}
Reglas: m\xEDnimo ${data.min_words ?? 0} palabras${data.max_words ? `, m\xE1ximo ${data.max_words}` : ""}.${data.required_words?.length ? `
Palabras requeridas: ${data.required_words.join(", ")}` : ""}${data.prohibited_words?.length ? `
Palabras prohibidas: ${data.prohibited_words.join(", ")}` : ""}

Ensayo:
${data.content}`
        }
      ];
    case "translate":
      return [
        {
          role: "system",
          content: data.from_lang === "es" ? "You are a professional translator. Translate the given text from Spanish to English accurately. Reply ONLY with the translated text, no explanations, no quotes." : "Eres un traductor profesional. Traduce el texto dado del ingl\xE9s al espa\xF1ol con precisi\xF3n. Responde SOLO con el texto traducido, sin explicaciones, sin comillas."
        },
        {
          role: "user",
          content: data.text
        }
      ];
    case "suggest_rubric":
      return [
        {
          role: "system",
          content: `Eres un experto en evaluaci\xF3n educativa. Analiza los ensayos de estudiantes y prop\xF3n UN criterio de evaluaci\xF3n claro y espec\xEDfico para calificarlos (m\xE1ximo 150 palabras). El criterio debe mencionar: coherencia, vocabulario, gram\xE1tica, y cumplimiento del tema. Responde SOLO en JSON: {"rubric_prompt": "..."}`
        },
        {
          role: "user",
          content: `Tema de la lecci\xF3n: ${data.lesson_context}. Analiza estos ${data.productions.length} ensayos y prop\xF3n el criterio. Ensayos:
${data.productions.map((p, i) => `${i + 1}. ${p.content}`).join("\n")}`
        }
      ];
    case "batch_grade":
      return [
        {
          role: "system",
          content: `Eres un evaluador experto. Eval\xFAa cada ensayo seg\xFAn el criterio dado y devuelve SOLO JSON con este formato exacto (sin markdown, sin bloques de c\xF3digo): {"results":[{"id":"<id>","score":<0-10>,"feedback":"<1-2 oraciones>"},...]}`
        },
        {
          role: "user",
          content: `Criterio de evaluaci\xF3n: ${data.rubric_prompt}. Eval\xFAa estos ${data.productions.length} ensayos:
${data.productions.map((p) => `ID: ${p.id}
Palabras: ${p.word_count}
Cumplimiento: ${p.compliance_score}%
Ensayo: ${p.content}`).join("\n\n")}`
        }
      ];
    case "complete_activity":
      return [
        {
          role: "system",
          content: `Eres un dise\xF1ador experto de actividades para plataformas de ense\xF1anza de idiomas. Recibes el contenido de una actividad en espa\xF1ol y debes devolver SOLO JSON con este formato exacto (sin markdown):
{"title_es":"<t\xEDtulo corto en espa\xF1ol>","title_en":"<t\xEDtulo corto en ingl\xE9s>","content_en":<mismo JSON que content_es pero con textos traducidos al ingl\xE9s>,"tags":["tag1","tag2","tag3"],"description":"<1 oraci\xF3n en espa\xF1ol describiendo qu\xE9 practica el estudiante>","description_en":"<same sentence translated to English>","difficulty":<1|2|3>}

Reglas CR\xCDTICAS para content_en:
- Mant\xE9n EXACTAMENTE la misma estructura JSON que content_es
- Si content_es tiene un array "options" con N elementos, content_en DEBE tener exactamente N elementos con los mismos IDs. NUNCA omitas ni combines opciones.
- Traduce solo los valores de texto (questions, statements, options text, hints, instruction, prompt, etc.)
- NO cambies IDs, correct_id, correct, n\xFAmeros, booleanos, min_words, max_words ni campos de referencia
- difficulty: 1=f\xE1cil, 2=medio, 3=dif\xEDcil seg\xFAn el vocabulario y complejidad del tema`
        },
        {
          role: "user",
          content: `Tipo de actividad: ${data.type}
Contenido en espa\xF1ol:
${JSON.stringify(data.content_es, null, 2)}`
        }
      ];
    case "suggest_tags":
      return [
        {
          role: "system",
          content: `Eres un experto en dise\xF1o curricular. Sugiere 4-6 etiquetas cortas (1-2 palabras cada una) para clasificar una lecci\xF3n educativa de idiomas. Devuelve SOLO JSON: {"tags_es":["etiqueta1","etiqueta2",...],"tags_en":["tag1","tag2",...]}`
        },
        {
          role: "user",
          content: `T\xEDtulo: ${data.title ?? ""}
Descripci\xF3n: ${data.description ?? ""}`
        }
      ];
    case "improve_rubric":
      return [
        {
          role: "system",
          content: `Eres un experto en evaluaci\xF3n educativa. El profesor te proporciona un borrador de criterio de evaluaci\xF3n para producci\xF3n escrita. Tu tarea es mejorar su redacci\xF3n: hazlo m\xE1s claro, espec\xEDfico y operativo (m\xE1ximo 180 palabras). Mant\xE9n la intenci\xF3n original del profesor. Responde SOLO con el criterio mejorado, sin explicaciones, sin comillas, sin prefijos.`
        },
        {
          role: "user",
          content: `Borrador del criterio:
${data.rubric_draft}`
        }
      ];
    case "generate_example":
      return [
        {
          role: "system",
          content: `Eres un docente experto en ense\xF1anza de idiomas. Escribe un texto de ejemplo modelo que un estudiante podr\xEDa entregar como respuesta a la consigna dada. El ejemplo debe ser claro, bien estructurado y cumplir todos los requisitos indicados. Devuelve SOLO JSON: {"example_text":"<texto ejemplo>"}`
        },
        {
          role: "user",
          content: `Consigna: ${data.prompt}
M\xEDnimo de palabras: ${data.min_words ?? 50}${data.max_words ? `
M\xE1ximo de palabras: ${data.max_words}` : ""}${data.required_words?.length ? `
Palabras que debe incluir: ${data.required_words.join(", ")}` : ""}${data.rubric ? `
Criterio de evaluaci\xF3n: ${data.rubric}` : ""}`
        }
      ];
    case "review_essay":
      return [
        {
          role: "system",
          content: `Eres un docente experto en evaluaci\xF3n de producci\xF3n escrita. Analiza el texto del estudiante y devuelve SOLO JSON con este formato exacto (sin markdown):
{"score":<0-10>,"summary":"<resumen en 1 oraci\xF3n>","strengths":["<fortaleza1>","<fortaleza2>"],"improvements":["<mejora1>","<mejora2>","<mejora3>"]}

Criterios: coherencia, gram\xE1tica, vocabulario, cumplimiento de consigna y requisitos.`
        },
        {
          role: "user",
          content: `Consigna: ${data.prompt ?? "Redacci\xF3n libre"}
M\xEDnimo: ${data.min_words ?? 0} palabras${data.max_words ? `, m\xE1ximo ${data.max_words}` : ""}.${data.required_words?.length ? `
Palabras requeridas: ${data.required_words.join(", ")}` : ""}${data.forbidden_words?.length ? `
Palabras prohibidas: ${data.forbidden_words.join(", ")}` : ""}${data.rubric ? `
Criterio de evaluaci\xF3n: ${data.rubric}` : ""}

Texto del estudiante:
${data.content}`
        }
      ];
    default:
      throw new Error(`Unknown task: ${task}`);
  }
}
var jsonTasks = ["generate_activity_options", "suggest_required_words", "review_production", "suggest_rubric", "batch_grade", "complete_activity", "suggest_tags", "generate_example", "review_essay"];
async function handleRequest(request) {
  const corsHeaders = cors(request);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not configured in the function environment");
    }
    const body = await request.json();
    const { task, lang, data } = body;
    const messages = buildMessages(task, lang, data);
    const maxTokens = task === "batch_grade" ? 2e3 : task === "suggest_rubric" ? 600 : task === "complete_activity" ? 2e3 : task === "generate_example" ? 600 : 400;
    const groqRes = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
        max_tokens: maxTokens,
        ...jsonTasks.includes(task) ? { response_format: { type: "json_object" } } : {}
      })
    });
    if (!groqRes.ok) {
      const err = await groqRes.text();
      throw new Error(`GROQ error ${groqRes.status}: ${err}`);
    }
    const groqData = await groqRes.json();
    const result = groqData.choices[0]?.message?.content?.trim() ?? "";
    if (jsonTasks.includes(task)) {
      const jsonStr = result.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      try {
        const parsed = JSON.parse(jsonStr);
        return new Response(JSON.stringify({ result: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON from model", raw: jsonStr }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }
    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
var ai_enhance_default = {
  fetch: handleRequest
};
export {
  ai_enhance_default as default
};
