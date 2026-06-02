import React, { useState } from 'react';
import { Download, Check, AlertTriangle, HelpCircle } from 'lucide-react';

interface GoogleDocsImportProps {
  onImportSuccess: (count: number) => void;
  primaryColor: string;
}

export default function GoogleDocsImport({ onImportSuccess, primaryColor }: GoogleDocsImportProps) {
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleImport = async () => {
    if (!pasteText.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      // Simple smart parser for TSV (from Google Sheets/Docs tables) or CSV or structured lines
      const lines = pasteText.split('\n');
      const list: any[] = [];

      lines.forEach(line => {
        if (!line.trim()) return;

        // Try to split by tab, comma, or semicolon
        let parts = line.split('\t');
        if (parts.length < 3) {
          parts = line.split(',');
        }
        if (parts.length < 3) {
          parts = line.split(';');
        }

        if (parts.length >= 3) {
          // Expect columns: Name, Email, Domain, Cost, Expiry Date (YYYY-MM-DD or DD/MM/YYYY)
          const name = parts[0]?.trim();
          const email = parts[1]?.trim() || '';
          const domain = parts[2]?.trim().replace(/^https?:\/\//, '').toLowerCase();
          const costVal = parts[3]?.trim();
          const cost = costVal ? parseFloat(costVal.replace(/[^0-9.]/g, '')) : 100;
          let expiryDate = parts[4]?.trim();

          // Try parsing formatted date
          if (expiryDate) {
            // DD/MM/YYYY -> YYYY-MM-DD
            if (expiryDate.includes('/')) {
              const dParts = expiryDate.split('/');
              if (dParts.length === 3) {
                const day = dParts[0].padStart(2, '0');
                const month = dParts[1].padStart(2, '0');
                let year = dParts[2];
                if (year.length === 2) year = '20' + year;
                expiryDate = `${year}-${month}-${day}`;
              }
            }
          } else {
            // Set default 30 days from now
            expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          }

          if (name && domain) {
            list.push({
              name,
              email,
              domain,
              cost: isNaN(cost) ? 100 : cost,
              currency: 'COP',
              expiryDate
            });
          }
        }
      });

      if (list.length === 0) {
        setResult({
          success: false,
          error: 'No se detectó ningún cliente válido. Asegúrate de separar las columnas con comas o tabuladores.'
        });
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('hosting_corp_id_token') || '';
      const response = await fetch('/api/bulk-import', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ list })
      });

      if (!response.ok) {
        throw new Error('Error al importar en el servidor');
      }

      const data = await response.json();
      setResult({ success: true, count: data.count });
      setPasteText('');
      onImportSuccess(data.count);
    } catch (err: any) {
      setResult({ success: false, error: err.message || 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0b0b0e] border border-white/5 rounded-2xl p-6 shadow-xl" id="google-docs-import-panel">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Download className="w-5 h-5" style={{ color: primaryColor }} />
            Importar desde Google Docs / Planilla
          </h3>
          <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
            Migra fácilmente tus más de 100 registros con un copiar y pegar rápido.
          </p>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="text-zinc-400 hover:text-white flex items-center gap-1 text-xs bg-white/5 px-3.5 py-2 rounded-xl border border-white/5 transition duration-200 cursor-pointer"
          type="button"
          id="btn-toggle-import-help"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          {showHelp ? 'Ocultar formato' : 'Ver formato de ejemplo'}
        </button>
      </div>

      {showHelp && (
        <div className="bg-[#060608]/90 p-5 rounded-2xl border border-white/5 mb-5 animate-fade-in text-xs text-zinc-300 space-y-3 leading-relaxed">
          <p className="font-bold text-white uppercase tracking-wider text-[10px]">Opción 1: Hojas de cálculo (Copiar filas de Google Sheets)</p>
          <p>Selecciona las celdas directamente en Google Sheets y pégalas aquí. Las celdas deben tener este orden:</p>
          <div className="bg-zinc-950 p-3.5 font-mono rounded-xl text-zinc-400 border border-white/5 overflow-x-auto text-[11px] leading-normal shadow-inner">
            Carlos Ruiz [TAB] carlos@mail.com [TAB] suweb.com [TAB] 150 [TAB] 2026-08-30 <br />
            Sofía Silva [TAB] sofia@estudio.cl [TAB] sofiasilva.net [TAB] 85 [TAB] 12/06/2026
          </div>
          <p className="font-bold text-white uppercase tracking-wider text-[10px] mt-4">Opción 2: Formato CSV plano (Separado por comas)</p>
          <p>Pega texto plano de tu documento separado por comas:</p>
          <div className="bg-zinc-950 p-3.5 font-mono rounded-xl text-zinc-400 border border-white/5 text-[11px] leading-normal shadow-inner">
            Nombre, Correo, Dominio, Costo, FechaVencimiento<br />
            Laura Montes, laura@montes.com, montesdiseno.com, 130, 2026-12-01
          </div>
        </div>
      )}

      <textarea
        className="w-full h-40 bg-zinc-950/70 text-zinc-200 p-4 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-mono placeholder:text-zinc-650 leading-relaxed shadow-inner"
        style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        placeholder="Pega las filas de tu documento de Google Docs o planilla aquí..."
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        id="import-textarea"
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5">
        <div className="text-[11px] text-zinc-550 order-2 sm:order-1 font-medium">
          * Los registros se importarán automáticamente en estado <span className="text-zinc-400 font-semibold">pendiente de pago</span>.
        </div>
        <button
          onClick={handleImport}
          disabled={loading || !pasteText.trim()}
          className="w-full sm:w-auto px-5 py-2.8 rounded-xl text-zinc-950 font-bold text-xs transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 shadow-md active:scale-95"
          style={{ backgroundColor: primaryColor }}
          type="button"
          id="btn-submit-import"
        >
          {loading ? 'Importando...' : 'Iniciar Importación de Clientes'}
        </button>
      </div>

      {result && (
        <div className={`mt-5 p-4 rounded-xl flex items-start gap-2.5 text-xs ${result.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/15' : 'bg-red-500/10 text-red-300 border border-red-500/15'}`} id="import-result-alert">
          {result.success ? (
            <>
              <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-400">¡Importación Completada!</p>
                <p className="text-[11px] text-emerald-300/80 mt-1 leading-normal">Se cargaron de forma segura {result.count} nuevos clientes a la base de datos.</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-400">Fallo en la importación</p>
                <p className="text-[11px] text-red-300/80 mt-1 leading-normal">{result.error}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
