export const PRODUCTION_TYPES = new Set([
  'essay',
  'long_response',
  'structured_essay',
  'open_writing',
]);

export const isProduction = (type: string): boolean => PRODUCTION_TYPES.has(type);
