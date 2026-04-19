# Flujo: Autenticación

## Descripción
Sistema de autenticación unificado usando Supabase Auth con roles (admin, professor, student).

## Componentes

### Login.tsx
Página de inicio de sesión única para todos los roles.

**Features:**
- Email y contraseña
- Validación de campos
- Mensajes de error
- Link a recuperación de contraseña

### AuthContext.tsx
Contexto global de autenticación.

```typescript
interface AuthContextType {
  user: User | null;              // Usuario de Supabase Auth
  profile: Profile | null;        // Perfil de la tabla profiles
  role: UserRole | null;          // 'admin' | 'professor' | 'student'
  isAdmin: boolean;               // Flag adicional
  isLoading: boolean;             // Cargando estado
  signIn: (email, password) => Promise<void>;
  signOut: () => Promise<void>;
}
```

## Flujo de Login

```
┌─────────────────────────────────────────────────────────────┐
│                        LOGIN                                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario ingresa email y contraseña                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. signInWithPassword() de Supabase                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Si éxito: Obtener perfil de tabla profiles               │
│    SELECT * FROM profiles WHERE id = auth.uid()              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Determinar rol:                                          │
│    - profile.role                                            │
│    - profile.is_admin (para doble rol)                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Redirigir según rol:                                     │
│    - admin → /admin                                          │
│    - professor → /professor                                  │
│    - student → /student                                      │
└─────────────────────────────────────────────────────────────┘
```

## Registro

### Proceso
1. Usuario se registra vía Supabase Auth
2. Trigger automático crea registro en `profiles`
3. Por defecto: role = 'student'
4. Admin puede cambiar rol manualmente

### Trigger SQL
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'student'  -- Default role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Doble Rol (Admin + Profesor)

### Detección
```typescript
const hasDoubleRole = profile.role === 'professor' && profile.is_admin === true;
```

### UI
- Toggle en navbar para cambiar vista
- Estado guardado en localStorage
- Redirect automático al cambiar

### Persistencia
```typescript
// Al iniciar sesión
localStorage.setItem('currentRole', defaultRole);

// Al cambiar
localStorage.setItem('currentRole', newRole);
window.location.href = newRole === 'admin' ? '/admin' : '/professor';
```

## Protección de Rutas

### AuthGuard
```typescript
function AuthGuard({ children, allowedRoles }) {
  const { user, profile, isLoading } = useAuth();
  
  if (isLoading) return <Loading />;
  if (!user) return <Navigate to="/login" />;
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
}
```

### Uso
```typescript
<Route path="/admin" element={
  <AuthGuard allowedRoles={['admin']}>
    <AdminDashboard />
  </AuthGuard>
} />

<Route path="/professor" element={
  <AuthGuard allowedRoles={['professor', 'admin']}>
    <ProfessorDashboard />
  </AuthGuard>
} />
```

## RLS (Row Level Security)

### Políticas basadas en rol

```sql
-- Verificar rol en RLS
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Professors can view their courses"
ON courses FOR SELECT
USING (
  professor_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

## Tokens y Sesión

### Almacenamiento
- Supabase guarda tokens automáticamente
- LocalStorage por defecto
- Refresh token automático

### Expiración
- Access token: 1 hora
- Refresh token: 1 semana (configurable)

### Logout
```typescript
const signOut = async () => {
  await supabase.auth.signOut();
  localStorage.removeItem('currentRole');
  navigate('/login');
};
```

## Edge Cases

1. **Usuario sin perfil**: Redirigir a completar registro
2. **Rol inválido**: Default a 'student' o mostrar error
3. **Token expirado**: Refrescar automáticamente
4. **Múltiples pestañas**: Sincronizar estado
5. **Cambio de contraseña**: Invalidar sesiones
6. **Usuario bloqueado**: Mostrar mensaje específico

## Recuperación de Contraseña

1. Click "¿Olvidaste tu contraseña?"
2. Ingresar email
3. Supabase envía email con link
4. Usuario establece nueva contraseña
5. Redirigir a login
