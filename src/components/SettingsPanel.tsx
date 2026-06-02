import React, { useState, useEffect } from 'react';
import { SMTPSettings, CompanySettings, TemplatesSettings, isColorDark } from '../types';
import { Mail, Check, AlertCircle, Layout, HelpCircle, Palette, Activity, Landmark } from 'lucide-react';

interface SettingsPanelProps {
  smtp: SMTPSettings;
  company: CompanySettings;
  templates: TemplatesSettings;
  onSave: (settingsData: { smtp?: SMTPSettings; company?: CompanySettings; templates?: TemplatesSettings }) => Promise<void>;
  primaryColor: string;
}

const PRESET_COLORS = [
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Océano', value: '#3b82f6' },
  { name: 'Oro Negro', value: '#fbbf24' },
  { name: 'Orquídea', value: '#a78bfa' },
  { name: 'Carmesí', value: '#f87171' },
  { name: 'Platino', value: '#a3a3a3' }
];

export default function SettingsPanel({ smtp, company, templates, onSave, primaryColor }: SettingsPanelProps) {
  // SMTP states
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpFromName, setSmtpFromName] = useState('');

  // Company states
  const [companyName, setCompanyName] = useState('');
  const [logoText, setLogoText] = useState('');
  const [customPrimaryColor, setCustomPrimaryColor] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Templates states
  const [genericSubject, setGenericSubject] = useState('');
  const [genericBody, setGenericBody] = useState('');
  const [expiredSubject, setExpiredSubject] = useState('');
  const [expiredBody, setExpiredBody] = useState('');

  // UX states
  const [tab, setTab] = useState<'smtp' | 'company' | 'templates'>('smtp');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // SMTP Test State
  const [testEmail, setTestEmail] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg?: string } | null>(null);

  // Hydrate on mount/prop change
  useEffect(() => {
    if (smtp) {
      setSmtpHost(smtp.host || '');
      setSmtpPort(smtp.port || 587);
      setSmtpUser(smtp.user || '');
      setSmtpPass(smtp.pass || '');
      setSmtpSecure(smtp.secure || false);
      setSmtpFromName(smtp.fromName || '');
    }
    if (company) {
      setCompanyName(company.name || '');
      setLogoText(company.logoText || '');
      setCustomPrimaryColor(company.primaryColor || '#10b981');
      setLogoUrl(company.logoUrl || '');
    }
    if (templates) {
      setGenericSubject(templates.genericSubject || '');
      setGenericBody(templates.genericBody || '');
      setExpiredSubject(templates.expiredSubject || '');
      setExpiredBody(templates.expiredBody || '');
    }
  }, [smtp, company, templates]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const payload = {
        smtp: {
          host: smtpHost.trim(),
          port: Number(smtpPort),
          user: smtpUser.trim(),
          pass: smtpPass,
          secure: smtpSecure,
          fromName: smtpFromName.trim()
        },
        company: {
          name: companyName.trim() || 'Hosting Corp',
          logoText: logoText.trim() || 'H-CORE',
          primaryColor: customPrimaryColor,
          logoUrl: logoUrl.trim()
        },
        templates: {
          genericSubject: genericSubject.trim(),
          genericBody: genericBody.trim(),
          expiredSubject: expiredSubject.trim(),
          expiredBody: expiredBody.trim()
        }
      };

      await onSave(payload);
      setSuccessMsg('¡Ajustes actualizados de forma segura en tu servidor!');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error guardando configuraciones');
    } finally {
      setLoading(false);
    }
  };

  const executeSmtpTest = async () => {
    if (!testEmail.trim() || !testEmail.includes('@')) {
      alert('Ingresa una dirección de correo válida para el test.');
      return;
    }
    setTestLoading(true);
    setTestResult(null);

    try {
      const currentSmtp = {
        host: smtpHost.trim(),
        port: Number(smtpPort),
        user: smtpUser.trim(),
        pass: smtpPass,
        secure: smtpSecure,
        fromName: smtpFromName.trim()
      };

      const token = localStorage.getItem('hosting_corp_id_token') || '';
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ smtp: currentSmtp, testEmail: testEmail.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, msg: '¡Correo de prueba enviado! Revisa tu bandeja de entrada o spam.' });
      } else {
        setTestResult({ success: false, msg: data.error || 'Fallo desconocido de autenticación SMTP' });
      }
    } catch (err: any) {
      setTestResult({ success: false, msg: err.message || 'Error de conexión con el VPS' });
    } finally {
      setTestLoading(false);
    }
  };

    return (
    <div className="bg-[#0b0b0e] border border-white/5 rounded-2xl overflow-hidden shadow-xl" id="settings-panel-container">
      {/* Settings Navigation Tabs */}
      <div className="bg-[#0e0e11]/90 border-b border-white/5 flex overflow-x-auto scrollbar-none">
        <button
          onClick={() => setTab('smtp')}
          className="flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition duration-200 cursor-pointer flex-shrink-0"
          style={tab === 'smtp' ? { color: primaryColor, borderBottomColor: primaryColor } : { color: '#a1a1aa', borderBottomColor: 'transparent' }}
          type="button"
          id="tab-btn-smtp"
        >
          <Mail className="w-4 h-4" />
          Servidor de Correo (SMTP)
        </button>
        <button
          onClick={() => setTab('templates')}
          className="flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition duration-200 cursor-pointer flex-shrink-0"
          style={tab === 'templates' ? { color: primaryColor, borderBottomColor: primaryColor } : { color: '#a1a1aa', borderBottomColor: 'transparent' }}
          type="button"
          id="tab-btn-templates"
        >
          <Layout className="w-4 h-4" />
          Plantillas de Correo
        </button>
        <button
          onClick={() => setTab('company')}
          className="flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition duration-200 cursor-pointer flex-shrink-0"
          style={tab === 'company' ? { color: primaryColor, borderBottomColor: primaryColor } : { color: '#a1a1aa', borderBottomColor: 'transparent' }}
          type="button"
          id="tab-btn-company"
        >
          <Palette className="w-4 h-4" />
          Identidad Corporativa
        </button>
      </div>

      <form onSubmit={handleSaveAll} className="p-6 space-y-6" id="settings-form">
        
        {/* Alerts messages */}
        {successMsg && (
          <div className="p-4 bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 rounded-xl flex items-center gap-2.5 text-xs font-semibold" id="settings-success-alert">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-red-500/10 text-red-300 border border-red-500/15 rounded-xl flex items-center gap-2.5 text-xs font-semibold" id="settings-error-alert">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab content 1: SMTP Settings */}
        {tab === 'smtp' && (
          <div className="space-y-5 animate-fade-in" id="settings-smtp-section">
            <div>
              <h4 className="text-zinc-100 font-bold text-sm tracking-tight mb-1">Configuración SMTP del Servidor</h4>
              <p className="text-zinc-500 text-xs">Indica los datos de correo corporativos de tu hosting o VPS para disparar las notificaciones.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="smtp-host">Host / Servidor SMTP *</label>
                <input
                  id="smtp-host"
                  type="text"
                  className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-medium transition-all duration-200"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={smtpHost}
                  onChange={e => setSmtpHost(e.target.value)}
                  placeholder="mail.minegocio.com"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="smtp-port">Port / Puerto SMTP *</label>
                <input
                  id="smtp-port"
                  type="number"
                  className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-medium transition-all duration-200"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={smtpPort}
                  onChange={e => setSmtpPort(Number(e.target.value))}
                  placeholder="587"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="smtp-user">Usuario / Cuenta de Correo (SMTP User) *</label>
                <input
                  id="smtp-user"
                  type="email"
                  className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-medium transition-all duration-200"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={smtpUser}
                  onChange={e => setSmtpUser(e.target.value)}
                  placeholder="remitente@minegocio.com"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="smtp-pass">Contraseña del Correo *</label>
                <input
                  id="smtp-pass"
                  type="password"
                  className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-medium transition-all duration-200"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={smtpPass}
                  onChange={e => setSmtpPass(e.target.value)}
                  placeholder="•••••••••••••"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="smtp-from-name">Nombre de Remitente (FromName)</label>
                <input
                  id="smtp-from-name"
                  type="text"
                  className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-medium transition-all duration-200"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={smtpFromName}
                  onChange={e => setSmtpFromName(e.target.value)}
                  placeholder="Ej: Renovación de Servicios"
                />
              </div>

              <div className="flex items-center pt-3 md:pt-7">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={e => setSmtpSecure(e.target.checked)}
                    className="rounded border-white/5 bg-zinc-950 text-[var(--primary-color)] w-4 h-4 focus:ring-offset-black"
                  />
                  <span className="text-zinc-300 text-xs font-semibold">Usar conexión cifrada (SSL/TLS — Puerto 465)</span>
                </label>
              </div>
            </div>

            {/* Test Email utility helper */}
            <div className="bg-zinc-950/50 p-5 rounded-2xl border border-white/5 mt-6">
              <h5 className="text-white text-xs font-bold mb-1 uppercase tracking-wider">🛠️ Probar tu conexión de Correo</h5>
              <p className="text-zinc-500 text-[11px] mb-3.5 leading-relaxed">Envía un correo de comprobación de forma instantánea al buzón de tu elección.</p>
              
              <div className="flex gap-2 max-w-md">
                <input
                  type="email"
                  className="bg-zinc-950 border border-white/5 text-zinc-200 text-xs rounded-xl px-3.5 py-2.5 w-full focus:outline-none font-medium"
                  placeholder="test@dominio.com"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                />
                <button
                  type="button"
                  onClick={executeSmtpTest}
                  disabled={testLoading || !testEmail}
                  className="bg-white/5 hover:bg-white/10 text-white text-xs font-bold px-4 py-2 rounded-xl border border-white/5 transition duration-200 flex-shrink-0 cursor-pointer disabled:opacity-50"
                  id="btn-smtp-test"
                >
                  {testLoading ? 'Enviando...' : 'Probar Correo'}
                </button>
              </div>

              {testResult && (
                <div className={`mt-2.5 text-xs font-bold ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`} id="smtp-test-result">
                  {testResult.msg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab content 2: Templates Settings */}
        {tab === 'templates' && (
          <div className="space-y-6 animate-fade-in text-sm" id="settings-templates-section">
            <div>
              <h4 className="text-zinc-100 font-bold text-sm tracking-tight mb-1">Avisos y Recordatorios Genéricos</h4>
              <p className="text-zinc-500 text-xs">Define las frases predeterminadas que recibirán los clientes normales que no tienen plantillas especiales.</p>
            </div>

            {/* Template Class 1 (Notice - Generic warns) */}
            <div className="space-y-3 bg-[#060608]/90 p-5 rounded-2xl border border-white/5">
              <h5 className="font-bold text-emerald-400 text-xs uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                Recordatorio Genérico (15 días antes)
              </h5>
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="generic-subject">Asunto del correo</label>
                <input
                  id="generic-subject"
                  type="text"
                  className="w-full bg-zinc-950/75 text-zinc-200 px-3.5 py-2 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-xs font-semibold"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={genericSubject}
                  onChange={e => setGenericSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="generic-body">Cuerpo / Mensaje</label>
                <textarea
                  id="generic-body"
                  className="w-full h-36 bg-zinc-950/75 text-zinc-350 p-3.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-xs font-mono leading-relaxed"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={genericBody}
                  onChange={e => setGenericBody(e.target.value)}
                />
              </div>
            </div>

            {/* Template Class 2 (Alert - Expired warning) */}
            <div className="space-y-3 bg-[#060608]/90 p-5 rounded-2xl border border-white/5">
              <h5 className="font-bold text-red-400 text-xs uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse-subtle"></span>
                Aviso de Hosting Vencido (Vencimiento + Cada 8 días extra)
              </h5>
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="expired-subject">Asunto del correo</label>
                <input
                  id="expired-subject"
                  type="text"
                  className="w-full bg-zinc-950/75 text-zinc-200 px-3.5 py-2 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-xs font-semibold"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={expiredSubject}
                  onChange={e => setExpiredSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="expired-body">Cuerpo / Mensaje</label>
                <textarea
                  id="expired-body"
                  className="w-full h-36 bg-zinc-950/75 text-zinc-350 p-3.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-xs font-mono leading-relaxed"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={expiredBody}
                  onChange={e => setExpiredBody(e.target.value)}
                />
              </div>
            </div>

            {/* Interactive placeholders documentation */}
            <div className="bg-zinc-950/50 p-5 rounded-2xl border border-white/5 text-xs leading-relaxed">
              <span className="text-zinc-200 font-bold flex items-center gap-1.5 mb-1.5">
                <HelpCircle className="w-4 h-4 text-zinc-400" />
                ¿Cómo usar etiquetas inteligentes autocompletables?
              </span>
              <p className="text-zinc-500 mb-3.5">Utiliza en tu texto cualquiera de las siguientes claves para auto-rellenar los datos reales de cada servicio:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-[11px] text-zinc-400">
                <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-white/3"><span className="text-amber-400 font-bold">{`{name}`}</span> / <span className="text-amber-400 font-bold">{`{nombre}`}</span> <span className="text-zinc-500 block text-[10px] mt-0.5">Nombre completo</span></div>
                <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-white/3"><span className="text-amber-400 font-bold">{`{domain}`}</span> / <span className="text-amber-400 font-bold">{`{dominio}`}</span> <span className="text-zinc-500 block text-[10px] mt-0.5">Web o Hosting</span></div>
                <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-white/3"><span className="text-amber-400 font-bold">{`{cost}`}</span> / <span className="text-amber-400 font-bold">{`{costo}`}</span> <span className="text-zinc-500 block text-[10px] mt-0.5">Costo renovación</span></div>
                <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-white/3"><span className="text-amber-400 font-bold">{`{expiry_date}`}</span> / <span className="text-amber-400 font-bold">{`{vencimiento}`}</span> <span className="text-zinc-500 block text-[10px] mt-0.5">Fecha límite</span></div>
                <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-white/3"><span className="text-amber-400 font-bold">{`{company_name}`}</span> / <span className="text-amber-400 font-bold">{`{empresa}`}</span> <span className="text-zinc-500 block text-[10px] mt-0.5">Tu marca comercial</span></div>
                <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-white/3"><span className="text-amber-400 font-bold">{`{days_expired}`}</span> / <span className="text-amber-400 font-bold">{`{diasVencidos}`}</span> <span className="text-zinc-500 block text-[10px] mt-0.5">Días de retraso</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Tab content 3: Corporate Identity Personalized */}
        {tab === 'company' && (
          <div className="space-y-5 animate-fade-in" id="settings-branding-section">
            <div>
              <h4 className="text-zinc-100 font-bold text-sm tracking-tight mb-1">Identidad de Marca Especial</h4>
              <p className="text-zinc-500 text-xs">Aplica tu propio logo corporativo, nombre comercial y colores de acento para la interfaz principal y remitentes.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="company-name">Nombre de la Empresa *</label>
                <input
                  id="company-name"
                  type="text"
                  className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-medium transition-all duration-200"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Ej: Meloweb hosting"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="logo-text">Texto Corto de Logo *</label>
                <input
                  id="logo-text"
                  type="text"
                  className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-medium transition-all duration-200"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  value={logoText}
                  onChange={e => setLogoText(e.target.value)}
                  placeholder="Ej: M-WEB"
                  maxLength={10}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2" htmlFor="logo-url">URL de Imagen de Logo (Opcional)</label>
              <input
                id="logo-url"
                type="text"
                className="w-full bg-zinc-950/70 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-white/5 focus:outline-none focus:ring-1 text-sm font-medium transition-all duration-200"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="https://ejemplo.com/logo.png"
              />
              <p className="text-zinc-500 text-[10px] mt-1.5 leading-relaxed">Si se especifica, se cargará esta imagen corporativa en la cabecera en lugar del logotipo de texto.</p>
            </div>

            {/* Colors picker interface */}
            <div className="space-y-3.5 pt-1.5">
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Color Corporativo de la Plataforma (Accent Color)</label>
              <div className="flex flex-wrap gap-2.5">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setCustomPrimaryColor(color.value)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition duration-200 shadow hover:brightness-115 active:scale-95"
                    style={{
                      backgroundColor: customPrimaryColor === color.value ? `${color.value}15` : 'transparent',
                      borderColor: customPrimaryColor === color.value ? color.value : 'rgba(255,255,255,0.05)',
                      color: customPrimaryColor === color.value ? '#ffffff' : '#8a8a93'
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color.value }} />
                    {color.name}
                  </button>
                ))}
              </div>

              {/* Hex Input */}
              <div className="flex items-center gap-3 max-w-xs bg-zinc-950/80 px-3 py-2 rounded-xl border border-white/5 mt-4">
                <input
                  type="color"
                  value={customPrimaryColor}
                  onChange={e => setCustomPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                />
                <div className="flex-1 text-xs">
                  <span className="text-zinc-550 block text-[9px] uppercase font-bold tracking-wider">Hex Color</span>
                  <input
                    type="text"
                    value={customPrimaryColor}
                    onChange={e => setCustomPrimaryColor(e.target.value)}
                    className="bg-transparent text-white w-full uppercase focus:outline-none text-xs font-mono mt-0.5 font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer controls submit */}
        <div className="border-t border-white/5 pt-5 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs transition duration-250 shadow-md hover:brightness-110 active:scale-95 cursor-pointer disabled:opacity-40 ${
              isColorDark(primaryColor) ? 'text-white' : 'text-zinc-950'
            }`}
            style={{ backgroundColor: primaryColor }}
            id="btn-settings-submit"
          >
            {loading ? 'Guardando Ajustes...' : 'Salvar Todos los Ajustes'}
          </button>
        </div>

      </form>
    </div>
  );
}
