import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Phone, QrCode } from "lucide-react";
import { useStore } from "../../store/store";
import { cn } from "../../utils/utils";
import { Button } from "../../components/ui/Button";
import { useTranslation } from "../../utils/i18n";

export function Tables() {
  const t = useTranslation();
  const { tables, setTableStatus } = useStore();
  const [selectedTableQR, setSelectedTableQR] = useState(null);

  const getStatusColor = (status) => {
    switch (status) {
      case "libre": return "border-slate-700 bg-slate-900";
      case "occupee": return "border-amber-500/50 bg-amber-500/10";
      case "service_demande": return "border-red-500 bg-red-500/10 animate-pulse";
      default: return "border-slate-700 bg-slate-900";
    }
  };

  const menuUrl = (tableId) => `${window.location.origin}/menu/${tableId}`;

  return (
    <div className="p-4 md:p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-100">{t('tables.title')}</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-700"></div> {t('tables.free')}</span>
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> {t('tables.occupied')}</span>
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div> {t('tables.service')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1">
        {tables.map(table => (
          <div 
            key={table.id}
            className={cn(
              "flex flex-col border-2 rounded-2xl p-4 transition-all duration-300",
              getStatusColor(table.status)
            )}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-4xl font-black text-slate-300">
                {table.number}
              </span>
              <button 
                onClick={() => setSelectedTableQR(table)}
                className="text-slate-400 hover:text-amber-500 p-2 bg-slate-950 rounded-lg transition-colors border border-slate-800"
                title="Afficher QR Code"
              >
                <QrCode className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-auto space-y-2">
              <p className="text-sm font-semibold capitalize text-slate-400 mb-4 tracking-wide">
                {table.status === 'libre' ? t('tables.free') : table.status === 'occupee' ? t('tables.occupied') : t('tables.service')}
              </p>

              <div className="flex gap-2">
                {table.status !== "libre" && (
                  <Button 
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setTableStatus(table.id, "libre")}
                  >
                    <Check className="w-3 h-3 mr-1" /> Libérer
                  </Button>
                )}
                
                {table.status === "service_demande" && (
                  <Button 
                    variant="primary"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setTableStatus(table.id, "occupee")}
                  >
                    <Phone className="w-3 h-3 mr-1" /> Répondu
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QR Code Modal */}
      {selectedTableQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl flex flex-col items-center max-w-sm w-full mx-auto relative animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold mb-2">Table {selectedTableQR.number}</h2>
            <p className="text-slate-400 text-sm mb-6 text-center">Scannez pour commander</p>
            
            <div className="bg-white p-4 rounded-xl mb-6 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
              <QRCodeSVG 
                value={menuUrl(selectedTableQR.number)} 
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"H"}
              />
            </div>

            <Button variant="outline" className="w-full" onClick={() => setSelectedTableQR(null)}>
              Fermer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
