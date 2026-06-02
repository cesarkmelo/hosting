export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  domain: string;
  cost: number;
  currency: string;
  expiryDate: string; // YYYY-MM-DD
  paymentStatus: 'paid' | 'pending';
  lastPaymentDate?: string; // YYYY-MM-DD
  customSubject?: string;
  customBody?: string;
  useCustomTemplate: boolean;
  notes?: string;
  isPreferential?: boolean;
  discountPercentage?: number;
}

export interface SMTPSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  fromName: string;
}

export interface CompanySettings {
  name: string;
  logoText: string;
  primaryColor: string; // e.g., '#ef4444' or '#3b82f6'
  bannerUrl?: string;
  logoUrl?: string;
}

export interface TemplatesSettings {
  genericSubject: string;
  genericBody: string;
  expiredSubject: string;
  expiredBody: string;
}

export interface EmailLog {
  id: string;
  clientId: string;
  clientEmail: string;
  domain: string;
  type: '15_days_before' | 'due_date' | 'past_due_8_days' | 'manual' | 'suspend_alert_5_days';
  sentAt: string; // ISO string
  status: 'success' | 'failed';
  error?: string;
}

export interface DatabaseState {
  clients: Client[];
  smtp: SMTPSettings;
  company: CompanySettings;
  templates: TemplatesSettings;
  logs: EmailLog[];
}

export interface LoggedInUser {
  name: string;
  email: string;
  picture?: string;
}

export const ALLOWED_EMAILS = [
  'cesar@alfamediaweb.com',
  'heidy@alfamediaweb.com',
  'mariana@alfamediaweb.com'
];

export function isColorDark(hexColor: string): boolean {
  if (!hexColor || !hexColor.startsWith('#')) return false;
  const hex = hexColor.replace('#', '');
  if (hex.length !== 3 && hex.length !== 6) return false;
  let r = 0, g = 0, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  // HSP equation
  const hsp = Math.sqrt(
    0.299 * (r * r) +
    0.587 * (g * g) +
    0.114 * (b * b)
  );
  return hsp < 155;
}

