import { QrCode, Nfc, Smartphone, Monitor } from 'lucide-react';

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
  const qrPct = totalScans > 0 ? Math.round((totalQr / totalScans) * 100) : 50;
  const nfcPct = totalScans > 0 ? 100 - qrPct : 50;

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
      {/* Comparativo QR Code vs NFC */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-1">Tecnologia Utilizada</h3>
        <p className="text-xs text-slate-500 mb-4">Proporção de acessos por QR Code vs Tag NFC</p>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <QrCode size={15} className="text-brand-600" />
              <span>QR Code ({totalQr})</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Nfc size={15} className="text-teal-600" />
              <span>Tag NFC ({totalNfc})</span>
            </div>
          </div>

          {/* Barra segmentada */}
          <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all duration-500"
              style={{ width: `${totalScans === 0 ? 50 : qrPct}%` }}
              title={`QR Code: ${qrPct}%`}
            />
            <div
              className="h-full bg-teal-500 transition-all duration-500"
              style={{ width: `${totalScans === 0 ? 50 : nfcPct}%` }}
              title={`NFC: ${nfcPct}%`}
            />
          </div>

          <div className="flex justify-between text-[11px] font-mono font-semibold text-slate-500 pt-1">
            <span className="text-brand-600">{totalScans === 0 ? '0%' : `${qrPct}%`}</span>
            <span className="text-teal-600">{totalScans === 0 ? '0%' : `${nfcPct}%`}</span>
          </div>
        </div>
      </div>

      {/* Dispositivos dos Clientes */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-1">Dispositivos dos Clientes</h3>
        <p className="text-xs text-slate-500 mb-4">Sistema operacional dos visitantes</p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex justify-center mb-1 text-slate-700">
              <Smartphone size={16} />
            </div>
            <div className="font-bold text-slate-900 text-sm">{iosPct}%</div>
            <div className="text-[10px] text-slate-500">iPhone / iOS</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex justify-center mb-1 text-emerald-600">
              <Smartphone size={16} />
            </div>
            <div className="font-bold text-slate-900 text-sm">{androidPct}%</div>
            <div className="text-[10px] text-slate-500">Android</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex justify-center mb-1 text-indigo-600">
              <Monitor size={16} />
            </div>
            <div className="font-bold text-slate-900 text-sm">{desktopPct}%</div>
            <div className="text-[10px] text-slate-500">Computador</div>
          </div>
        </div>
      </div>
    </div>
  );
}
