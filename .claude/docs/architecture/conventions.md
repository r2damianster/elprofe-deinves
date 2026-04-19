# Convenciones del Proyecto

## Estilos

- **Sin archivos CSS**: todo el estilo con clases utilitarias de Tailwind.
- **Iconos**: solo `lucide-react`. No usar otras librerías de iconos.

## TypeScript

- **No usar `any`** excepto en bloques `catch` (`err: any`) por limitación de Supabase.
- **Interfaces**: definirlas antes del componente, en el mismo archivo.
- **i18n**: usar `resolveField(field, lang)` para campos multilingüe (title, description) que pueden ser `{es: '...', en: '...'}` o strings planos.

## Estado y efectos

Seguir el patrón establecido:
```typescript
const [data, setData] = useState(null);

useEffect(() => {
  const load = async () => {
    try {
      const { data, error } = await supabase.from('table').select('*');
      if (error) throw error;
      setData(data);
    } catch (err: any) {
      console.error(err.message);
    }
  };
  load();
}, []);
```

## Seguridad / RLS

- Todas las tablas tienen Row Level Security activado.
- Cada rol solo ve lo que está autorizado a ver.
- Las políticas RLS se apoyan en la función `get_user_role()`.

## Migraciones

- Deben ser idempotentes cuando sea posible (`IF NOT EXISTS`, `IF EXISTS`).
- Archivos en `supabase/migrations/` en orden de timestamp.

## Variables de entorno

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
GROQ_URL=https://api.groq.com/openai/v1/chat/completions  # solo Edge Functions
```

## Comandos clave

```bash
npm install        # Instalar dependencias
npm run dev        # Servidor de desarrollo (Vite, puerto 5173)
npm run build      # Build de producción
npm run preview    # Preview del build
npx tsc --noEmit   # Verificar tipos sin compilar
```
