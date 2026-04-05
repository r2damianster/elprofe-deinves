import { BarChart, ShieldAlert } from 'lucide-react';
import { IntegrityEvent } from './useIntegrity';

interface Props {
  compliance: number;       // 0-100
  complianceLabel: string;  // texto debajo de la barra
  integrity: number;        // 0-100
  events: IntegrityEvent[];
}

function barColor(pct: number) {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-yellow-400';
  return 'bg-red-500';
}

export default function MetricsBar({ compliance, complianceLabel, integrity, events }: Props) {
  return (
    <div className="space-y-2">
      {/* Barras */}
      <div className="grid grid-cols-2 gap-3 p-4 bg-gray-800 rounded-xl text-white text-xs">
        <div>
          <div className="flex justify-between mb-1 font-semibold uppercase tracking-wide">
            <span className="flex items-center gap-1"><BarChart className="w-3 h-3" /> Cumplimiento</span>
            <span className={compliance === 100 ? 'text-green-400' : 'text-yellow-300'}>{compliance}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all duration-300 ${barColor(compliance)}`}
              style={{ width: `${compliance}%` }} />
          </div>
          <p className="mt-1 text-gray-400">{complianceLabel}</p>
        </div>

        <div>
          <div className="flex justify-between mb-1 font-semibold uppercase tracking-wide">
            <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-red-300" /> Integridad</span>
            <span className={integrity <= 50 ? 'text-red-400 font-bold' : 'text-green-400'}>{integrity}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all duration-300 ${barColor(integrity)}`}
              style={{ width: `${integrity}%` }} />
          </div>
          <p className="mt-1 text-gray-400">
            {events.length === 0 ? 'Sin infracciones' : `${events.length} infracción(es)`}
          </p>
        </div>
      </div>

      {/* Log de infracciones */}
      {events.length > 0 && (
        <div className="space-y-1">
          {events.map((ev, i) => (
            <div key={i} className="flex justify-between text-xs px-3 py-1 bg-red-50 border border-red-100 rounded-lg">
              <span className="text-red-700 font-medium">{ev.label}</span>
              <span className="text-red-500 font-bold">-{ev.penalty} integridad</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
