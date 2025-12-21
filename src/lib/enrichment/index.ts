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

export async function enrichSignal(
  companyDomain: string,
  companyName: string,
  signalType: string,
  signalTitle: string,
  leadmagicKey: string,
  prospeoKey: string,
  includePhone: boolean = false,
  maxContacts: number = 3
): Promise<EnrichedContact[]> {
  const targetRoles = getTargetRoles(signalType, signalTitle);
  const contacts: EnrichedContact[] = [];

  for (const role of targetRoles.slice(0, maxContacts)) {
    // 1. Find contact by role (LeadMagic)
    const contact = await findContactByRole(companyDomain, companyName, role, leadmagicKey);
    if (!contact) continue;

    // 2. Get email (Prospeo)
    const emailResult = await findEmail(
      contact.first_name,
      contact.last_name,
      companyDomain,
      prospeoKey
    );

    // 3. Get phone if enabled (Prospeo)
    let phone = null;
    if (includePhone && contact.profile_url) {
      phone = await findPhone(contact.profile_url, prospeoKey);
    }

    contacts.push({
      full_name: contact.name,
      first_name: contact.first_name,
      last_name: contact.last_name,
      job_title: role,
      email: emailResult?.email || null,
      email_status: emailResult?.status || null,
      phone,
      linkedin_url: contact.profile_url,
    });
  }

  return contacts;
}
