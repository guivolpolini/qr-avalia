import { useState } from 'react';
import { Calendar, TrendingUp } from 'lucide-react';

export interface DayData {
  date: string; // formato YYYY-MM-DD
  label: string; // formato DD/MM
  total: number;
}

interface AreaTrendChartProps {
  data: DayData[];
  daysRange: number;
  onRangeChange: (days: number) => void;
}

export default function AreaTrendChart({ data, daysRange, onRangeChange }: AreaTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const maxVal = Math.max(...data.map((d) => d.total), 5);
  const totalScansPeriodo = data.reduce((acc, curr) => acc + curr.total, 0);

  const width = 600;
  const height = 200;
  const paddingX = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, index) => {
    const x = paddingX + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const y = paddingTop + innerHeight - (d.total / maxVal) * innerHeight;
    return { x, y, ...d };
  });

  const linePath =
    points.length > 0
      ? `M ${points[0].x} ${points[0].y} ` +
        points
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(' ')
      : '';

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + innerHeight} L ${points[0].x} ${paddingTop + innerHeight} Z`
      : '';

  return (
    <div className="card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">Evolução de Acessos</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Total de <span className="font-semibold text-slate-800">{totalScansPeriodo}</span> leituras no período
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              onClick={() => onRangeChange(days)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                daysRange === days
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {days} dias
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 || totalScansPeriodo === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
          <Calendar size={28} className="mb-2 text-slate-300" />
          <span>Nenhum scan registrado nos últimos {daysRange} dias.</span>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-48 overflow-visible"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3380fc" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#3380fc" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Linhas de grade horizontal */}
            {[0, 0.5, 1].map((ratio) => {
              const y = paddingTop + innerHeight * (1 - ratio);
              return (
                <line
                  key={ratio}
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray={ratio === 0 ? 'none' : '4 4'}
                />
              );
            })}

            {/* Área preenchida */}
            <path d={areaPath} fill="url(#areaGradient)" />

            {/* Linha principal */}
            <path
              d={linePath}
              fill="none"
              stroke="#1c61f2"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Pontos interativos */}
            {points.map((p, i) => (
              <g key={p.date} className="cursor-pointer" onMouseEnter={() => setHoverIndex(i)}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === i ? 6 : 3.5}
                  className={`transition-all duration-150 ${
                    hoverIndex === i
                      ? 'fill-brand-600 stroke-white stroke-[2.5px]'
                      : 'fill-white stroke-brand-600 stroke-2'
                  }`}
                />
                {/* Rótulo de data no rodapé (para alguns pontos) */}
                {(points.length <= 14 || i % Math.ceil(points.length / 7) === 0) && (
                  <text
                    x={p.x}
                    y={height - 8}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-400 font-mono"
                  >
                    {p.label}
                  </text>
                )}
              </g>
            ))}
          </svg>

          {/* Tooltip flutuante */}
          {hoverIndex !== null && points[hoverIndex] && (
            <div
              className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-900 text-white px-2.5 py-1.5 rounded-lg text-xs shadow-lg flex flex-col items-center z-10 animate-fade-in"
              style={{
                left: `${(points[hoverIndex].x / width) * 100}%`,
                top: `${(points[hoverIndex].y / height) * 100}%`,
              }}
            >
              <span className="font-bold text-white text-xs">
                {points[hoverIndex].total} {points[hoverIndex].total === 1 ? 'scan' : 'scans'}
              </span>
              <span className="text-[10px] text-slate-300 font-mono">{points[hoverIndex].label}</span>
              <div className="w-2 h-2 bg-slate-900 transform rotate-45 absolute -bottom-1" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
