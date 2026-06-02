import React, { useState } from 'react';
import { EmailLog } from '../types';
import { Calendar, Mail, CheckCircle2, XCircle, Search, Clock, RefreshCw } from 'lucide-react';

interface EmailLogsListProps {
  logs: EmailLog[];
  onRefresh: () => void;
  primaryColor: string;
}

export default function EmailLogsList({ logs, onRefresh, primaryColor }: EmailLogsListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log => {
    return (
      log.clientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getLogTypeLabel = (type: string) => {
    switch (type) {
      case '15_days_before':
        return { label: 'Alerta 15 días', style: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'due_date':
        return { label: 'Vencimiento hoy', style: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
      case 'past_due_8_days':
        return { label: 'Retraso recurrente 8d', style: 'text-red-400 bg-red-400/10 border-red-400/20' };
      case 'manual':
        return { label: 'Disparo manual', style: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      default:
        return { label: 'Aviso', style: 'text-zinc-400 bg-neutral-800 border-neutral-700' };
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-[#0b0b0e] border border-white/5 rounded-2xl overflow-hidden shadow-xl" id="email-logs-panel">
      
      {/* Panel header controls */}
      <div className="p-5 bg-[#0e0e11]/90 border-b border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: primaryColor }} />
            Bitácora de Envío de Correos
          </h3>
          <p className="text-zinc-500 text-[11px] mt-1 leading-relaxed">Historial en tiempo real de recordatorios despachados por tu VPS.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search logs */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-zinc-550" />
            <input
              type="text"
              placeholder="Buscar por dominio o correo"
              className="bg-zinc-950 border border-white/5 text-zinc-200 text-xs rounded-xl pl-9 pr-3.5 py-2.5 w-full focus:outline-none focus:ring-1 font-medium transition duration-200"
              style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Sync logs manual */}
          <button
            onClick={onRefresh}
            className="p-2.5 bg-white/5 border border-white/5 hover:bg-white/10 hover:text-white text-zinc-400 rounded-xl transition duration-200 cursor-pointer"
            type="button"
            title="Sincronizar historial"
            id="btn-refresh-logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List content */}
      <div className="overflow-x-auto">
        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-zinc-500 text-xs font-semibold">
            No se han registrado correos enviados todavía.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0b0b0e]/80 uppercase tracking-widest text-[9px] text-zinc-500 border-b border-white/5">
                <th className="px-6 py-4 font-bold">Fecha y Hora</th>
                <th className="px-6 py-4 font-bold">Cliente y Correo</th>
                <th className="px-6 py-4 font-bold">Sitio / Dominio</th>
                <th className="px-6 py-4 font-bold">Tipo alerta</th>
                <th className="px-6 py-4 font-bold text-right">Resultado SMTP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/2">
              {filteredLogs.map(log => {
                const badge = getLogTypeLabel(log.type);
                return (
                  <tr key={log.id} className="hover:bg-white/1 transition duration-150">
                    <td className="px-6 py-4.5 text-zinc-400 whitespace-nowrap font-medium">
                      {formatTimestamp(log.sentAt)}
                    </td>
                    <td className="px-6 py-4.5">
                      <span className="text-zinc-200 block font-semibold">{log.clientEmail}</span>
                      <span className="text-zinc-500 block text-[9px] font-mono mt-0.5">{log.clientId}</span>
                    </td>
                    <td className="px-6 py-4.5 text-zinc-350 font-mono font-medium">
                      {log.domain}
                    </td>
                    <td className="px-6 py-4.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${badge.style}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {log.status === 'success' ? (
                          <>
                            <span className="text-emerald-400 font-bold text-[11px]">Enviado</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </>
                        ) : (
                          <div className="group relative cursor-pointer">
                            <div className="flex items-center gap-1.5 ml-auto">
                              <span className="text-red-400 font-bold text-[11px] hover:underline">Fallo</span>
                              <XCircle className="w-4 h-4 text-red-400" />
                            </div>
                            {log.error && (
                              <div className="hidden group-hover:block absolute right-0 bottom-full mb-1.5 bg-[#0f0e13] border border-red-500/20 text-red-300 text-[10px] max-w-xs p-3 rounded-xl shadow-xl z-20 whitespace-normal leading-normal animate-fade-in font-medium">
                                {log.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
