import { useState } from 'react';
import { Calendar, TrendingUp, QrCode as QrIcon, Nfc as NfcIcon, Layers } from 'lucide-react';

export interface DayData {
  date: string; // formato YYYY-MM-DD
  label: string; // formato DD/MM
  total: number;
  qr: number;
  nfc: number;
}

interface AreaTrendChartProps {
  data: DayData[];
  daysRange: number;
  onRangeChange: (days: number) => void;
}

type ViewMetric = 'comparativo' | 'total' | 'qr' | 'nfc';

export default function AreaTrendChart({ data, daysRange, onRangeChange }: AreaTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [viewMetric, setViewMetric] = useState<ViewMetric>('comparativo');

  const totalScansPeriodo = data.reduce((acc, curr) => acc + curr.total, 0);
  const totalQrPeriodo = data.reduce((acc, curr) => acc + curr.qr, 0);
  const totalNfcPeriodo = data.reduce((acc, curr) => acc + curr.nfc, 0);

  // Valor máximo para escala do eixo Y
  const maxVal = Math.max(
    ...data.map((d) => {
      if (viewMetric === 'qr') return d.qr;
      if (viewMetric === 'nfc') return d.nfc;
      return d.total;
    }),
    4
  );

  const width = 640;
  const height = 220;
  const paddingX = 24;
  const paddingTop = 24;
  const paddingBottom = 32;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, index) => {
    const x = paddingX + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const yTotal = paddingTop + innerHeight - (d.total / maxVal) * innerHeight;
    const yQr = paddingTop + innerHeight - (d.qr / maxVal) * innerHeight;
    const yNfc = paddingTop + innerHeight - (d.nfc / maxVal) * innerHeight;
    return { x, yTotal, yQr, yNfc, ...d };
  });

  const buildLinePath = (yKey: 'yTotal' | 'yQr' | 'yNfc') => {
    if (points.length === 0) return '';
    return `M ${points[0].x} ${points[0][yKey]} ` + points.slice(1).map((p) => `L ${p.x} ${p[yKey]}`).join(' ');
  };

  const buildAreaPath = (line: string) => {
    if (!line || points.length === 0) return '';
    return `${line} L ${points[points.length - 1].x} ${paddingTop + innerHeight} L ${points[0].x} ${paddingTop + innerHeight} Z`;
  };

  const lineTotal = buildLinePath('yTotal');
  const areaTotal = buildAreaPath(lineTotal);

  const lineQr = buildLinePath('yQr');
  const areaQr = buildAreaPath(lineQr);

  const lineNfc = buildLinePath('yNfc');
  const areaNfc = buildAreaPath(lineNfc);

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
            {' • '}
            <span className="text-brand-600 font-medium">{totalQrPeriodo} QR</span>
            {' e '}
            <span className="text-teal-600 font-medium">{totalNfcPeriodo} NFC</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de métrica */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMetric('comparativo')}
              title="Comparar QR vs NFC no mesmo gráfico"
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMetric === 'comparativo' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers size={13} />
              <span>Comparativo</span>
            </button>
            <button
              onClick={() => setViewMetric('qr')}
              title="Apenas QR Codes"
              className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMetric === 'qr' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <QrIcon size={13} className="text-brand-600" />
              <span>QR</span>
            </button>
            <button
              onClick={() => setViewMetric('nfc')}
              title="Apenas Tags NFC"
              className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMetric === 'nfc' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <NfcIcon size={13} className="text-teal-600" />
              <span>NFC</span>
            </button>
            <button
              onClick={() => setViewMetric('total')}
              title="Total de Acessos"
              className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMetric === 'total' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>Total</span>
            </button>
          </div>

          {/* Seletor de dias */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => onRangeChange(days)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  daysRange === days ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {data.length === 0 || totalScansPeriodo === 0 ? (
        <div className="h-52 flex flex-col items-center justify-center text-slate-400 text-xs">
          <Calendar size={28} className="mb-2 text-slate-300" />
          <span>Nenhum scan registrado nos últimos {daysRange} dias.</span>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-52 overflow-visible"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="gradientTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="gradientQr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="gradientNfc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d9488" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Linhas de grade horizontal */}
            {[0, 0.33, 0.66, 1].map((ratio) => {
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

            {/* Camadas por Métrica Selecionada */}
            {(viewMetric === 'total' || viewMetric === 'comparativo') && (
              <>
                {viewMetric === 'total' && <path d={areaTotal} fill="url(#gradientTotal)" />}
                <path
                  d={lineTotal}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth={viewMetric === 'total' ? 2.5 : 1.8}
                  strokeDasharray={viewMetric === 'comparativo' ? '4 4' : 'none'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {(viewMetric === 'qr' || viewMetric === 'comparativo') && (
              <>
                <path d={areaQr} fill="url(#gradientQr)" opacity={viewMetric === 'comparativo' ? 0.7 : 1} />
                <path
                  d={lineQr}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {(viewMetric === 'nfc' || viewMetric === 'comparativo') && (
              <>
                <path d={areaNfc} fill="url(#gradientNfc)" opacity={viewMetric === 'comparativo' ? 0.7 : 1} />
                <path
                  d={lineNfc}
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Linha vertical de hover guia */}
            {hoverIndex !== null && points[hoverIndex] && (
              <line
                x1={points[hoverIndex].x}
                y1={paddingTop}
                x2={points[hoverIndex].x}
                y2={paddingTop + innerHeight}
                stroke="#cbd5e1"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            )}

            {/* Pontos Interativos com gatilhos de mouse */}
            {points.map((p, i) => {
              const isHovered = hoverIndex === i;
              return (
                <g key={p.date} className="cursor-pointer" onMouseEnter={() => setHoverIndex(i)}>
                  {/* Ponto QR */}
                  {(viewMetric === 'qr' || viewMetric === 'comparativo') && (
                    <circle
                      cx={p.x}
                      cy={p.yQr}
                      r={isHovered ? 5.5 : 3}
                      className="fill-white stroke-brand-600 stroke-2 transition-all duration-150"
                    />
                  )}

                  {/* Ponto NFC */}
                  {(viewMetric === 'nfc' || viewMetric === 'comparativo') && (
                    <circle
                      cx={p.x}
                      cy={p.yNfc}
                      r={isHovered ? 5.5 : 3}
                      className="fill-white stroke-teal-600 stroke-2 transition-all duration-150"
                    />
                  )}

                  {/* Ponto Total */}
                  {viewMetric === 'total' && (
                    <circle
                      cx={p.x}
                      cy={p.yTotal}
                      r={isHovered ? 6 : 3.5}
                      className="fill-white stroke-indigo-600 stroke-2 transition-all duration-150"
                    />
                  )}

                  {/* Rótulo de data no rodapé */}
                  {(points.length <= 14 || i % Math.ceil(points.length / 8) === 0) && (
                    <text
                      x={p.x}
                      y={height - 8}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-400 font-mono select-none"
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legenda visual no rodapé */}
          <div className="flex flex-wrap items-center justify-center gap-5 pt-3 border-t border-slate-100 text-xs">
            {viewMetric === 'comparativo' && (
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="w-4 h-0.5 border-t border-dashed border-indigo-500" />
                <span>Total ({totalScansPeriodo})</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />
              <span>QR Code ({totalQrPeriodo})</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              <span>Tag NFC ({totalNfcPeriodo})</span>
            </div>
          </div>

          {/* Tooltip Flutuante Detalhado */}
          {hoverIndex !== null && points[hoverIndex] && (
            <div
              className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-xl text-xs shadow-xl flex flex-col gap-1.5 z-20 min-w-[140px] animate-fade-in"
              style={{
                left: `${(points[hoverIndex].x / width) * 100}%`,
                top: `${(Math.min(points[hoverIndex].yTotal, points[hoverIndex].yQr, points[hoverIndex].yNfc) / height) * 100 - 8}%`,
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                <span className="font-semibold text-slate-200">{points[hoverIndex].label}</span>
                <span className="font-mono text-[11px] text-slate-400">{points[hoverIndex].date}</span>
              </div>

              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-500" />
                    QR Code
                  </span>
                  <span className="font-bold text-white font-mono">{points[hoverIndex].qr}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-400" />
                    Tag NFC
                  </span>
                  <span className="font-bold text-white font-mono">{points[hoverIndex].nfc}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-1 font-semibold text-white">
                  <span>Total</span>
                  <span className="font-bold font-mono text-indigo-300">{points[hoverIndex].total}</span>
                </div>
              </div>

              <div className="w-2 h-2 bg-slate-900 transform rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
