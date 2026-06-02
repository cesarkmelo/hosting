import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { DatabaseState, Client, EmailLog, SMTPSettings, CompanySettings, TemplatesSettings, ALLOWED_EMAILS } from './src/types.js';

dotenv.config();

// Setup directories and DB file
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default state
const DEFAULT_STATE: DatabaseState = {
  clients: [
    {
      id: 'example-1',
      name: 'Juan Pérez',
      email: 'juan.perez@ejemplo.com',
      phone: '+34 600 123 456',
      domain: 'minegocio.com',
      cost: 120,
      currency: 'USD',
      expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days from now
      paymentStatus: 'pending',
      useCustomTemplate: false,
      notes: 'Cliente preferencial, renovaciones anuales.'
    },
    {
      id: 'example-2',
      name: 'María Gómez',
      email: 'maria.gomez@ejemplo.com',
      phone: '+34 600 987 654',
      domain: 'estudiocreativo.cl',
      cost: 85,
      currency: 'EUR',
      expiryDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days ago (expired, pending)
      paymentStatus: 'pending',
      useCustomTemplate: true,
      customSubject: 'Recordatorio especial: Renovación de hosting {domain}',
      customBody: 'Estimada María,\n\nTe recordamos que tu hosting especial para {domain} requiere renovación por un valor especial de {cost}.\n\nValoramos mucho trabajar contigo.\n\nAtentamente,\n{company_name}',
      notes: 'Tiene descuento especial aplicado.'
    }
  ],
  smtp: {
    host: '',
    port: 587,
    user: '',
    pass: '',
    secure: false,
    fromName: 'Notificaciones Hosting'
  },
  company: {
    name: 'AlfamediaWEB Hosting Manager',
    logoText: 'AMW-HOST',
    primaryColor: '#10b981' // Emerald (elegant dark mode green)
  },
  templates: {
    genericSubject: '⚠️ Recordatorio: Vencimiento de Hosting - {domain}',
    genericBody: 'Hola {name},\n\nTe escribimos para recordarte que el hosting de tu sitio web {domain} vencerá pronto.\n\nDetalles del servicio:\n- Dominio: {domain}\n- Fecha de Vencimiento: {expiry_date}\n- Monto de Renovación: {cost}\n\nPor favor, realiza el pago antes de la fecha límite para evitar interrupciones de acceso.\n\nAtentamente,\n{company_name}',
    expiredSubject: '🚨 URGENTE: Tu Hosting ha Vencido - {domain}',
    expiredBody: 'Hola {name},\n\nTe informamos que el hosting de tu sitio web {domain} venció el {expiry_date}.\n\nPara mantener tus correos y sitio web activos, es requerido registrar el pago de renovación.\n\nDetalles del servicio:\n- Dominio: {domain}\n- Monto de Renovación: {cost}\n\nPor favor, responde a este correo con el comprobante de pago o ponte en contacto con nosotros.\n\nAtentamente,\n{company_name}'
  },
  logs: []
};

// Guard load state
function readDb(): DatabaseState {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf-8');
      return DEFAULT_STATE;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(content);
    // Backward compatibility merge
    return {
      clients: db.clients || [],
      smtp: { ...DEFAULT_STATE.smtp, ...db.smtp },
      company: { ...DEFAULT_STATE.company, ...db.company },
      templates: { ...DEFAULT_STATE.templates, ...db.templates },
      logs: db.logs || []
    };
  } catch (error) {
    console.error('Error reading database file:', error);
    return DEFAULT_STATE;
  }
}

// Guard write state
function writeDb(state: DatabaseState): boolean {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing to database file:', error);
    return false;
  }
}

// Replace template placeholders helper
function formatTemplate(template: string, client: Client, company: CompanySettings, extra: { expiryDateFormatted: string; costFormatted: string; daysExpired?: number }) {
  return template
    .replace(/{name}/g, client.name)
    .replace(/{nombre}/g, client.name)
    .replace(/{domain}/g, client.domain)
    .replace(/{dominio}/g, client.domain)
    .replace(/{cost}/g, extra.costFormatted)
    .replace(/{costo}/g, extra.costFormatted)
    .replace(/{expiry_date}/g, extra.expiryDateFormatted)
    .replace(/{vencimiento}/g, extra.expiryDateFormatted)
    .replace(/{company_name}/g, company.name)
    .replace(/{empresa}/g, company.name)
    .replace(/{days_expired}/g, String(extra.daysExpired || 0))
    .replace(/{diasVencidos}/g, String(extra.daysExpired || 0));
}

// SMTP transport creation
function getTransporter(smtp: SMTPSettings) {
  if (!smtp.host || !smtp.user || !smtp.pass) {
    throw new Error('Las credenciales SMTP están incompletas. Configúralas en la sección de Ajustes.');
  }
  return nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port),
    secure: smtp.secure, // true for 465, false for other ports
    auth: {
      user: smtp.user,
      pass: smtp.pass
    },
    tls: {
      rejectUnauthorized: false // Avoid issues with self-signed SSL on hostings
    }
  });
}

// Send mail logic
async function sendNotificationEmail(client: Client, type: '15_days_before' | 'due_date' | 'past_due_8_days' | 'manual' | 'suspend_alert_5_days', daysExpired?: number): Promise<{ success: boolean; error?: string }> {
  const db = readDb();
  const smtp = db.smtp;
  const company = db.company;
  const templates = db.templates;

  try {
    const isMockMode = !smtp.host || !smtp.user || !smtp.pass;

    // Formatted details
    const expiryDateFormatted = client.expiryDate;
    const costFormatted = `${client.cost.toLocaleString('es-CO')} ${client.currency || 'COP'}`;

    // Recipient overrides for suspension alerts
    const isSuspensionAlert = type === 'suspend_alert_5_days';
    const recipient = isSuspensionAlert ? 'cesar@alfamediaweb.com, heidy@alfamediaweb.com' : client.email;

    // Select templates (Custom vs Generic)
    let subject = '';
    let body = '';

    if (isSuspensionAlert) {
      subject = `🚨 ALERTA: Suspender servicio de hosting - ${client.domain}`;
      body = `Hola César y Heidy,\n\nEste es un aviso automático del sistema de administración.\n\nEl servicio para el cliente ${client.name} (${client.domain}) venció hace 5 días (${expiryDateFormatted}) y aún se encuentra marcado como PENDIENTE DE PAGO.\n\nPor favor, proceden a suspender el servicio según los protocolos establecidos.\n\nDetalles del servicio:\n- Cliente: ${client.name}\n- Dominio: ${client.domain}\n- Fecha de Vencimiento: ${expiryDateFormatted}\n- Valor de Renovación: ${costFormatted}\n- Correo de contacto: ${client.email}\n\nAtentamente,\n${company.name}`;
    } else if (client.useCustomTemplate && client.customSubject && client.customBody) {
      subject = formatTemplate(client.customSubject, client, company, { expiryDateFormatted, costFormatted, daysExpired });
      body = formatTemplate(client.customBody, client, company, { expiryDateFormatted, costFormatted, daysExpired });
    } else {
      // Past due uses expired template, others use generic template
      const isExpired = type === 'due_date' || type === 'past_due_8_days';
      const rawSubject = isExpired ? templates.expiredSubject : templates.genericSubject;
      const rawBody = isExpired ? templates.expiredBody : templates.genericBody;

      subject = formatTemplate(rawSubject, client, company, { expiryDateFormatted, costFormatted, daysExpired });
      body = formatTemplate(rawBody, client, company, { expiryDateFormatted, costFormatted, daysExpired });
    }

    if (!isMockMode) {
      const transporter = getTransporter(smtp);
      const fromHeader = `"${smtp.fromName || company.name}" <${smtp.user}>`;

      await transporter.sendMail({
        from: fromHeader,
        to: recipient,
        subject: subject,
        text: body,
        html: body.replace(/\n/g, '<br>') // Basic markdown/line-breaks support
      });
    } else {
      console.log(`[SMTP SIMULATOR] Correo enviado de forma simulada a ${recipient}`);
      console.log(`Asunto: ${subject}`);
      console.log(`Mensaje:\n${body}`);
    }

    // Write log entry
    const newLog: EmailLog = {
      id: 'log-' + Date.now() + Math.random().toString(36).substring(2, 6),
      clientId: client.id,
      clientEmail: recipient,
      domain: client.domain,
      type: type,
      sentAt: new Date().toISOString(),
      status: 'success'
    };
    db.logs.unshift(newLog);
    // Keep logs under 100 limit
    if (db.logs.length > 500) {
      db.logs = db.logs.slice(0, 500);
    }
    writeDb(db);

    return { success: true };
  } catch (error: any) {
    const isSuspensionAlert = type === 'suspend_alert_5_days';
    const recipient = isSuspensionAlert ? 'cesar@alfamediaweb.com, heidy@alfamediaweb.com' : client.email;
    console.error(`Error sending email to ${recipient}:`, error);
    const newLog: EmailLog = {
      id: 'log-' + Date.now() + Math.random().toString(36).substring(2, 6),
      clientId: client.id,
      clientEmail: recipient,
      domain: client.domain,
      type: type,
      sentAt: new Date().toISOString(),
      status: 'failed',
      error: error.message || String(error)
    };
    db.logs.unshift(newLog);
    writeDb(db);
    return { success: false, error: error.message };
  }
}

// Function that analyzes and triggers emails
async function runReminderCheck(): Promise<{ triggeredCount: number; details: string[] }> {
  const db = readDb();
  const smtp = db.smtp;
  
  // Skip automatic cron trigger when SMTP is unconfigured to avoid cluttering error logs or failing check cycles
  if (!smtp || !smtp.host || !smtp.user || !smtp.pass) {
    console.log('Chequeo automático de vencimiento: SMTP no configurado. Omitiendo despacho.');
    return { triggeredCount: 0, details: ['SMTP no configurado. Omitiendo chequeo automático.'] };
  }

  const clients = db.clients;
  const logs = db.logs;
  const company = db.company;

  let triggeredCount = 0;
  const details: string[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const client of clients) {
    if (!client.expiryDate) continue;

    // Parse expiration
    const expiryParts = client.expiryDate.split('-');
    if (expiryParts.length !== 3) continue;
    const expiry = new Date(Number(expiryParts[0]), Number(expiryParts[1]) - 1, Number(expiryParts[2]));
    expiry.setHours(0, 0, 0, 0);

    // Difference in days
    const diffMs = expiry.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // Expiry year/cycle identifier to avoid duplicates for the exact same annual cycle
    const cycleYear = expiryParts[0]; 

    // Helper: has already sent success email of this type for this client + cycle expiration year?
    const alreadySent = (type: string) => {
      return logs.some(log => 
        log.clientId === client.id && 
        log.type === type && 
        log.status === 'success' && 
        log.domain === client.domain &&
        // If sentAt matches the client's currently set expiry date or within the last 6 months of same expiry year
        new Date(log.sentAt).getFullYear().toString() === new Date().getFullYear().toString() &&
        Math.abs(new Date(log.sentAt).getTime() - new Date().getTime()) < 30 * 24 * 60 * 60 * 1000 // Sent within 30 days
      );
    };

    // Case 1: 15 days before expiration
    if (diffDays === 15 && client.paymentStatus === 'pending') {
      if (!alreadySent('15_days_before')) {
        const res = await sendNotificationEmail(client, '15_days_before');
        if (res.success) {
          triggeredCount++;
          details.push(`Enviado aviso de 15 días a ${client.name} (${client.domain})`);
        } else {
          details.push(`Fallo enviando aviso de 15 días a ${client.name}: ${res.error}`);
        }
      } else {
        details.push(`Aviso de 15 días ya enviado anteriormente para ${client.domain}`);
      }
    }

    // Case 2: On Expiration Date
    else if (diffDays === 0 && client.paymentStatus === 'pending') {
      if (!alreadySent('due_date')) {
        const res = await sendNotificationEmail(client, 'due_date');
        if (res.success) {
          triggeredCount++;
          details.push(`Enviado aviso de día de vencimiento a ${client.name} (${client.domain})`);
        } else {
          details.push(`Fallo enviando aviso de vencimiento a ${client.name}: ${res.error}`);
        }
      } else {
        details.push(`Aviso de vencimiento ya enviado anteriormente para ${client.domain}`);
      }
    }

    // Case 3: 5 days after expiration - Send suspension notice to César and Heidy
    else if (diffDays === -5 && client.paymentStatus === 'pending') {
      if (!alreadySent('suspend_alert_5_days')) {
        const res = await sendNotificationEmail(client, 'suspend_alert_5_days');
        if (res.success) {
          triggeredCount++;
          details.push(`Enviado aviso de suspensión (5 días vencido) para ${client.domain} a César y Heidy`);
        } else {
          details.push(`Fallo enviando aviso de suspensión de 5 días para ${client.domain}: ${res.error}`);
        }
      } else {
        details.push(`Aviso de suspensión de 5 días para ${client.domain} ya fue enviado anteriormente`);
      }
    }

    // Case 4: After Expiration Date, every 8 days if unpaid
    else if (diffDays < 0 && client.paymentStatus === 'pending') {
      const daysPast = Math.abs(diffDays);
      if (daysPast > 0 && daysPast % 8 === 0) {
        // We look for a success log of type 'past_due_8_days' sent TODAY or with the same daysPast
        // Just checking if we sent an email in the last 48 hours is extremely safe against duplication
        const alreadySentToday = logs.some(log => 
          log.clientId === client.id && 
          log.type === 'past_due_8_days' &&
          log.status === 'success' &&
          Math.abs(new Date(log.sentAt).getTime() - today.getTime()) < 24 * 60 * 60 * 1000
        );

        if (!alreadySentToday) {
          const res = await sendNotificationEmail(client, 'past_due_8_days', daysPast);
          if (res.success) {
            triggeredCount++;
            details.push(`Enviado remanente de ${daysPast} días vencido a ${client.name} (${client.domain})`);
          } else {
            details.push(`Fallo enviando remanente de vencido a ${client.name}: ${res.error}`);
          }
        } else {
          details.push(`Remanente de ${daysPast} días ya enviado hoy para ${client.domain}`);
        }
      }
    }
  }

  return { triggeredCount, details };
}

// Token cache to avoid hitting Google's endpoints repeatedly
const tokenCache = new Map<string, { email: string; exp: number }>();

async function requireAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Acceso no autorizado: Token no proporcionado' });
    return;
  }

  const token = authHeader.substring(7); // "Bearer " is 7 chars
  if (!token) {
    res.status(401).json({ error: 'Acceso no autorizado: Token vacío' });
    return;
  }

  try {
    const nowSecs = Math.floor(Date.now() / 1000);

    // 1. Check local cache to be super fast
    const cached = tokenCache.get(token);
    if (cached && cached.exp > nowSecs) {
      if (ALLOWED_EMAILS.includes(cached.email)) {
        (req as any).user = cached;
        next();
        return;
      }
    }

    // 2. Local decode and pre-check to prevent abuse
    const parts = token.split('.');
    if (parts.length !== 3) {
      res.status(401).json({ error: 'Acceso no autorizado: Token inválido' });
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    } catch {
      res.status(401).json({ error: 'Acceso no autorizado: Estructura de token corrupta' });
      return;
    }

    if (!payload.email) {
      res.status(401).json({ error: 'Acceso no autorizado: Token no contiene correo' });
      return;
    }

    const email = payload.email.toLowerCase().trim();
    if (!ALLOWED_EMAILS.includes(email)) {
      res.status(403).json({ error: `Acceso denegado: El correo "${email}" no está autorizado.` });
      return;
    }

    if (payload.exp && payload.exp < nowSecs) {
      res.status(401).json({ error: 'Acceso no autorizado: Token Google expirado' });
      return;
    }

    // 3. Cryptographic remote signature verification of Google Token via tokeninfo API
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (!response.ok) {
      res.status(401).json({ error: 'Acceso no autorizado: Firma de token de Google no válida' });
      return;
    }

    const googlePayload: any = await response.json();
    if (googlePayload.error || googlePayload.error_description) {
      res.status(401).json({ error: 'Acceso no autorizado: Token de Google rechazado' });
      return;
    }

    const verifiedEmail = (googlePayload.email || '').toLowerCase().trim();
    if (!verifiedEmail || !ALLOWED_EMAILS.includes(verifiedEmail)) {
      res.status(403).json({ error: `Acceso denegado: El correo "${verifiedEmail}" no está autorizado.` });
      return;
    }

    // Check aud if client ID is set
    const expectedClientId = process.env.VITE_GOOGLE_CLIENT_ID;
    if (expectedClientId && googlePayload.aud !== expectedClientId) {
       res.status(401).json({ error: 'Acceso no autorizado: Cliente de aplicación no coincide' });
       return;
    }

    // Store in cache
    const exp = Number(googlePayload.exp) || (nowSecs + 3600);
    tokenCache.set(token, { email: verifiedEmail, exp });

    (req as any).user = { email: verifiedEmail };
    next();
  } catch (error: any) {
    console.error('Error verifying Google ID token:', error);
    res.status(500).json({ error: 'Error del servidor al validar autenticación' });
  }
}

// Express server setup
async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());
  
  // Guard all /api requests with Google auth middleware
  app.use('/api', requireAuth);

  // API - Get App data
  app.get('/api/data', (req: Request, res: Response) => {
    const db = readDb();
    res.json(db);
  });

  // API - Update settings (SMTP, templates, company)
  app.post('/api/settings', (req: Request, res: Response) => {
    const db = readDb();
    const { company, smtp, templates } = req.body;

    if (company) db.company = { ...db.company, ...company };
    if (smtp) db.smtp = { ...db.smtp, ...smtp };
    if (templates) db.templates = { ...db.templates, ...templates };

    if (!writeDb(db)) {
      res.status(500).json({ error: 'Fallo al escribir en la base de datos local (comprueba los permisos de escritura del proceso de Node en la carpeta /data de tu servidor Plesk).' });
      return;
    }
    res.json({ success: true, state: db });
  });

  // API - Create client
  app.post('/api/clients', (req: Request, res: Response) => {
    const db = readDb();
    const newClient: Client = {
      id: 'cli-' + Date.now() + Math.random().toString(36).substring(2, 6),
      name: req.body.name || 'Nuevo Cliente',
      email: req.body.email || '',
      phone: req.body.phone || '',
      domain: req.body.domain || '',
      cost: Number(req.body.cost) || 0,
      currency: req.body.currency || 'COP',
      expiryDate: req.body.expiryDate || new Date().toISOString().split('T')[0],
      paymentStatus: req.body.paymentStatus || 'pending',
      useCustomTemplate: !!req.body.useCustomTemplate,
      customSubject: req.body.customSubject || '',
      customBody: req.body.customBody || '',
      notes: req.body.notes || '',
      isPreferential: !!req.body.isPreferential,
      discountPercentage: Number(req.body.discountPercentage) || 0
    };

    db.clients.push(newClient);
    if (!writeDb(db)) {
      res.status(500).json({ error: 'Fallo de permisos de escritura: No se pudo agregar el cliente (revisa los permisos de la carpeta /data en Plesk).' });
      return;
    }
    res.json({ success: true, client: newClient });
  });

  // API - Handler used for client update (To support both PUT and POST for Plesk ModSecurity bypass)
  const handleClientUpdate = (req: Request, res: Response) => {
    const db = readDb();
    const clientId = req.params.id;
    const clientIndex = db.clients.findIndex(c => c.id === clientId);

    if (clientIndex === -1) {
       res.status(404).json({ error: 'Client not found' });
       return;
    }

    db.clients[clientIndex] = {
      ...db.clients[clientIndex],
      ...req.body,
      cost: req.body.cost !== undefined ? Number(req.body.cost) : db.clients[clientIndex].cost
    };

    if (!writeDb(db)) {
      res.status(500).json({ error: 'Fallo de permisos de escritura: No se pudo actualizar el cliente (revisa los permisos de la carpeta /data en Plesk).' });
      return;
    }
    res.json({ success: true, client: db.clients[clientIndex] });
  };

  app.put('/api/clients/:id', handleClientUpdate);
  app.post('/api/clients/:id/update', handleClientUpdate); // Fallback compatible con Plesk WAF

  // API - Handler used for client deletion (To support both DELETE and POST for Plesk ModSecurity bypass)
  const handleClientDelete = (req: Request, res: Response) => {
    const db = readDb();
    const clientId = req.params.id;
    const initialLength = db.clients.length;

    db.clients = db.clients.filter(c => c.id !== clientId);
    if (!writeDb(db)) {
      res.status(500).json({ error: 'Fallo de permisos de escritura: No se pudo eliminar el cliente (revisa los permisos de la carpeta /data en Plesk).' });
      return;
    }

    res.json({ success: db.clients.length < initialLength });
  };

  app.delete('/api/clients/:id', handleClientDelete);
  app.post('/api/clients/:id/delete', handleClientDelete); // Fallback compatible con Plesk WAF

  // API - Report Payment / Mark standard extension
  app.post('/api/clients/:id/pay', (req: Request, res: Response) => {
    const db = readDb();
    const clientId = req.params.id;
    const clientIndex = db.clients.findIndex(c => c.id === clientId);

    if (clientIndex === -1) {
       res.status(440).json({ error: 'Client not found' });
       return;
    }

    const { advanceYear } = req.body;
    const client = db.clients[clientIndex];

    client.paymentStatus = 'paid';
    client.lastPaymentDate = new Date().toISOString().split('T')[0];

    // Auto-advance expiry date by 1 year if requested (highly practical for renewal setups!)
    if (advanceYear && client.expiryDate) {
      const parts = client.expiryDate.split('-');
      if (parts.length === 3) {
        const nextYear = Number(parts[0]) + 1;
        client.expiryDate = `${nextYear}-${parts[1]}-${parts[2]}`;
      }
    }

    if (!writeDb(db)) {
      res.status(500).json({ error: 'Fallo de permisos de escritura: No se pudo registrar el pago (revisa los permisos de la carpeta /data en Plesk).' });
      return;
    }
    res.json({ success: true, client });
  });

  // API - Manual trigger a notification email (Immediate)
  app.post('/api/clients/:id/send-manual', async (req: Request, res: Response) => {
    const db = readDb();
    const client = db.clients.find(c => c.id === req.params.id);

    if (!client) {
       res.status(440).json({ error: 'Client not found' });
       return;
    }

    // Determine type based on actual state
    let type: '15_days_before' | 'due_date' | 'past_due_8_days' | 'manual' = 'manual';
    
    // Attempt sending email
    const result = await sendNotificationEmail(client, type);

    if (result.success) {
      res.json({ success: true, message: 'Correo enviado satisfactoriamente.' });
    } else {
      res.status(500).json({ error: result.error || 'Fallo al enviar correo.' });
    }
  });

  // API - Trigger SMTP credentials test email
  app.post('/api/test-email', async (req: Request, res: Response) => {
    const { smtp, testEmail } = req.body;
    if (!smtp || !testEmail) {
       res.status(400).json({ error: 'Faltan parámetros smtp o testEmail' });
       return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port),
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.sendMail({
        from: `"${smtp.fromName || 'Test'}" <${smtp.user}>`,
        to: testEmail,
        subject: 'Prueba de Configuración SMTP - Recordatorio Hosting',
        text: `Hola!\n\nEste es un correo de prueba enviado desde tu sistema de "Recordatorio de Hosting" para comprobar que las credenciales SMTP funcionan correctamente.\n\nFelicidades, todo está correcto!`,
      });

       res.json({ success: true });
    } catch (err: any) {
       res.status(500).json({ error: err.message || String(err) });
    }
  });

  // API - Force execute automatic check of expiration & email triggering
  app.post('/api/cron-check', async (req: Request, res: Response) => {
    try {
      const result = await runReminderCheck();
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Bulk Import clients logic (Paste from Google Docs / CSV)
  app.post('/api/bulk-import', (req: Request, res: Response) => {
    const db = readDb();
    const { list } = req.body; // Array of items: { name, email, domain, cost, expiryDate }
    
    if (!Array.isArray(list)) {
       res.status(400).json({ error: 'La lista de importación no es compatible' });
       return;
    }

    let count = 0;
    list.forEach((item: any) => {
      if (!item.name || !item.domain) return;
      const newClient: Client = {
        id: 'cli-' + Date.now() + Math.random().toString(36).substring(2, 6),
        name: String(item.name).trim(),
        email: String(item.email || '').trim(),
        phone: String(item.phone || '').trim(),
        domain: String(item.domain).trim().toLowerCase(),
        cost: Number(item.cost) || 100,
        currency: String(item.currency || 'COP').toUpperCase(),
        expiryDate: item.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        paymentStatus: 'pending',
        useCustomTemplate: false,
        notes: item.notes || 'Importado desde Google Docs'
      };
      db.clients.push(newClient);
      count++;
    });

    writeDb(db);
    res.json({ success: true, count, total: db.clients.length });
  });

  // Background automated periodic check
  // Running a check every 4 hours represents ideal low-overhead scheduling 
  setInterval(async () => {
    console.log('Running automated hosting expiration reminder check...');
    try {
      const report = await runReminderCheck();
      if (report.triggeredCount > 0) {
        console.log(`Automated check: sent ${report.triggeredCount} emails.`, report.details);
      }
    } catch (error) {
      console.error('Error on automated check interval:', error);
    }
  }, 4 * 60 * 60 * 1000);

  // Trigger one checking pass on startup to ensure we catch alerts quickly!
  setTimeout(async () => {
    console.log('App started, executing initial hosting check...');
    try {
      await runReminderCheck();
    } catch (error) {
      console.error('Error executing initial hosting check:', error);
    }
  }, 5000);

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
