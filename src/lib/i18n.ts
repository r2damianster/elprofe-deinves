export type Lang = 'es' | 'en';

export const translations = {
  es: {
    // Navegación
    backToLessons:      'Volver a lecciones',
    next:               'Siguiente',
    previous:           'Anterior',
    // Progreso
    completed:          'completado',
    step:               'Paso',
    of:                 'de',
    progress:           'Progreso',
    // Badges
    previewMode:        'Vista Previa — el progreso no se guarda',
    liveClassBadge:     'Clase en directo — actividades bloqueadas',
    group:              'Grupo',
    // Tipos de paso
    activity:           'Actividad',
    content:            'Contenido',
    video:              'Video',
    guidedReading:      'Lectura guiada',
    readingTask:        'Tarea de lectura',
    // Modo grupal
    completedByPrefix:  'Completado por',
    completedBySuffix:  '— ya cuenta para tu grupo.',
    // Bloqueo presentación
    liveClassTitle:     'Clase en directo',
    liveClassMessage:   'Tu profesor está presentando. Las actividades estarán disponibles cuando termine la presentación.',
    // Reintentos
    attemptOf:          'Intento',
    attemptMax:         'de 3',
    retryLesson:        'Reintentar Lección',
    retryConfirm:       '¿Estás seguro de reintentar la lección? Se borrarán tus notas de todas las actividades. Esta acción no se puede deshacer.',
    // Producción
    goToProduction:     'Ir a Producción',
    unlockNeeded:       'Necesitas',
    unlockSuffix:       '% para desbloquear',
    // Dashboard
    loading:            'Cargando lecciones...',
    noLessons:          'No tienes lecciones asignadas',
    noLessonsDesc:      'Tu profesor te asignará lecciones pronto.',
    review:             'Revisar',
    continueLesson:     'Continuar',
    start:              'Comenzar',
    productionUnlocked: 'Producción Desbloqueada',
    productionLocked:   'Producción bloqueada',
    required:           'requerido',
    signOut:            'Cerrar Sesión',
    myClassroom:        'Mi Aula',
    myLessons:          'Mis Lecciones',
    myGroups:           'Mis Grupos',
    // ActivityRenderer
    points:             'Puntos',
    completed_badge:    'COMPLETADA',
    responseRecorded:   'Respuesta registrada',
    reviewResponse:     'Revisar respuesta',
    score:              'Puntuación',
  },
  en: {
    // Navigation
    backToLessons:      'Back to lessons',
    next:               'Next',
    previous:           'Previous',
    // Progress
    completed:          'completed',
    step:               'Step',
    of:                 'of',
    progress:           'Progress',
    // Badges
    previewMode:        'Preview Mode — progress is not saved',
    liveClassBadge:     'Live class — activities are locked',
    group:              'Group',
    // Step types
    activity:           'Activity',
    content:            'Content',
    video:              'Video',
    guidedReading:      'Guided reading',
    readingTask:        'Reading task',
    // Group mode
    completedByPrefix:  'Completed by',
    completedBySuffix:  '— already counts for your group.',
    // Presentation block
    liveClassTitle:     'Live class',
    liveClassMessage:   'Your professor is presenting. Activities will be available when the session ends.',
    // Retry
    attemptOf:          'Attempt',
    attemptMax:         'of 3',
    retryLesson:        'Retry Lesson',
    retryConfirm:       'Are you sure you want to retry this lesson? All your activity responses will be deleted. This action cannot be undone.',
    // Production
    goToProduction:     'Go to Production',
    unlockNeeded:       'You need',
    unlockSuffix:       '% to unlock',
    // Dashboard
    loading:            'Loading lessons...',
    noLessons:          'You have no assigned lessons',
    noLessonsDesc:      'Your professor will assign lessons soon.',
    review:             'Review',
    continueLesson:     'Continue',
    start:              'Start',
    productionUnlocked: 'Production Unlocked',
    productionLocked:   'Production locked',
    required:           'required',
    signOut:            'Sign Out',
    myClassroom:        'My Classroom',
    myLessons:          'My Lessons',
    myGroups:           'My Groups',
    // ActivityRenderer
    points:             'Points',
    completed_badge:    'COMPLETED',
    responseRecorded:   'Response recorded',
    reviewResponse:     'Review response',
    score:              'Score',
  },
} satisfies Record<Lang, Record<string, string>>;

export function useTranslations(lang: Lang = 'es') {
  return translations[lang];
}

/**
 * Resuelve un campo que puede ser:
 *   - string plano
 *   - string legacy con marcadores "en/// ... es/// ..."
 *   - {es: string, en: string} (formato JSONB actual)
 * Fallback automático al otro idioma si la traducción está vacía.
 */
export function resolveField(field: any, lang: Lang): string {
  if (!field) return '';
  if (typeof field === 'object') {
    const primary  = field[lang];
    const fallback = field[lang === 'en' ? 'es' : 'en'];
    return (primary && primary.trim()) ? primary : (fallback ?? '');
  }
  const raw = field as string;
  if (raw.includes('es///') || raw.includes('en///')) {
    if (lang === 'es') {
      const m = raw.match(/es\/\/\/\s*([\s\S]*)$/);
      if (m) return m[1].trim();
      // solo tiene en///
      const mEn = raw.match(/en\/\/\/\s*([\s\S]*)$/);
      return mEn ? mEn[1].trim() : raw;
    } else {
      const m = raw.match(/en\/\/\/\s*([\s\S]*)(?:\s*es\/\/\/|$)/);
      if (m) return m[1].replace(/\s*es\/\/\/[\s\S]*$/, '').trim();
      // solo tiene es///
      const mEs = raw.match(/es\/\/\/\s*([\s\S]*)$/);
      return mEs ? mEs[1].trim() : raw;
    }
  }
  return raw;
}
