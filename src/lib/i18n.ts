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
  },
} satisfies Record<Lang, Record<string, string>>;

export function useTranslations(lang: Lang = 'es') {
  return translations[lang];
}
