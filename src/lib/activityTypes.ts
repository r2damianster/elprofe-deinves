export const PRODUCTION_TYPES = new Set([
  'essay',
  'long_response',
  'structured_essay',
  'open_writing',
]);

// Aparecen en el flujo normal como pasos, con badge de Producción
export const isProduction = (type: string): boolean => PRODUCTION_TYPES.has(type);
