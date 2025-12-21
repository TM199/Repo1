import { findContactByRole } from './leadmagic';
import { findEmail, findPhone } from './prospeo';
import { getTargetRoles } from '../contact-mapping';

export interface EnrichedContact {
  full_name: string;
  first_name: string;
  last_name: string;
  job_title: string;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
}

export type EnrichmentEvent =
  | { type: 'roles'; roles: string[] }
  | { type: 'searching_role'; role: string; index: number; total: number }
  | { type: 'found_contact'; role: string; name: string }
  | { type: 'role_not_found'; role: string }
  | { type: 'finding_email'; name: string }
  | { type: 'email_found'; email: string; status: string }
  | { type: 'finding_phone'; name: string }
  | { type: 'phone_found'; phone: string }
  | { type: 'contact_complete'; contact: EnrichedContact }
  | { type: 'complete'; contacts: EnrichedContact[] }
  | { type: 'error'; message: string };

export async function enrichSignal(
  companyDomain: string,
  companyName: string,
  signalType: string,
  signalTitle: string,
  leadmagicKey: string,
  prospeoKey: string,
  includePhone: boolean = false,
  maxContacts: number = 3,
  onProgress?: (event: EnrichmentEvent) => void
): Promise<EnrichedContact[]> {
  const targetRoles = getTargetRoles(signalType, signalTitle);
  const rolesToSearch = targetRoles.slice(0, maxContacts);
  const contacts: EnrichedContact[] = [];

  onProgress?.({ type: 'roles', roles: rolesToSearch });

  for (let i = 0; i < rolesToSearch.length; i++) {
    const role = rolesToSearch[i];
    onProgress?.({ type: 'searching_role', role, index: i, total: rolesToSearch.length });

    // 1. Find contact by role (LeadMagic)
    const contact = await findContactByRole(companyDomain, companyName, role, leadmagicKey);
    if (!contact) {
      onProgress?.({ type: 'role_not_found', role });
      continue;
    }

    onProgress?.({ type: 'found_contact', role, name: contact.name });

    // 2. Get email (Prospeo)
    onProgress?.({ type: 'finding_email', name: contact.name });
    const emailResult = await findEmail(
      contact.first_name,
      contact.last_name,
      companyDomain,
      prospeoKey
    );

    if (emailResult?.email) {
      onProgress?.({ type: 'email_found', email: emailResult.email, status: emailResult.status || 'unknown' });
    }

    // 3. Get phone if enabled (Prospeo)
    let phone = null;
    if (includePhone && contact.profile_url) {
      onProgress?.({ type: 'finding_phone', name: contact.name });
      phone = await findPhone(contact.profile_url, prospeoKey);
      if (phone) {
        onProgress?.({ type: 'phone_found', phone });
      }
    }

    const enrichedContact: EnrichedContact = {
      full_name: contact.name,
      first_name: contact.first_name,
      last_name: contact.last_name,
      job_title: role,
      email: emailResult?.email || null,
      email_status: emailResult?.status || null,
      phone,
      linkedin_url: contact.profile_url,
    };

    contacts.push(enrichedContact);
    onProgress?.({ type: 'contact_complete', contact: enrichedContact });
  }

  onProgress?.({ type: 'complete', contacts });
  return contacts;
}
