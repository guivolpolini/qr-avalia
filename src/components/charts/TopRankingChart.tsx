import { Store, Award } from 'lucide-react';

export interface RankingItem {
  id: string;
  nome: string;
  total: number;
}

interface TopRankingChartProps {
  items: RankingItem[];
}

export default function TopRankingChart({ items }: TopRankingChartProps) {
  const maxScans = Math.max(...items.map((i) => i.total), 1);

  return (
    <div className="card p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">Top Estabelecimentos</h2>
          </div>
          <span className="text-xs text-slate-400">Mais avaliados</span>
        </div>
        <p className="text-xs text-slate-500 mb-5">Estabelecimentos com maior engajamento</p>

        {items.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
            <Store size={26} className="mb-2 text-slate-300" />
            <span>Nenhum dado registrado ainda.</span>
          </div>
        ) : (
          <div className="space-y-3.5">
            {items.slice(0, 5).map((item, index) => {
              const pct = Math.round((item.total / maxScans) * 100);
              const rankColor =
                index === 0
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : index === 1
                  ? 'bg-slate-200 text-slate-800 border-slate-300'
                  : index === 2
                  ? 'bg-amber-50 text-amber-700 border-amber-100'
                  : 'bg-slate-50 text-slate-500 border-slate-100';

              return (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] border ${rankColor}`}
                      >
                        {index + 1}º
                      </span>
                      <span className="font-semibold text-slate-800 truncate">{item.nome}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-700 ml-2">
                      {item.total} {item.total === 1 ? 'scan' : 'scans'}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-center">
        <span className="text-[11px] text-slate-400">Calculado a partir do histórico total de scans</span>
      </div>
    </div>
  );
}
