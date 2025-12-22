import { Signal, SignalContact } from '@/types';

type SignalWithContacts = Signal & { contacts?: SignalContact[] };

const escapeField = (value: string | null | undefined): string => {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export function signalsToCsv(signals: SignalWithContacts[]): string {
  const headers = [
    'company_name',
    'company_domain',
    'signal_type',
    'signal_title',
    'signal_detail',
    'signal_url',
    'location',
    'industry',
    'source_type',
    'detected_at',
    'contact_name',
    'contact_title',
    'contact_seniority',
    'contact_email',
    'contact_email_status',
    'contact_phone',
    'contact_linkedin',
  ];

  const rows: string[] = [];

  for (const signal of signals) {
    const baseRow = [
      escapeField(signal.company_name),
      escapeField(signal.company_domain),
      escapeField(signal.signal_type),
      escapeField(signal.signal_title),
      escapeField(signal.signal_detail),
      escapeField(signal.signal_url),
      escapeField(signal.location),
      escapeField(signal.industry),
      escapeField(signal.source_type),
      escapeField(signal.detected_at),
    ];

    if (signal.contacts && signal.contacts.length > 0) {
      // One row per contact
      for (const contact of signal.contacts) {
        rows.push([
          ...baseRow,
          escapeField(contact.full_name),
          escapeField(contact.job_title),
          escapeField(contact.seniority),
          escapeField(contact.email),
          escapeField(contact.email_status),
          escapeField(contact.phone),
          escapeField(contact.linkedin_url),
        ].join(','));
      }
    } else {
      // Signal without contacts
      rows.push([...baseRow, '', '', '', '', '', '', ''].join(','));
    }
  }

  return [headers.join(','), ...rows].join('\n');
}

export function signalsToJson(signals: SignalWithContacts[]): string {
  return JSON.stringify(signals, null, 2);
}
