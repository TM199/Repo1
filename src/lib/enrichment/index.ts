import { findContactByRole } from './leadmagic';
import { findEmail, findPhone } from './prospeo';
import { getTargetRoles } from '../contact-mapping';
import { resolveDomain, DomainResolutionResult } from '../domain-resolver';

export type SeniorityLevel = 'executive' | 'senior' | 'manager' | 'individual' | 'unknown';

export interface EnrichedContact {
  full_name: string;
  first_name: string;
  last_name: string;
  job_title: string;
  seniority: SeniorityLevel;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
}

/**
 * Detect seniority level from job title
 */
function detectSeniority(jobTitle: string): SeniorityLevel {
  const title = jobTitle.toLowerCase();

  // Executive level
  if (/\b(ceo|cfo|cto|coo|cmo|chief|president|founder|owner|partner)\b/.test(title)) {
    return 'executive';
  }

  // Senior level
  if (/\b(vp|vice president|director|head of|principal|senior)\b/.test(title)) {
    return 'senior';
  }

  // Manager level
  if (/\b(manager|lead|supervisor|coordinator|team lead)\b/.test(title)) {
    return 'manager';
  }

  // Individual contributor
  if (/\b(analyst|engineer|developer|specialist|associate|consultant|officer)\b/.test(title)) {
    return 'individual';
  }

  return 'unknown';
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
  | { type: 'complete'; contacts?: EnrichedContact[]; message?: string; summary?: { total_found: number; total_saved: number; failed: number } }
  | { type: 'error'; message: string; contacts_saved?: number };

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
      seniority: detectSeniority(role),
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

/**
 * Enrich signal with custom roles (user-selected)
 */
export async function enrichSignalWithRoles(
  companyDomain: string,
  companyName: string,
  roles: string[],
  leadmagicKey: string,
  prospeoKey: string,
  includePhone: boolean = false,
  onProgress?: (event: EnrichmentEvent) => void
): Promise<EnrichedContact[]> {
  const contacts: EnrichedContact[] = [];
  let domainToUse = companyDomain;

  onProgress?.({ type: 'roles', roles });

  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    onProgress?.({ type: 'searching_role', role, index: i, total: roles.length });

    // Find contact by role (LeadMagic)
    const contact = await findContactByRole(domainToUse || '', companyName, role, leadmagicKey);
    if (!contact) {
      onProgress?.({ type: 'role_not_found', role });
      continue;
    }

    onProgress?.({ type: 'found_contact', role, name: contact.name });

    // Extract domain from LeadMagic if we don't have one
    if (!domainToUse && contact.company_website) {
      domainToUse = contact.company_website;
      console.log(`[Enrichment] Got domain from LeadMagic: ${domainToUse}`);
    }

    // Get email (Prospeo) - needs domain
    onProgress?.({ type: 'finding_email', name: contact.name });
    let emailResult = null;
    if (domainToUse) {
      emailResult = await findEmail(
        contact.first_name,
        contact.last_name,
        domainToUse,
        prospeoKey
      );
    }

    if (emailResult?.email) {
      onProgress?.({ type: 'email_found', email: emailResult.email, status: emailResult.status || 'unknown' });
    }

    // Get phone if enabled (Prospeo)
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
      seniority: detectSeniority(role),
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

/**
 * Waterfall enrichment - tries LeadMagic first without domain,
 * then falls back through domain resolution strategies
 */
export interface WaterfallResult {
  contacts: EnrichedContact[];
  domain: string;
  domainSource: DomainResolutionResult['source'] | 'leadmagic_direct';
  domainConfidence: number;
}

export async function enrichWithWaterfall(
  companyName: string,
  existingDomain: string | null,
  signalType: string,
  signalTitle: string,
  leadmagicKey: string,
  prospeoKey: string,
  includePhone: boolean = false,
  maxContacts: number = 3,
  onProgress?: (event: EnrichmentEvent) => void
): Promise<WaterfallResult> {
  const targetRoles = getTargetRoles(signalType, signalTitle);
  const rolesToSearch = targetRoles.slice(0, maxContacts);
  const contacts: EnrichedContact[] = [];

  onProgress?.({ type: 'roles', roles: rolesToSearch });

  let resolvedDomain = existingDomain || '';
  let domainSource: WaterfallResult['domainSource'] = existingDomain ? 'url_extract' : 'none';
  let domainConfidence = existingDomain ? 100 : 0;

  // Track which strategy succeeded
  const strategies: Array<{
    name: string;
    getDomain: () => Promise<{ domain: string; source: DomainResolutionResult['source']; confidence: number } | null>;
  }> = [];

  // Strategy 1: Try LeadMagic with just company name (no domain)
  if (!existingDomain) {
    strategies.push({
      name: 'leadmagic_direct',
      getDomain: async () => null, // LeadMagic doesn't return domain, but may find contacts
    });
  }

  // Strategy 2-3: Domain resolution fallbacks
  if (!existingDomain) {
    strategies.push({
      name: 'google_search',
      getDomain: async () => {
        const result = await resolveDomain(companyName, { skipGoogle: false });
        if (result.domain && result.source === 'google_search') {
          return { domain: result.domain, source: result.source, confidence: result.confidence };
        }
        return null;
      },
    });
    strategies.push({
      name: 'guessed',
      getDomain: async () => {
        const result = await resolveDomain(companyName, { skipGoogle: true });
        // This will use DNS guessing since we skip Google
        if (result.domain && result.source === 'guessed') {
          return { domain: result.domain, source: result.source, confidence: result.confidence };
        }
        return null;
      },
    });
  }

  // Try each role
  for (let i = 0; i < rolesToSearch.length; i++) {
    const role = rolesToSearch[i];
    onProgress?.({ type: 'searching_role', role, index: i, total: rolesToSearch.length });

    let contact = null;

    // If we have a domain already, use it directly
    if (resolvedDomain) {
      contact = await findContactByRole(resolvedDomain, companyName, role, leadmagicKey);
    } else {
      // Waterfall: try LeadMagic without domain first
      console.log(`[Waterfall] Trying LeadMagic with company name only: ${companyName}`);
      contact = await findContactByRole('', companyName, role, leadmagicKey);

      if (contact) {
        console.log(`[Waterfall] LeadMagic found contact without domain!`);
        // Extract domain from LeadMagic response if available
        if (contact.company_website) {
          resolvedDomain = contact.company_website;
          domainSource = 'leadmagic_direct';
          domainConfidence = 80;
          console.log(`[Waterfall] Got domain from LeadMagic: ${resolvedDomain}`);
        }
      } else {
        // Fall through domain resolution strategies
        for (const strategy of strategies) {
          if (strategy.name === 'leadmagic_direct') continue; // Already tried

          console.log(`[Waterfall] Trying ${strategy.name} for domain...`);
          const domainResult = await strategy.getDomain();

          if (domainResult) {
            resolvedDomain = domainResult.domain;
            domainSource = domainResult.source;
            domainConfidence = domainResult.confidence;
            console.log(`[Waterfall] Got domain from ${strategy.name}: ${resolvedDomain}`);

            // Retry LeadMagic with domain
            contact = await findContactByRole(resolvedDomain, companyName, role, leadmagicKey);
            if (contact) break;
          }
        }
      }
    }

    if (!contact) {
      onProgress?.({ type: 'role_not_found', role });
      continue;
    }

    onProgress?.({ type: 'found_contact', role, name: contact.name });

    // Get email - need domain for Prospeo
    onProgress?.({ type: 'finding_email', name: contact.name });
    let emailResult = null;

    if (resolvedDomain) {
      emailResult = await findEmail(contact.first_name, contact.last_name, resolvedDomain, prospeoKey);
    }

    if (emailResult?.email) {
      onProgress?.({ type: 'email_found', email: emailResult.email, status: emailResult.status || 'unknown' });
    }

    // Get phone if enabled
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
      seniority: detectSeniority(role),
      email: emailResult?.email || null,
      email_status: emailResult?.status || null,
      phone,
      linkedin_url: contact.profile_url,
    };

    contacts.push(enrichedContact);
    onProgress?.({ type: 'contact_complete', contact: enrichedContact });
  }

  onProgress?.({ type: 'complete', contacts });

  return {
    contacts,
    domain: resolvedDomain,
    domainSource,
    domainConfidence,
  };
}
