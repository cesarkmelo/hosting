import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit3, Trash2, CheckCircle2, AlertTriangle, 
  DollarSign, Globe, Calendar, RefreshCw, Layers, ShieldCheck, Mail, Users, HardDrive, MessageSquare,
  Menu, X
} from 'lucide-react';
import { Client, DatabaseState, EmailLog, SMTPSettings, CompanySettings, TemplatesSettings, isColorDark, LoggedInUser, ALLOWED_EMAILS } from './types';
import ClientForm from './components/ClientForm';
import GoogleDocsImport from './components/GoogleDocsImport';
import SettingsPanel from './components/SettingsPanel';
import EmailLogsList from './components/EmailLogsList';

export default function App() {
  // Full state loaded from API
  const [data, setData] = useState<DatabaseState>({
    clients: [],
    smtp: { host: '', port: 587, user: '', pass: '', secure: false, fromName: '' },
    company: { name: 'AlfamediaWEB Hosting Manager', logoText: 'AMW-HOST', primaryColor: '#10b981' },
    templates: { genericSubject: '', genericBody: '', expiredSubject: '', expiredBody: '' },
    logs: []
  });

  // User Authentication States
  const [user, setUser] = useState<LoggedInUser | null>(() => {
    const saved = localStorage.getItem('hosting_corp_user');
    const token = localStorage.getItem('hosting_corp_id_token');
    if (saved && token) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // UX controller states
  const [activeTab, setActiveTab] = useState<'clients' | 'import' | 'settings' | 'logs'>('clients');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'expired'>('all');
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);
  const [showClientForm, setShowClientForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Expiration running states
  const [runningExpiryCheck, setRunningExpiryCheck] = useState(false);

  // Helper fetch with Authorization token to secure communications with the backend
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('hosting_corp_id_token') || '';
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    return fetch(url, { ...options, headers });
  };

  // Fetch all state data
  const fetchData = async () => {
    // If there is no token yet, don't execute background fetch to avoid unnecessary 401s before initial login is complete
    const token = localStorage.getItem('hosting_corp_id_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetchWithAuth('/api/data');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else if (res.status === 401 || res.status === 403) {
        // Automatically logout if session expired or disallowed on backend
        handleLogout();
      }
    } catch (err) {
      console.error('Error fetching data from server:', err);
      showToast('error', 'No se pudo conectar con el servidor backend del VPS.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('hosting_corp_id_token');
    const savedUser = localStorage.getItem('hosting_corp_user');
    if (savedUser && !token) {
      // Clear stale session on security upgrade to force fresh secure login
      localStorage.removeItem('hosting_corp_user');
      localStorage.removeItem('hosting_corp_id_token');
      setUser(null);
      setLoading(false);
    } else {
      fetchData();
    }
  }, []);

  useEffect(() => {
    if (user && ALLOWED_EMAILS.includes(user.email)) return;

    // Search for Google library
    const interval = setInterval(() => {
      // @ts-ignore
      if (window.google && window.google.accounts) {
        clearInterval(interval);
        initGoogleSignIn();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [user]);

  const initGoogleSignIn = () => {
    const gId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || '';
    if (!gId) return;

    try {
      // @ts-ignore
      window.google.accounts.id.initialize({
        client_id: gId,
        callback: handleGoogleAuthCallback,
        auto_select: false
      });

      const container = document.getElementById('google-btn-gsi');
      if (container) {
        // @ts-ignore
        window.google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          logo_alignment: 'left',
          width: '280'
        });
      }
    } catch (err) {
      console.error('Error rendering Google GSI button:', err);
    }
  };

  // @ts-ignore
  const handleGoogleAuthCallback = (credentialResponse) => {
    try {
      const decoded = decodeJwt(credentialResponse.credential);
      if (decoded && decoded.email) {
        const loggedUser: LoggedInUser = {
          name: decoded.name || decoded.given_name || 'Personal Alfamedia',
          email: decoded.email.toLowerCase().trim(),
          picture: decoded.picture
        };
        setUser(loggedUser);
        localStorage.setItem('hosting_corp_user', JSON.stringify(loggedUser));
        localStorage.setItem('hosting_corp_id_token', credentialResponse.credential);

        if (ALLOWED_EMAILS.includes(loggedUser.email)) {
          showToast('success', `Sesión iniciada como ${loggedUser.name}`);
          setTimeout(() => {
            fetchData();
          }, 100);
        } else {
          showToast('error', `Acceso denegado: El correo "${loggedUser.email}" no está autorizado.`);
        }
      }
    } catch (err) {
      console.error('Error processing Google credentials:', err);
      showToast('error', 'Error al procesar la autenticación de Google');
    }
  };

  const decodeJwt = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window.atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('hosting_corp_user');
    localStorage.removeItem('hosting_corp_id_token');
    showToast('info', 'Sesión cerrada correctamente.');
  };

  const handleSimulateLogin = (email: string) => {
    const names: Record<string, string> = {
      'cesar@alfamediaweb.com': 'Cesar Melo',
      'heidy@alfamediaweb.com': 'Heidy G.',
      'mariana@alfamediaweb.com': 'Mariana R.'
    };
    const loggedUser: LoggedInUser = {
      name: names[email] || 'Usuario Externo',
      email: email.toLowerCase().trim(),
      picture: undefined
    };
    setUser(loggedUser);
    localStorage.setItem('hosting_corp_user', JSON.stringify(loggedUser));

    if (ALLOWED_EMAILS.includes(loggedUser.email)) {
      showToast('success', `Simulado inicio de sesión como ${loggedUser.name}`);
    } else {
      showToast('error', `Acceso denegado: El correo "${loggedUser.email}" no está autorizado.`);
    }
  };

  // Show status toasts
  const showToast = (type: 'success' | 'info' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Trigger manual cron checking pass
  const handleRunExpiryCheck = async () => {
    setRunningExpiryCheck(true);
    showToast('info', 'Ejecutando comprobación automática de vencimientos en el servidor...');
    try {
      const res = await fetchWithAuth('/api/cron-check', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        await fetchData(); // Reload logs
        if (json.triggeredCount > 0) {
          showToast('success', `¡Comprobación finalizada! Se enviaron ${json.triggeredCount} correos de recordatorio.`);
        } else {
          showToast('info', 'Comprobación finalizada. Ningún cliente cumple hoy el criterio de 15 días o múltiplos de 8d vencidos.');
        }
      } else {
        throw new Error();
      }
    } catch {
      showToast('error', 'Ocurrió un error al ejecutar la comprobación en el servidor.');
    } finally {
      setRunningExpiryCheck(false);
    }
  };

  // Create or Update Client Action
  const handleSaveClient = async (clientData: Partial<Client>) => {
    try {
      const isEdit = !!editingClient;
      // Usar POST para ambos endpoints para evitar bloqueos del WAF (ej. Plesk ModSecurity) con el método PUT
      const url = isEdit ? `/api/clients/${editingClient.id}/update` : '/api/clients';
      const method = 'POST';

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });

      if (res.ok) {
        showToast('success', isEdit ? '¡Cambios del cliente guardados!' : '¡Cliente agregado de forma exitosa!');
        setShowClientForm(false);
        setEditingClient(undefined);
        await fetchData();
      } else {
        const errJson = await res.json();
        showToast('error', errJson.error || 'Error al guardar el cliente');
      }
    } catch {
      showToast('error', 'Error de conexión con el VPS.');
    }
  };

  // Delete Client Action
  const handleDeleteClient = async (id: string, domain: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente al cliente de ${domain}? Esta acción no se puede deshacer y borrará sus registros de hosting.`)) {
      return;
    }

    try {
      // Usar POST para evitar bloqueos del WAF en Plesk con el método DELETE
      const res = await fetchWithAuth(`/api/clients/${id}/delete`, { method: 'POST' });
      if (res.ok) {
        showToast('success', 'Cliente eliminado correctamente de la base de datos.');
        await fetchData();
      } else {
        showToast('error', 'Fallo al eliminar cliente.');
      }
    } catch {
      showToast('error', 'Error al procesar eliminación.');
    }
  };

  // Mark payout / Renew Action
  const handleRegisterPayment = async (id: string, advanceYear: boolean) => {
    try {
      const res = await fetchWithAuth(`/api/clients/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advanceYear })
      });

      if (res.ok) {
        showToast('success', advanceYear ? '¡Pago reportado y fecha de vencimiento pospuesta 1 año!' : '¡Pago marcado como Al Día!');
        await fetchData();
      } else {
        showToast('error', 'Fallo al registrar pago.');
      }
    } catch {
      showToast('error', 'Error de red.');
    }
  };

  // Trigger immediate manual reminder email
  const handleManualEmail = async (id: string, domain: string) => {
    showToast('info', `Enviando recordatorio directo a ${domain}...`);
    try {
      const res = await fetchWithAuth(`/api/clients/${id}/send-manual`, { method: 'POST' });
      if (res.ok) {
        showToast('success', '¡Correo de recordatorio enviado correctamente mediante SMTP!');
        await fetchData();
      } else {
        const data = await res.json();
        showToast('error', `Fallo al enviar: ${data.error || 'Error SMTP'}`);
      }
    } catch {
      showToast('error', 'Error al enviar recordatorio.');
    }
  };

  // Trigger brief WhatsApp reminder message automatically
  const handleWhatsAppReminder = (client: Client) => {
    const finalPrice = client.discountPercentage 
      ? client.cost - (client.cost * client.discountPercentage / 100) 
      : client.cost;
    
    const currencyLabel = client.currency || 'COP';
    const msg = `Hola ${client.name}! Te escribimos de ${data.company.name}. Te recordamos brevemente que la renovación de hosting de tu dominio *${client.domain}* tiene fecha de vencimiento el próximo *${client.expiryDate}*. El valor a reportar es de $${finalPrice.toLocaleString('es-CO')} ${currencyLabel}. Agradecemos tu valioso apoyo de antemano.`;
    
    if (!client.phone || !client.phone.trim()) {
      const customPhone = prompt("Este cliente no tiene un teléfono configurado. Registra un número de WhatsApp (con código de país sin el +, ej: 573001234567):", "57");
      if (customPhone) {
        const cleanCustom = customPhone.replace(/[^0-9]/g, '');
        if (cleanCustom) {
          window.open(`https://wa.me/${cleanCustom}?text=${encodeURIComponent(msg)}`, '_blank');
        }
      } else {
        // Fallback: Copy to clipboard
        navigator.clipboard.writeText(msg);
        showToast('info', '¡Mensaje copiado al portapapeles! Puedes pegarlo manualmente en WhatsApp.');
      }
      return;
    }
    
    const cleanPhone = client.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Save Settings panel Action
  const handleSaveSettings = async (settingsPayload: any) => {
    const res = await fetchWithAuth('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsPayload)
    });

    if (res.ok) {
      await fetchData(); // Reload updated branding settings
    } else {
      throw new Error('Fallo al procesar guardado en el servidor');
    }
  };

  // Math Metrics & Stats Calculations
  const clients = data.clients || [];
  const totalClients = clients.length;
  
  // Expiry check categorizer
  const getExpirationStatus = (expiryDateStr: string, paymentStatus: 'paid' | 'pending') => {
    if (!expiryDateStr) return { status: 'unknown', label: 'Desconocido', colorClass: 'text-zinc-400 bg-neutral-800' };
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const parts = expiryDateStr.split('-');
    const expiry = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    expiry.setHours(0,0,0,0);

    const diffMs = expiry.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // Si le queda más de un mes (30 días) para el vencimiento, automáticamente está al día (verde)
    if (diffDays > 30) {
      return { status: 'paid', label: 'Al día', colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }

    // Si ya está marcado explícitamente como "paid", también está al día (verde)
    if (paymentStatus === 'paid') {
      return { status: 'paid', label: 'Al día', colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }

    if (diffDays < 0) {
      return { status: 'expired', label: `Vencido hace ${Math.abs(diffDays)}d`, colorClass: 'text-red-400 bg-red-500/10 border-red-500/20 font-semibold animate-pulse' };
    } else if (diffDays === 0) {
      return { status: 'expired', label: 'Vence HOY', colorClass: 'text-orange-400 bg-orange-500/20 border-orange-500/30 font-bold' };
    } else if (diffDays <= 15) {
      return { status: 'warning', label: `Próximo: vence en ${diffDays}d`, colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    } else {
      return { status: 'pending', label: `Por vencer: en ${diffDays}d`, colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    }
  };

  const pendingCount = clients.filter(c => getExpirationStatus(c.expiryDate, c.paymentStatus).status !== 'paid').length;
  const paidCount = clients.filter(c => getExpirationStatus(c.expiryDate, c.paymentStatus).status === 'paid').length;
  const expiredCount = clients.filter(c => {
    const s = getExpirationStatus(c.expiryDate, c.paymentStatus);
    return s.status === 'expired';
  }).length;

  const totalAnnualValue = clients.reduce((acc, c) => acc + (c.cost || 0), 0);

  // Search and tabs filters
  const filteredClients = clients.filter(client => {
    const matchesSearch = 
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.domain.toLowerCase().includes(search.toLowerCase()) ||
      client.email.toLowerCase().includes(search.toLowerCase());

    const expDetails = getExpirationStatus(client.expiryDate, client.paymentStatus);

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'paid') return matchesSearch && expDetails.status === 'paid';
    if (statusFilter === 'pending') return matchesSearch && expDetails.status !== 'paid';
    if (statusFilter === 'expired') return matchesSearch && expDetails.status === 'expired';

    return matchesSearch;
  }).sort((a, b) => {
    const dateA = a.expiryDate || '9999-12-31';
    const dateB = b.expiryDate || '9999-12-31';
    return dateA.localeCompare(dateB);
  });

  const pColor = data.company.primaryColor || '#10b981';

  return (
    <div 
      style={{ '--primary-color': pColor } as React.CSSProperties}
      className="min-h-screen bg-[#050506] bg-grid-dots text-zinc-100 font-sans selection:bg-[var(--primary-color)] selection:text-zinc-950 transition-colors duration-500"
    >
      
      {/* Top Corporate bar */}
      <header className="border-b border-white/5 bg-[#0a0a0c]/70 backdrop-blur-xl sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo brand */}
          <div className="flex items-center gap-3">
            {data.company.logoUrl ? (
              <img 
                src={data.company.logoUrl} 
                alt={data.company.name} 
                className="w-10 h-10 rounded-xl object-contain border border-white/10 p-0.5 bg-neutral-900" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div 
                style={{ backgroundColor: `${pColor}12`, borderColor: pColor, boxShadow: `0 0 20px -5px ${pColor}` }}
                className="w-10 h-10 rounded-xl flex items-center justify-center border text-xs font-black tracking-tight"
              >
                <span style={{ color: pColor }}>{data.company.logoText}</span>
              </div>
            )}
            <div>
              <h1 className="text-sm font-semibold text-white tracking-tight leading-none">{data.company.name}</h1>
              <span className="text-[9px] text-zinc-500 block font-mono mt-1 tracking-wider uppercase">Ventas & Renovaciones VPS</span>
            </div>
          </div>

          {/* Navigation links */}
          {user && ALLOWED_EMAILS.includes(user.email) && (
            <nav className="hidden md:flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 font-sans">
              <button
                onClick={() => setActiveTab('clients')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${activeTab === 'clients' ? 'text-white bg-white/10 ring-1 ring-white/10 shadow-lg' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
                id="nav-btn-clients"
              >
                Clientes y Sitios
              </button>
              <button
                onClick={() => setActiveTab('import')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${activeTab === 'import' ? 'text-white bg-white/10 ring-1 ring-white/10 shadow-lg' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
                id="nav-btn-import"
              >
                Importar de Google Docs
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${activeTab === 'settings' ? 'text-white bg-white/10 ring-1 ring-white/10 shadow-lg' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
                id="nav-btn-settings"
              >
                Ajustes de Servidor
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${activeTab === 'logs' ? 'text-white bg-white/10 ring-1 ring-white/10 shadow-lg' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
                id="nav-btn-logs"
              >
                Bitácora SMTP
              </button>
            </nav>
          )}

          {/* User Profile Info and Logout (Desktop) */}
          {user && ALLOWED_EMAILS.includes(user.email) && (
            <div className="hidden md:flex items-center gap-3 border-l border-white/10 pl-4 ml-4">
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-white/20" referrerPolicy="no-referrer" />
              ) : (
                <div 
                  style={{ backgroundColor: `${pColor}20`, borderColor: pColor }}
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white border"
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-white text-xs font-semibold leading-none">{user.name}</span>
                <span className="text-[9px] text-zinc-500 font-mono mt-0.5">{user.email}</span>
               </div>
              <button 
                onClick={handleLogout}
                className="ml-2 px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer"
              >
                Salir
              </button>
            </div>
          )}

          {/* Hamburger Menu on Mobile */}
          {user && ALLOWED_EMAILS.includes(user.email) && (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition duration-200 cursor-pointer"
              id="mobile-hamburger-btn"
            >
              {isMobileMenuOpen ? <X className="w-5.5 h-5.5" /> : <Menu className="w-5.5 h-5.5" />}
            </button>
          )}
        </div>

        {/* Mobile menu dropdown list */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#0a0a0c]/95 backdrop-blur-xl px-4 py-3.5 flex flex-col gap-2 animate-fade-in" id="mobile-nav-panel">
            <button
              onClick={() => {
                setActiveTab('clients');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${activeTab === 'clients' ? 'text-white bg-white/10 ring-1 ring-white/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
            >
              Clientes y Sitios
            </button>
            <button
              onClick={() => {
                setActiveTab('import');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${activeTab === 'import' ? 'text-white bg-white/10 ring-1 ring-white/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
            >
              Importar de Google Docs
            </button>
            <button
              onClick={() => {
                setActiveTab('settings');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${activeTab === 'settings' ? 'text-white bg-white/10 ring-1 ring-white/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
            >
              Ajustes de Servidor
            </button>
            <button
              onClick={() => {
                setActiveTab('logs');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${activeTab === 'logs' ? 'text-white bg-white/10 ring-1 ring-white/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
            >
              Bitácora SMTP
            </button>

            {/* User profile, avatar and exit action for mobile layout */}
            {user && (
              <div className="border-t border-white/5 pt-3.5 mt-1.5 flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5 px-3 py-1">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                  ) : (
                    <div 
                      style={{ backgroundColor: `${pColor}20`, borderColor: pColor }}
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white border"
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-white text-xs font-semibold leading-none truncate">{user.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">{user.email}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-center py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Cerrar Sesión (Salir)
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
        
        {/* Toast Notification message */}
        {toastMessage && (
          <div 
            style={{ 
              borderColor: toastMessage.type === 'error' ? '#ef4444' : pColor,
              boxShadow: `0 10px 40px -10px rgba(0,0,0,0.8), 0 0 15px -3px ${toastMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : pColor + '20'}` 
            }}
            className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border bg-[#0d0d11] text-xs flex items-center gap-3 max-w-sm animate-slide-up font-medium"
            id="system-status-toast"
          >
            <span className={`w-2 h-2 rounded-full ${toastMessage.type === 'error' ? 'bg-red-500 animate-pulse' : 'bg-[var(--primary-color)]'}`} />
            <div className="flex-1 text-zinc-200 font-medium tracking-tight">
              {toastMessage.text}
            </div>
          </div>
        )}

        {/* If Not Logged In, Render Custom Google Authentication Panel */}
        {!user ? (
          <div className="max-w-md mx-auto my-12 glass-panel p-8 rounded-3xl border border-white/5 flex flex-col items-center text-center space-y-6 shadow-2xl relative overflow-hidden" id="auth-panel">
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--primary-color)]/5 via-transparent to-transparent opacity-50 select-none pointer-events-none" />
            
            <div 
              style={{ backgroundColor: `${pColor}12`, borderColor: pColor, boxShadow: `0 0 40px -10px ${pColor}40` }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center border text-zinc-100 mb-2 relative"
            >
              <ShieldCheck className="w-8 h-8" style={{ color: pColor }} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-white font-sans">Acceso Administrativo</h2>
              <p className="text-xs text-zinc-400">Por seguridad, el ingreso está reservado únicamente para cuentas de Google autorizadas de <strong>Alfamedia Web</strong>.</p>
            </div>

            {/* Google Identity Services GSI Button Container */}
            <div className="w-full flex flex-col items-center justify-center py-2 min-h-12" id="google-btn-parent">
              {(import.meta as any).env.VITE_GOOGLE_CLIENT_ID ? (
                <div id="google-btn-gsi" className="transition-all duration-300"></div>
              ) : (
                <div className="text-xs text-zinc-500 font-mono italic bg-zinc-950/40 p-3.5 rounded-xl border border-white/5 w-full">
                  ⚠️ Google Client ID no configurado por el administrador en `.env`.
                </div>
              )}
            </div>

            {/* Whitelisted Emails */}
            <div className="w-full border-t border-white/5 pt-5 text-left space-y-3">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Usuarios Autorizados:</span>
              <div className="grid grid-cols-1 gap-2">
                {ALLOWED_EMAILS.map((email) => (
                  <div key={email} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                    <div className="w-4 h-4 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center border border-[var(--primary-color)]/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-color)]" />
                    </div>
                    <span className="text-xs font-mono text-zinc-350">{email}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : user && !ALLOWED_EMAILS.includes(user.email) ? (
          /* Acceso Denegado Panel */
          <div className="max-w-md mx-auto my-12 glass-panel p-8 rounded-3xl border border-red-500/10 flex flex-col items-center text-center space-y-6 shadow-2xl relative overflow-hidden" id="denied-panel">
            <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-transparent opacity-50 select-none pointer-events-none" />
            
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-white font-sans">Acceso Denegado</h2>
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/10 p-3 rounded-2xl">
                El correo electrónico <strong className="font-mono text-white break-all">{user.email}</strong> no está autorizado.
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              El ingreso a la herramienta de administración de hosting está restringido exclusivamente a las cuentas aprobadas de Alfamedia Web.
            </p>

            <button
              onClick={handleLogout}
              className="w-full text-center py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15 text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer shadow-lg"
            >
              Cerrar Sesión e Iniciar Con Otra Cuenta
            </button>

            <div className="w-full border-t border-white/5 pt-5 text-left space-y-3">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Correos Autorizados:</span>
              <div className="grid grid-cols-1 gap-2 opacity-60">
                {ALLOWED_EMAILS.map((email) => (
                  <div key={email} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                    <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    </div>
                    <span className="text-xs font-mono text-zinc-400">{email}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <>
            {/* Tab content conditional rendering */}
        {activeTab === 'clients' && (
          <div className="space-y-6" id="dashboard-tab-content">
            
            {/* KPI statistics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* Statistic 1 */}
              <div className="glass-panel p-5 rounded-2xl flex items-center justify-between transition-all duration-300 hover:border-white/10 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-[3px] h-full transition-all duration-300 bg-[var(--primary-color)] opacity-60"></div>
                <div>
                  <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest block">Clientes Totales</span>
                  <span className="text-3xl font-bold text-white mt-1.5 block tracking-tight">{totalClients}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-zinc-400 group-hover:text-white transition-all duration-300">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              {/* Statistic 2 */}
              <div className="glass-panel p-5 rounded-2xl flex items-center justify-between transition-all duration-300 hover:border-white/10 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-[3px] h-full bg-red-500 opacity-60"></div>
                <div>
                  <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest block">Vencidos por Pagar</span>
                  <span className={`text-3xl font-bold mt-1.5 block tracking-tight ${expiredCount > 0 ? 'text-red-400 animate-pulse-subtle' : 'text-zinc-400'}`}>{expiredCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-zinc-400 group-hover:text-white transition-all duration-300">
                  <AlertTriangle className={`w-5 h-5 ${expiredCount > 0 ? 'text-red-400' : ''}`} />
                </div>
              </div>

              {/* Statistic 3 */}
              <div className="glass-panel p-5 rounded-2xl flex items-center justify-between transition-all duration-300 hover:border-white/10 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-[3px] h-full bg-emerald-500 opacity-60"></div>
                <div>
                  <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest block">Suscripciones Pagadas</span>
                  <span className="text-3xl font-bold text-emerald-400 mt-1.5 block tracking-tight">{paidCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-zinc-400 group-hover:text-white transition-all duration-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
              </div>

              {/* Statistic 4 */}
              <div className="glass-panel p-5 rounded-2xl flex items-center justify-between transition-all duration-300 hover:border-white/10 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-[3px] h-[full] bg-indigo-500 opacity-60"></div>
                <div>
                  <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest block">Anual Facturado</span>
                  <span className="text-2xl font-bold text-white mt-1.5 block tracking-tight font-mono">
                    ${totalAnnualValue.toLocaleString('es-CO', { minimumFractionDigits: 0 })} <span className="text-zinc-500 text-[10px] font-sans font-normal uppercase">COP</span>
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-zinc-400 group-hover:text-white transition-all duration-300">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>

            </div>

            {/* Controls panel: Add client search block */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 glass-panel p-5 rounded-2xl">
              
              {/* Search bar */}
              <div className="relative w-full lg:w-96 flex items-center">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, dominio o correo..."
                  className="bg-zinc-950/85 border border-white/5 text-sm text-zinc-200 rounded-xl pl-10 pr-4 py-2.5 w-full focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] transition-all duration-200"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Status filter toggle */}
              <div className="flex items-center gap-1.5 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ${statusFilter === 'all' ? 'bg-white/10 text-white border border-white/10 shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'}`}
                >
                  Todos ({totalClients})
                </button>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ${statusFilter === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-500/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'}`}
                >
                  Pendientes ({pendingCount})
                </button>
                <button
                  onClick={() => setStatusFilter('expired')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ${statusFilter === 'expired' ? 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm shadow-red-500/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'}`}
                >
                  Vencidos ({expiredCount})
                </button>
                <button
                  onClick={() => setStatusFilter('paid')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ${statusFilter === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'}`}
                >
                  Al Día ({paidCount})
                </button>
              </div>

              {/* Server Action button triggers */}
              <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
                <button
                  onClick={handleRunExpiryCheck}
                  disabled={runningExpiryCheck}
                  className="bg-zinc-950/80 hover:bg-white/5 border border-white/5 text-zinc-350 text-xs px-4 py-2.8 rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:text-white"
                  id="btn-run-expiry-check"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${runningExpiryCheck ? 'animate-spin' : ''}`} />
                  Comprobar Vencimientos
                </button>
                <button
                  onClick={() => {
                    setEditingClient(undefined);
                    setShowClientForm(true);
                  }}
                  className={`px-4.5 py-2.8 rounded-xl font-bold text-xs transition-all duration-250 flex items-center gap-2 shadow-[0_0_20px_-3px_var(--primary-color)] hover:brightness-110 active:scale-95 cursor-pointer ${
                    isColorDark(pColor) ? 'text-white' : 'text-zinc-950'
                  }`}
                  style={{ backgroundColor: pColor }}
                  id="btn-open-create-client"
                >
                  <Plus className={`w-4 h-4 stroke-[3] ${isColorDark(pColor) ? 'text-white' : 'text-zinc-950'}`} />
                  Agregar Cliente
                </button>
              </div>

            </div>

            {/* Clients Listing Board */}
            {loading ? (
              <div className="p-16 text-center text-zinc-500 tracking-wide font-medium">Cargando base de datos de hosting VPS...</div>
            ) : clients.length === 0 ? (
              <div className="glass-panel p-16 text-center rounded-2xl border border-white/5 animate-fade-in">
                <Globe className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                <p className="text-zinc-300 font-bold text-[17px]">¡Aún no tienes clientes registrados!</p>
                <p className="text-zinc-500 text-xs mt-2 max-w-md mx-auto leading-relaxed">
                  Tus datos se restablecieron o estás iniciando de cero. Crea un cliente nuevo usando el botón <span className="text-zinc-300 font-semibold">"Agregar Cliente"</span> o efectúa una importación masiva en segundos.
                </p>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="glass-panel p-16 text-center rounded-2xl border border-white/5 animate-fade-in">
                <Globe className="w-12 h-12 text-zinc-800 mx-auto mb-3 opacity-60" />
                <p className="text-zinc-350 font-semibold text-base">Ningún servicio coincide con los filtros aplicados.</p>
                <p className="text-zinc-550 text-xs mt-1.5 max-w-sm mx-auto">Prueba limpiando tu búsqueda o cambiando el filtro de estado seleccionado.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5" id="clients-grid-display">
                {filteredClients.map(client => {
                  const badge = getExpirationStatus(client.expiryDate, client.paymentStatus);
                  const isPending = badge.status !== 'paid';

                  return (
                    <div 
                      key={client.id}
                      className="glass-card rounded-2xl p-5 lg:p-6 flex flex-col lg:flex-row lg:items-stretch gap-6 relative overflow-hidden hover:border-white/10 transition-all duration-300 shadow-md animate-fade-in"
                      id={`client-card-${client.id}`}
                    >
                      {/* Columna 1: Datos del cliente (dominio, nombre, correo y telefono) */}
                      <div className="w-full lg:w-[24%] lg:min-w-[220px] lg:max-w-[28%] flex-shrink-0 flex flex-col justify-start items-center text-center lg:items-start lg:text-left gap-3" id="col-client-data">
                        <div className="flex flex-col items-center text-center lg:flex-row lg:items-start lg:text-left gap-3 w-full min-w-0">
                          <div 
                            style={{ backgroundColor: `${pColor}10`, borderColor: `${pColor}20` }}
                            className="w-10 h-10 rounded-xl flex items-center justify-center border text-zinc-400 flex-shrink-0"
                          >
                            <Globe className="w-4.5 h-4.5" style={{ color: pColor }} />
                          </div>
                          <div className="space-y-1.5 w-full min-w-0 flex flex-col items-center lg:items-start animate-fade-in" id="col-client-contact-info-panel">
                            <div>
                              <span className="text-zinc-550 font-mono text-[8px] block uppercase tracking-widest font-black leading-none">DOMINIO</span>
                              <span className="font-bold text-white text-[15px] tracking-tight truncate block hover:underline cursor-pointer text-center lg:text-left">
                                {client.domain}
                              </span>
                              <div className="flex items-center justify-center lg:justify-start gap-1.5 pt-0.5 max-w-full">
                                <span className="text-zinc-250 font-semibold text-xs truncate">{client.name}</span>
                                {client.isPreferential && (
                                  <span className="text-[9px] font-black tracking-wider bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0" title="Prioridad VIP">
                                    ★ VIP
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Emails list */}
                            <div className="flex flex-wrap gap-1 justify-center lg:justify-start">
                              {client.email.split(',').map((emailAddress, idx) => (
                                <span key={idx} className="text-zinc-400 font-mono text-[9px] bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg inline-block truncate max-w-[200px]" title={emailAddress.trim()}>
                                  {emailAddress.trim()}
                                </span>
                              ))}
                            </div>

                            {client.phone && (
                              <span className="text-zinc-500 font-mono text-[10px] block text-center lg:text-left">
                                📞 {client.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Columna 2: Encerrar en un solo chip (borde sutil, fondo transparente) el vencimiento y costo con raya divisoria */}
                      <div className="w-full lg:w-[15%] lg:min-w-[130px] flex-shrink-0 flex flex-col justify-center items-center text-center gap-1.5 border border-white/10 rounded-xl p-2 bg-transparent shadow-none lg:h-[84px]" id="col-client-timing">
                        {/* Fila 1: Vencimiento */}
                        <div className="space-y-0.5 text-center">
                          <span className="text-zinc-550 text-[8px] uppercase font-bold tracking-widest block leading-none">VENCIMIENTO</span>
                          <span className="text-zinc-150 font-mono text-xs block font-bold pt-0.5">{client.expiryDate}</span>
                        </div>

                        <div className="border-t border-white/10 w-full"></div>

                        {/* Fila 2: Costo */}
                        <div className="space-y-0.5 text-center">
                          <span className="text-zinc-550 text-[8px] uppercase font-bold tracking-widest block leading-none">COSTO HOSTING</span>
                          {client.discountPercentage && client.discountPercentage > 0 ? (
                            <div className="pt-0.5 text-center">
                              <span className="text-zinc-550 font-mono text-[9px] line-through block leading-none opacity-80 mb-0.5">
                                ${client.cost.toLocaleString('es-CO')} {client.currency || 'COP'}
                              </span>
                              <span className="text-zinc-100 font-mono font-black text-xs leading-none block">
                                ${(client.cost - (client.cost * client.discountPercentage / 100)).toLocaleString('es-CO')} <span className="text-[8px] text-zinc-400 font-sans font-normal uppercase">{client.currency || 'COP'}</span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-100 font-mono font-bold text-xs block pt-0.5">
                              ${client.cost.toLocaleString('es-CO')} <span className="text-[8px] text-zinc-400 font-sans font-normal uppercase">{client.currency || 'COP'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Columna 3: Características del cliente (en una sola columna):
                          1. Chip de vencimiento interactivo (rojo vencido, verde normal, amarillo por vencer)
                          2. Debajo chip de características (tipo cliente: descuento, preferencial) sutil blanco pero un poco más ancho
                          3. Debajo el chip de mensaje preferencial/personalizado
                      */}
                      <div className="w-full lg:flex-grow lg:flex-1 lg:min-w-[155px] flex flex-col justify-start items-center lg:items-start gap-1 lg:h-[84px] text-center lg:text-left" id="col-client-features">
                        {/* Chip de vencimiento de color interactivo */}
                        <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider inline-block text-center w-full max-w-[140px] select-none ${badge.colorClass}`}>
                          {badge.label}
                        </span>

                        {/* Tipo o característica cliente (descuento, preferencial) */}
                        {client.discountPercentage && client.discountPercentage > 0 ? (
                          <span className="text-[9px] font-black tracking-widest bg-zinc-950 text-white border border-white/10 px-3 py-0.5 rounded-lg inline-flex items-center gap-1.5 justify-center w-full max-w-[140px] select-none" title={`Tiene un descuento aplicado del ${client.discountPercentage}%`}>
                            <span className="text-emerald-400 text-[10px]">%</span> {client.discountPercentage}% DCTO
                          </span>
                        ) : null}

                        {/* Chip de mensaje preferencial/personalizado tal como está ahora */}
                        {client.useCustomTemplate && (
                          <span className="text-[9px] font-black tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-lg inline-flex items-center gap-1.5 justify-center w-full max-w-[140px] select-none" title="Usa plantilla o asunto de correo personalizado">
                            <span className="text-purple-400">✉</span> MSG PERSONAL
                          </span>
                        )}

                        {/* Anotaciones del cliente */}
                        {client.notes && (
                          <div className="text-zinc-450 text-[10px] italic line-clamp-3 leading-tight w-full max-w-[140px]" title={client.notes}>
                            {client.notes}
                          </div>
                        )}
                      </div>

                      {/* Columna 4: Dos filas. Fila 1 (boton mail y boton whatsapp), Fila 2 (boton editar y boton eliminar) */}
                      <div className="w-full lg:w-[25%] lg:min-w-[240px] flex-shrink-0 flex flex-col justify-start gap-2" id="col-client-actions">
                        {/* Fila 1: Botón Mail & Botón WhatsApp al mismo tamaño */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleManualEmail(client.id, client.domain)}
                            className="p-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-350 hover:text-white border border-white/5 rounded-xl transition duration-200 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer h-[38px] w-full"
                            title="Enviar Correo Informativo Directo"
                            id={`btn-manual-email-${client.id}`}
                          >
                            <Mail className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Mail</span>
                          </button>

                          <button
                            onClick={() => handleWhatsAppReminder(client)}
                            className="p-2 bg-emerald-500/10 hover:bg-emerald-600/20 border border-emerald-500/15 hover:border-emerald-500/35 text-emerald-300 hover:text-white rounded-xl transition duration-200 text-[10px] font-black flex items-center justify-center gap-1.5 cursor-pointer h-[38px] w-full"
                            title="Enviar Recordatorio por WhatsApp"
                            id={`btn-whatsapp-${client.id}`}
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                            <span>WhatsApp</span>
                          </button>
                        </div>

                        {/* Fila 2: Botón Editar & Botón Eliminar al mismo tamaño */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setEditingClient(client);
                              setShowClientForm(true);
                            }}
                            className="p-2 bg-white/5 hover:bg-white/10 text-zinc-350 hover:text-white border border-white/5 rounded-xl transition duration-200 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer h-[38px] w-full"
                            title="Editar Datos"
                            id={`btn-edit-${client.id}`}
                          >
                            <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Editar</span>
                          </button>

                          <button
                            onClick={() => handleDeleteClient(client.id, client.domain)}
                            className="p-2 bg-red-500/5 hover:bg-red-500/15 text-red-400 hover:text-white border border-red-500/10 hover:border-red-500/20 rounded-xl transition duration-200 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer h-[38px] w-full"
                            title="Eliminar Cliente"
                            id={`btn-delete-${client.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </div>

                      {/* Columna 5: Una sola fila grande (reportar pago o Al Día) */}
                      <div className="w-full lg:w-[15%] lg:min-w-[130px] flex-shrink-0 flex flex-col justify-start items-stretch lg:h-[84px]" id="col-client-payment-status">
                        {isPending ? (
                          <button
                            onClick={() => {
                              const advance = confirm(`¿Quieres registrar el pago de ${client.domain} y posponer automáticamente la fecha de vencimiento un año completo? \n\nSelecciona Aceptar para posponer la fecha de vencimiento un año extra.`);
                              handleRegisterPayment(client.id, advance);
                            }}
                            className={`w-full flex-1 text-xs font-black rounded-xl transition duration-200 cursor-pointer flex flex-col items-center justify-center gap-1.5 hover:brightness-110 shadow-lg active:scale-95 text-center p-3 ${
                              isColorDark(pColor) ? 'text-white' : 'text-zinc-950'
                            }`}
                            style={{ backgroundColor: pColor }}
                            title="Registrar Pago de Hosting"
                            id={`btn-pay-${client.id}`}
                          >
                            <CheckCircle2 className={`w-5 h-5 stroke-[3] ${isColorDark(pColor) ? 'text-white' : 'text-zinc-950'}`} />
                            <span className="uppercase tracking-widest text-[9px] font-black leading-tight">Reportar Pago</span>
                          </button>
                        ) : (
                          <div className="w-full flex-1 flex flex-col items-center justify-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center select-none p-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span className="text-[9px] uppercase font-black tracking-widest leading-tight">Servicio Al Día</span>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {activeTab === 'import' && (
          <div className="space-y-6" id="import-tab-content">
            <GoogleDocsImport 
              primaryColor={pColor} 
              onImportSuccess={(count) => {
                showToast('success', `¡Se importaron ${count} clientes correctamente desde tu documento!`);
                setActiveTab('clients');
                fetchData();
              }}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6" id="settings-tab-content">
            <SettingsPanel 
              smtp={data.smtp}
              company={data.company}
              templates={data.templates}
              primaryColor={pColor}
              onSave={handleSaveSettings}
            />
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6" id="logs-tab-content">
            <EmailLogsList 
              logs={data.logs || []} 
              primaryColor={pColor} 
              onRefresh={fetchData}
            />
          </div>
        )}
          </>
        )}

      </main>

      {/* Popups Client Management Forms */}
      {showClientForm && (
        <ClientForm 
          client={editingClient}
          onClose={() => {
            setShowClientForm(false);
            setEditingClient(undefined);
          }}
          onSave={handleSaveClient}
          primaryColor={pColor}
          templates={data.templates}
        />
      )}

      {/* Humble Footer info details */}
      <footer className="border-t border-white/5 mt-24 bg-[#0a0a0c]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-xs text-zinc-500">
          <p>{data.company.name} — Sistema de Renovación Automática de Hosting VPS v1.0.0</p>
          <p className="mt-1 font-mono text-[10px] text-zinc-600">Guardado en base de datos local JSON interactiva. Copias de seguridad automáticas activadas.</p>
        </div>
      </footer>

    </div>
  );
}
