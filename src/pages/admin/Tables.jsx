import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Phone, QrCode, Plus, Trash2, Lock, X } from "lucide-react";
import { useStore } from "../../store/store";
import { cn } from "../../utils/utils";
import { Button } from "../../components/ui/Button";
import { useTranslation } from "../../utils/i18n";

export function Tables() {
  const t = useTranslation();
  const { tables, setTableStatus, addTable, deleteTable } = useStore();
  const [selectedTableQR, setSelectedTableQR] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case "libre": return "border-slate-700 bg-slate-900";
      case "occupee": return "border-amber-500/50 bg-amber-500/10";
      case "service_demande": return "border-red-500 bg-red-500/10 animate-pulse";
      default: return "border-slate-700 bg-slate-900";
    }
  };

  const menuUrl = (tableId) => `${window.location.origin}/menu/${tableId}`;

  const handleDeleteClick = (table) => {
    if (table.status !== 'libre') return;
    setDeleteTarget(table);
    setPinInput("");
    setPinError(false);
  };

  const confirmDelete = async () => {
    if (pinInput !== "0000") {
      setPinError(true);
      return;
    }
    if (deleteTarget) {
      await deleteTable(deleteTarget.id);
      setDeleteTarget(null);
      setPinInput("");
      setPinError(false);
    }
  };

  return (
    <div className="p-4 md:p-8 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-100">{t('tables.title')}</h1>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-700"></div> {t('tables.free')}</span>
            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> {t('tables.occupied')}</span>
            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div> {t('tables.service')}</span>
          </div>
          <Button
            variant="primary"
            className="flex items-center gap-2 text-sm"
            onClick={addTable}
          >
            <Plus className="w-4 h-4" /> Ajouter Table
          </Button>
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedTableQR(table)}
                  className="text-slate-400 hover:text-amber-500 p-2 bg-slate-950 rounded-lg transition-colors border border-slate-800"
                  title="Afficher QR Code"
                >
                  <QrCode className="w-5 h-5" />
                </button>
                {table.status === 'libre' && (
                  <button
                    onClick={() => handleDeleteClick(table)}
                    className="text-slate-400 hover:text-red-400 p-2 bg-slate-950 rounded-lg transition-colors border border-slate-800"
                    title="Supprimer cette table"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
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

      {/* PIN Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-5 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-400" />
                Supprimer Table {deleteTarget.number}
              </h2>
              <button onClick={() => setDeleteTarget(null)} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-400">
              Cette action est irréversible. Entrez le code PIN pour confirmer la suppression.
            </p>

            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Code PIN</label>
              <input
                type="password"
                maxLength={4}
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
                onKeyDown={(e) => e.key === 'Enter' && confirmDelete()}
                placeholder="••••"
                className={cn(
                  "w-full px-4 py-3 rounded-xl text-center text-2xl tracking-[0.5em] font-mono bg-slate-950 border transition-colors focus:outline-none focus:ring-2",
                  pinError
                    ? "border-red-500 focus:ring-red-500/30"
                    : "border-slate-700 focus:ring-amber-500/30 focus:border-amber-500"
                )}
                autoFocus
              />
              {pinError && (
                <p className="text-red-400 text-xs mt-2 font-semibold">Code PIN incorrect.</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-red-600 hover:bg-red-500 text-white"
                onClick={confirmDelete}
                disabled={pinInput.length < 4}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
