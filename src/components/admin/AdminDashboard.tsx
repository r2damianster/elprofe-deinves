import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, Trash2, BookOpen, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Professor {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfessors();
  }, []);

  async function loadProfessors() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'professor')
      .order('created_at', { ascending: false });

    if (data) setProfessors(data);
  }

  async function inviteProfessor(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: 'professor',
        });
      }

      setShowInviteForm(false);
      setEmail('');
      setFullName('');
      setPassword('');
      loadProfessors();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteProfessor(id: string) {
    if (!confirm('¿Estás seguro de eliminar este profesor?')) return;

    const { error } = await supabase.from('profiles').delete().eq('id', id);

    if (!error) {
      loadProfessors();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <BookOpen className="w-8 h-8 text-blue-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-800">Panel Administrador</h1>
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <Users className="w-6 h-6 mr-2" />
              Profesores
            </h2>
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Invitar Profesor
            </button>
          </div>

          {showInviteForm && (
            <form onSubmit={inviteProfessor} className="bg-blue-50 p-4 rounded-lg mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Nombre Completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                  required
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear Profesor'}
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha Creación
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {professors.map((prof) => (
                  <tr key={prof.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{prof.full_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{prof.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(prof.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteProfessor(prof.id)}
                        className="text-red-600 hover:text-red-800 transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
