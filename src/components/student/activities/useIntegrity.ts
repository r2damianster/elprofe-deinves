import { useState, useEffect, useCallback } from 'react';

export interface IntegrityEvent {
  label: string;
  penalty: number;
}

export function useIntegrity(disabled: boolean) {
  const [score, setScore]   = useState(100);
  const [events, setEvents] = useState<IntegrityEvent[]>([]);

  const penalize = useCallback((label: string, penalty: number) => {
    if (disabled) return;
    setEvents(prev => [...prev, { label, penalty }]);
    setScore(prev => Math.max(0, prev - penalty));
  }, [disabled]);

  // Cambio de pestaña
  useEffect(() => {
    if (disabled) return;
    const h = () => { if (document.hidden) penalize('Cambio de pestaña', 10); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [disabled, penalize]);

  // Salida de ventana
  useEffect(() => {
    if (disabled) return;
    const h = () => { if (!document.hidden) penalize('Salida de ventana', 5); };
    window.addEventListener('blur', h);
    return () => window.removeEventListener('blur', h);
  }, [disabled, penalize]);

  // Clic derecho
  useEffect(() => {
    if (disabled) return;
    const h = (e: MouseEvent) => { e.preventDefault(); penalize('Clic derecho', 3); };
    document.addEventListener('contextmenu', h);
    return () => document.removeEventListener('contextmenu', h);
  }, [disabled, penalize]);

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    penalize('Intento de pegar texto', 15);
  }

  return { score, events, penalize, onPaste };
}
