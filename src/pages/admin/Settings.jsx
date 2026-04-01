import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Download, QrCode, Users, Settings as SettingsIcon, Plus, Trash2, UserCircle, Shield } from "lucide-react";
import { useStore } from "../../store/store";
import { useTranslation } from "../../utils/i18n";

export function Settings() {
  const t = useTranslation();
  const restaurant = useStore(state => state.auth.restaurant);
  const restaurantId = restaurant?.id;
  const { staff, addStaffMember, removeStaffMember, lockScreen } = useStore();

  const menuUrl = `${window.location.origin}/m/${restaurantId}`;
  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newRole, setNewRole] = useState("waiter");
  const [isAdding, setIsAdding] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(menuUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement('a');
      a.download = `qr-menu-${restaurant?.nom || 'restaurant'}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="w-7 h-7 text-amber-500" />
          <h1 className="text-2xl font-bold text-slate-100">{t('nav.settings')}</h1>
        </div>

        {/* QR Code Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <QrCode className="w-6 h-6 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-100">QR Code du Menu</h2>
          </div>

          <p className="text-slate-400 text-sm mb-6">
            Vos clients peuvent scanner ce QR Code pour consulter votre menu et passer commande directement depuis leur telephone.
          </p>

          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* QR Code */}
            <div className="bg-white p-4 rounded-2xl shadow-lg">
              <QRCodeSVG
                id="qr-code-svg"
                value={menuUrl}
                size={200}
                level="H"
                includeMargin
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>

            {/* URL + Actions */}
            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                  Lien du menu
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={menuUrl}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300 font-mono truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className="shrink-0 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-2.5 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleDownloadQR}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition-all active:scale-95"
              >
                <Download className="w-5 h-5" />
                Telecharger le QR Code
              </button>

              <p className="text-xs text-slate-500 text-center">
                Imprimez-le et placez-le sur vos tables pour que les clients commandent !
              </p>
            </div>
          </div>
        </section>

        {/* Staff Management Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-amber-500" />
              <h2 className="text-lg font-bold text-slate-100">Equipe & Codes PIN</h2>
            </div>
            <button
              onClick={lockScreen}
              className="text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors"
            >
              Verrouiller
            </button>
          </div>

          <p className="text-slate-400 text-sm mb-6">
            Creez des profils pour vos serveurs avec des codes PIN a 4 chiffres. Le code PIN permet de changer rapidement d'utilisateur sur la meme tablette.
          </p>

          {/* Add Staff Form */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Ajouter un membre</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Nom"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <input
                type="text"
                placeholder="PIN (4 chiffres)"
                value={newPin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setNewPin(v);
                }}
                maxLength={4}
                className="w-full sm:w-32 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full sm:w-36 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="waiter">Serveur</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={async () => {
                  if (!newName.trim() || newPin.length !== 4) return;
                  setIsAdding(true);
                  const ok = await addStaffMember(newName.trim(), newPin, newRole);
                  if (ok) { setNewName(""); setNewPin(""); setNewRole("waiter"); }
                  setIsAdding(false);
                }}
                disabled={!newName.trim() || newPin.length !== 4 || isAdding}
                className="shrink-0 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold px-4 py-2.5 rounded-lg transition-all active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Ajouter</span>
              </button>
            </div>
          </div>

          {/* Staff List */}
          {staff.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <UserCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun membre d'equipe. Ajoutez votre premier serveur ci-dessus.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {staff.map(member => (
                <div key={member.id} className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${member.role === 'admin' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-800 text-slate-400'}`}>
                    {member.role === 'admin' ? <Shield className="w-5 h-5" /> : <UserCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-100 text-sm truncate">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.role === 'admin' ? 'Administrateur' : 'Serveur'}</p>
                  </div>
                  <span className="font-mono text-sm text-slate-500 tracking-widest">****</span>
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer ${member.name} ?`)) {
                        removeStaffMember(member.id);
                      }
                    }}
                    className="text-slate-500 hover:text-red-400 p-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
