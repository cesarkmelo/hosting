import React, { useState, useEffect } from 'react';
import { Client, isColorDark } from '../types';
import { X, Save, Users, AlertCircle, Sparkles } from 'lucide-react';

interface ClientFormProps {
  client?: Client; // If passed, we are editing
  onSave: (clientData: Partial<Client>) => void;
  onClose: () => void;
  primaryColor: string;
  templates?: {
    genericSubject: string;
    genericBody: string;
    expiredSubject: string;
    expiredBody: string;
  };
}

export default function ClientForm({ client, onSave, onClose, primaryColor, templates }: ClientFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [domain, setDomain] = useState('');
  const [cost, setCost] = useState(100);
  const [currency, setCurrency] = useState('COP');
  const [expiryDate, setExpiryDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('pending');
  const [useCustomTemplate, setUseCustomTemplate] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [notes, setNotes] = useState('');
  const [isPreferential, setIsPreferential] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [error, setError] = useState('');

  // Hydrate form on edit
  useEffect(() => {
    if (client) {
      setName(client.name || '');
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setDomain(client.domain || '');
      setCost(client.cost || 0);
      setCurrency(client.currency || 'COP');
      setExpiryDate(client.expiryDate || '');
      setPaymentStatus(client.paymentStatus || 'pending');
      setUseCustomTemplate(client.useCustomTemplate || false);
      setCustomSubject(client.customSubject || '');
      setCustomBody(client.customBody || '');
      setNotes(client.notes || '');
      setIsPreferential(client.isPreferential || false);
      setDiscountPercentage(client.discountPercentage || 0);
    } else {
      // Defaults for new client
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 30);
      setExpiryDate(tomorrow.toISOString().split('T')[0]);
      setIsPreferential(false);
      setDiscountPercentage(0);
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('El nombre del cliente es obligatorio.');
      return;
    }
    const emailList = email.split(',').map(e => e.trim()).filter(Boolean);
    const allEmailsValid = emailList.length > 0 && emailList.every(e => e.includes('@'));
    if (!allEmailsValid) {
      setError('Por favor, ingresa correos electrónicos válidos (puedes separar varios con comas).');
      return;
    }
    if (!domain.trim()) {
      setError('El dominio es requerido para la vigencia del hosting.');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      setError('El costo del hosting debe ser un número positivo.');
      return;
    }
    if (!expiryDate) {
      setError('La fecha de vencimiento es obligatoria.');
      return;
    }

    onSave({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      domain: domain.trim().toLowerCase().replace(/^https?:\/\//, ''),
      cost: Number(cost),
      currency,
      expiryDate,
      paymentStatus,
      useCustomTemplate,
      customSubject: useCustomTemplate ? customSubject.trim() : undefined,
      customBody: useCustomTemplate ? customBody.trim() : undefined,
      notes: notes.trim(),
      isPreferential,
      discountPercentage: Number(discountPercentage) || 0
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-md overflow-y-auto" id="client-form-modal">
      <div className="bg-[#0b0b0e] border border-white/5 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8 animate-fade-in">
        
        {/* Header */}
        <div className="border-b border-white/5 px-6 py-4.5 flex items-center justify-between bg-[#0e0e11]">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-zinc-400 font-bold" style={{ color: primaryColor }} />
            <h3 className="text-base font-bold text-white tracking-tight">
              {client ? 'Editar Cliente / Servicio' : 'Nuevo Cliente de Hosting'}
            </h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition" type="button" id="btn-close-modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto scrollbar-thin" id="client-form-element">
          
          {error && (
            <div className="p-3.5 bg-red-500/10 text-red-300 border border-red-500/10 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Cliente Name */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="client-name">Nombre del Cliente *</label>
              <input
                id="client-name"
                type="text"
                className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-medium transition-all duration-200"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nombre completo o Razón Social"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="client-email">Correo Electrónico *</label>
              <input
                id="client-email"
                type="text"
                className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-medium transition-all duration-200"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo1@test.com, correo2@test.com"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="client-phone">Teléfono (Opcional)</label>
              <input
                id="client-phone"
                type="text"
                className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-medium transition-all duration-200"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Ej: +56 9 1234 5678"
              />
            </div>

            {/* Dominio */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="client-domain">Dominio Asociado *</label>
              <input
                id="client-domain"
                type="text"
                className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-mono transition-all duration-200"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="ejemplo.com"
              />
            </div>

            {/* Costo Hosting */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="client-cost">Costo del Hosting *</label>
              <div className="flex gap-2">
                <input
                  id="client-cost"
                  type="number"
                  step="0.01"
                  className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-mono transition-all duration-200"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={cost}
                  onChange={e => setCost(parseFloat(e.target.value))}
                  placeholder="120"
                />
                <select
                  className="bg-zinc-950/70 text-zinc-200 px-3 py-2 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-xs font-semibold"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CLP">CLP</option>
                  <option value="COP">COP</option>
                  <option value="MXN">MXN</option>
                  <option value="ARS">ARS</option>
                  <option value="BOB">BOB</option>
                </select>
              </div>
            </div>

            {/* Fecha Vencimiento */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="client-expiry">Fecha de Vencimiento *</label>
              <input
                id="client-expiry"
                type="date"
                className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-mono transition-all duration-200"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
              />
            </div>
          </div>

          {/* Preferencial y Descuento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-[#08080a] p-4 rounded-xl border border-white/3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Beneficios Especiales</label>
              <label className="flex items-center gap-2.5 text-xs text-zinc-350 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={isPreferential}
                  onChange={e => setIsPreferential(e.target.checked)}
                  className="rounded border-white/5 bg-zinc-950 text-[var(--primary-color)] w-4 h-4 focus:ring-offset-black cursor-pointer"
                />
                <span className="font-semibold flex items-center gap-1.5 cursor-pointer">
                  <span className="text-amber-400 font-bold text-sm">★</span> Cliente Preferencial
                </span>
              </label>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="client-discount">Descuento Especial (%)</label>
              <input
                id="client-discount"
                type="number"
                min="0"
                max="100"
                className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-semibold transition-all duration-200"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                value={discountPercentage || ''}
                onChange={e => setDiscountPercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                placeholder="Porcentaje de descuento, Ej: 10"
              />
            </div>
          </div>

          {/* Estado Inicial de Pago */}
          <div className="bg-[#08080a] p-4 rounded-xl border border-white/3">
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Estado del Pago</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="radio"
                  name="paymentStatus"
                  value="pending"
                  checked={paymentStatus === 'pending'}
                  onChange={() => setPaymentStatus('pending')}
                  className="w-4 h-4 rounded-full border-white/5 text-[var(--primary-color)] focus:ring-[var(--primary-color)] focus:ring-offset-black bg-zinc-950"
                />
                <span className="font-medium">Pendiente de pago (Envía recordatorios automáticos)</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="radio"
                  name="paymentStatus"
                  value="paid"
                  checked={paymentStatus === 'paid'}
                  onChange={() => setPaymentStatus('paid')}
                  className="w-4 h-4 rounded-full border-white/5 text-[var(--primary-color)] focus:ring-[var(--primary-color)] focus:ring-offset-black bg-zinc-950"
                />
                <span className="font-medium">Al día / Pagado (Pausa recordatorios)</span>
              </label>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="client-notes">Notas del Servicio (Opcional)</label>
            <textarea
              id="client-notes"
              className="w-full h-18 bg-zinc-950/70 text-zinc-300 p-3.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm"
              style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Detalles sobre hosting, contraseñas, accesos ssh o convenios especiales"
            />
          </div>

          {/* MENSAJES PERSONALIZADOS PARA CLIENTES ESPECIALES */}
          <div className="border-t border-white/5 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={useCustomTemplate}
                onChange={e => {
                  const checked = e.target.checked;
                  setUseCustomTemplate(checked);
                  if (checked) {
                    if (!customSubject.trim()) {
                      setCustomSubject(templates?.genericSubject || '⚠️ Recordatorio: Vencimiento de Hosting - {domain}');
                    }
                    if (!customBody.trim()) {
                      setCustomBody(templates?.genericBody || 'Hola {name},\n\nTe escribimos para recordarte que el hosting de tu sitio web {domain} vencerá pronto.\n\nDetalles del servicio:\n- Dominio: {domain}\n- Fecha de Vencimiento: {expiry_date}\n- Monto de Renovación: {cost}\n\nPor favor, realiza el pago antes de la fecha límite para evitar interrupciones de acceso.\n\nAtentamente,\n{company_name}');
                    }
                  }
                }}
                className="rounded border-white/5 bg-zinc-950 text-[var(--primary-color)] w-4 h-4 focus:ring-offset-black"
              />
              <span className="text-zinc-200 text-sm font-semibold flex items-center gap-1.5 cursor-pointer">
                <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-110 transition duration-300" />
                Personalizar correos para este cliente (Mensaje Especial)
              </span>
            </label>
            <p className="text-zinc-500 text-xs mt-1 ml-6.5 leading-relaxed">
              Actívalo para anular las plantillas generas y usar un asunto/cuerpo redactado a medida para este cliente.
            </p>

            {useCustomTemplate && (
              <div className="mt-4 ml-6.5 space-y-3.5 bg-zinc-950/50 p-4.5 rounded-xl border border-white/5">
                <div>
                  <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2" htmlFor="custom-subject">Asunto Especial</label>
                  <input
                    id="custom-subject"
                    type="text"
                    className="w-full bg-[#0c0c0f] text-zinc-200 px-3.5 py-2 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-xs font-semibold"
                    style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                    value={customSubject}
                    onChange={e => setCustomSubject(e.target.value)}
                    placeholder="Ej: Estimado Carlos, recordatorio especial de {domain}"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2" htmlFor="custom-body">Mensaje / Cuerpo Especial</label>
                  <textarea
                    id="custom-body"
                    className="w-full h-32 bg-[#0c0c0f] text-zinc-300 p-3 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-xs font-mono leading-relaxed"
                    style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                    value={customBody}
                    onChange={e => setCustomBody(e.target.value)}
                    placeholder={`Hola {name}, te escribimos para...`}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2.5 text-[10px] text-zinc-500">
                    <span className="font-medium">Etiquetas disponibles:</span>
                    <span className="bg-white/5 px-1.5 py-0.5 rounded text-zinc-400 font-mono">{`{name}`}</span>
                    <span className="bg-white/5 px-1.5 py-0.5 rounded text-zinc-400 font-mono">{`{domain}`}</span>
                    <span className="bg-white/5 px-1.5 py-0.5 rounded text-zinc-400 font-mono">{`{cost}`}</span>
                    <span className="bg-white/5 px-1.5 py-0.5 rounded text-zinc-400 font-mono">{`{expiry_date}`}</span>
                    <span className="bg-white/5 px-1.5 py-0.5 rounded text-zinc-400 font-mono">{`{company_name}`}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="border-t border-white/5 pt-4.5 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4.5 py-2 bg-white/5 hover:bg-white/10 hover:text-white text-zinc-350 border border-white/5 rounded-xl text-xs font-semibold transition duration-200"
              type="button"
              id="btn-cancel-client"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-5 py-2 rounded-xl font-bold text-xs transition duration-200 flex items-center gap-2 shadow-[0_0_15px_-3px_var(--primary-color)] hover:brightness-110 active:scale-95 cursor-pointer ${
                isColorDark(primaryColor) ? 'text-white' : 'text-zinc-950'
              }`}
              style={{ backgroundColor: primaryColor }}
              id="btn-save-client"
            >
              <Save className={`w-4 h-4 ${isColorDark(primaryColor) ? 'text-white' : 'text-zinc-950'}`} />
              Guardar Cliente
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
