import { QrCode, Nfc, Smartphone, Monitor, Sparkles } from 'lucide-react';

interface DistributionCardsProps {
  totalQr: number;
  totalNfc: number;
  dispositivos: {
    mobileIos: number;
    mobileAndroid: number;
    desktop: number;
    outros: number;
  };
}

export default function DistributionCards({ totalQr, totalNfc, dispositivos }: DistributionCardsProps) {
  const totalScans = totalQr + totalNfc;
  const qrPct = totalScans > 0 ? Math.round((totalQr / totalScans) * 100) : 0;
  const nfcPct = totalScans > 0 ? 100 - qrPct : 0;

  // Parâmetros do gráfico de Rosca (Donut SVG)
  const radius = 42;
  const circumference = 2 * Math.PI * radius; // ≈ 263.89
  const qrStrokeLength = (qrPct / 100) * circumference;
  const nfcStrokeLength = (nfcPct / 100) * circumference;

  const totalDisp =
    dispositivos.mobileIos +
    dispositivos.mobileAndroid +
    dispositivos.desktop +
    dispositivos.outros;

  const iosPct = totalDisp > 0 ? Math.round((dispositivos.mobileIos / totalDisp) * 100) : 0;
  const androidPct = totalDisp > 0 ? Math.round((dispositivos.mobileAndroid / totalDisp) * 100) : 0;
  const desktopPct = totalDisp > 0 ? Math.round((dispositivos.desktop / totalDisp) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Gráfico Donut: QR Code vs NFC */}
      <div className="card p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-slate-900">QR Code vs Tag NFC</h3>
            <span className="text-xs text-slate-400 font-medium">Tecnologia</span>
          </div>
          <p className="text-xs text-slate-500 mb-5">Proporção e preferência de leitura física dos clientes</p>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Donut SVG */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 110 110">
                {/* Trilha de fundo */}
                <circle
                  cx="55"
                  cy="55"
                  r={radius}
                  className="stroke-slate-100"
                  strokeWidth="12"
                  fill="transparent"
                />

                {totalScans > 0 ? (
                  <>
                    {/* Segmento QR Code */}
                    {totalQr > 0 && (
                      <circle
                        cx="55"
                        cy="55"
                        r={radius}
                        stroke="#2563eb"
                        strokeWidth="12"
                        strokeDasharray={`${qrStrokeLength} ${circumference}`}
                        strokeDashoffset={0}
                        strokeLinecap={totalNfc > 0 ? 'butt' : 'round'}
                        fill="transparent"
                        className="transition-all duration-700 ease-out"
                      />
                    )}

                    {/* Segmento NFC Tag */}
                    {totalNfc > 0 && (
                      <circle
                        cx="55"
                        cy="55"
                        r={radius}
                        stroke="#0d9488"
                        strokeWidth="12"
                        strokeDasharray={`${nfcStrokeLength} ${circumference}`}
                        strokeDashoffset={-qrStrokeLength}
                        strokeLinecap="butt"
                        fill="transparent"
                        className="transition-all duration-700 ease-out"
                      />
                    )}
                  </>
                ) : (
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    className="stroke-slate-200 stroke-dasharray-4"
                    strokeWidth="4"
                    fill="transparent"
                  />
                )}
              </svg>

              {/* Centro com Totais */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
                  {totalScans}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Leituras
                </span>
              </div>
            </div>

            {/* Detalhamento dos Dois Lados */}
            <div className="flex-1 w-full space-y-3">
              {/* Card QR Code */}
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100/80">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-brand-600 text-white flex items-center justify-center">
                      <QrCode size={13} />
                    </div>
                    <span className="text-xs font-semibold text-slate-800">QR Code</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono font-bold text-slate-900 text-sm">{totalQr}</span>
                    <span className="text-[11px] font-semibold text-brand-600 font-mono">({qrPct}%)</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-blue-200/50 overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full transition-all duration-500"
                    style={{ width: `${qrPct}%` }}
                  />
                </div>
              </div>

              {/* Card NFC Tag */}
              <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-100/80">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                      <Nfc size={13} />
                    </div>
                    <span className="text-xs font-semibold text-slate-800">Tag NFC</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono font-bold text-slate-900 text-sm">{totalNfc}</span>
                    <span className="text-[11px] font-semibold text-teal-600 font-mono">({nfcPct}%)</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-teal-200/50 overflow-hidden">
                  <div
                    className="h-full bg-teal-600 rounded-full transition-all duration-500"
                    style={{ width: `${nfcPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Insight automatizado */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
          <Sparkles size={14} className="text-amber-500 shrink-0" />
          <span>
            {totalScans === 0
              ? 'Nenhum acesso computado até o momento.'
              : qrPct >= 65
              ? `Clientes usam predominantemente QR Code (${qrPct}%).`
              : nfcPct >= 65
              ? `Destaque para Tags NFC, responsáveis por ${nfcPct}% das leituras.`
              : 'Uso bem equilibrado entre leitura de QR Code e aproximação NFC.'}
          </span>
        </div>
      </div>

      {/* Dispositivos dos Clientes */}
      <div className="card p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-slate-900">Dispositivos dos Visitantes</h3>
            <span className="text-xs text-slate-400 font-medium">Plataformas</span>
          </div>
          <p className="text-xs text-slate-500 mb-5">Sistemas operacionais mais utilizados para avaliar</p>

          <div className="space-y-3.5">
            {/* iOS */}
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center">
                    <Smartphone size={13} />
                  </div>
                  <span className="font-semibold text-slate-800">Apple iOS (iPhone / iPad)</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono font-bold text-slate-900">{dispositivos.mobileIos}</span>
                  <span className="text-[11px] text-slate-500 font-mono">({iosPct}%)</span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-slate-800 rounded-full transition-all duration-500"
                  style={{ width: `${iosPct}%` }}
                />
              </div>
            </div>

            {/* Android */}
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                    <Smartphone size={13} />
                  </div>
                  <span className="font-semibold text-slate-800">Google Android</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono font-bold text-slate-900">{dispositivos.mobileAndroid}</span>
                  <span className="text-[11px] text-emerald-600 font-mono font-semibold">({androidPct}%)</span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-emerald-200/50 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${androidPct}%` }}
                />
              </div>
            </div>

            {/* Desktop / Outros */}
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                    <Monitor size={13} />
                  </div>
                  <span className="font-semibold text-slate-800">Computador / Outros</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono font-bold text-slate-900">{dispositivos.desktop + dispositivos.outros}</span>
                  <span className="text-[11px] text-indigo-600 font-mono font-semibold">({desktopPct}%)</span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${desktopPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Total de acessos identificados: {totalDisp}</span>
          <span className="font-medium text-slate-600">
            {iosPct + androidPct > 0 ? `${iosPct + androidPct}% Mobile` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
