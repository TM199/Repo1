'use client';

import { SignalContact } from '@/types';
import { Mail, Phone, Linkedin, Check, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ContactsListProps {
  contacts: SignalContact[];
}

const emailStatusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  verified: { bg: '#D1FAE5', text: '#047857', icon: <Check className="h-2.5 w-2.5" /> },
  valid: { bg: '#D1FAE5', text: '#047857', icon: <Check className="h-2.5 w-2.5" /> },
  risky: { bg: '#FEE2E2', text: '#B91C1C', icon: <AlertCircle className="h-2.5 w-2.5" /> },
  invalid: { bg: '#FEE2E2', text: '#B91C1C', icon: <X className="h-2.5 w-2.5" /> },
  unknown: { bg: '#F0F3F7', text: '#6B7C93', icon: null },
};

export function ContactsList({ contacts }: ContactsListProps) {
  if (!contacts || contacts.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <p className="text-[10px] font-medium text-muted-foreground mb-2">CONTACTS</p>
      <div className="space-y-2">
        {contacts.map((contact) => {
          const emailStatus = emailStatusColors[contact.email_status || 'unknown'] || emailStatusColors.unknown;
          return (
            <div key={contact.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-foreground truncate">{contact.full_name}</p>
                  {contact.seniority && contact.seniority !== 'unknown' && (
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                      contact.seniority === 'executive' ? 'bg-purple-100 text-purple-700' :
                      contact.seniority === 'senior' ? 'bg-blue-100 text-blue-700' :
                      contact.seniority === 'manager' ? 'bg-green-100 text-green-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {contact.seniority}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground truncate">{contact.job_title}</p>
              </div>
              <div className="flex items-center gap-1">
                {contact.email ? (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(contact.email!);
                      toast.success('Email copied to clipboard');
                    }}
                    className="h-6 px-1.5 rounded flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                    style={{ backgroundColor: emailStatus.bg, color: emailStatus.text }}
                    title={`Click to copy: ${contact.email}`}
                  >
                    <Mail className="h-3 w-3" />
                    {emailStatus.icon}
                  </button>
                ) : (
                  <span className="h-6 px-1.5 rounded flex items-center gap-1 bg-[#FEE2E2] text-[#B91C1C] text-[9px]">
                    <Mail className="h-3 w-3" />
                    <X className="h-2.5 w-2.5" />
                  </span>
                )}
                {contact.phone ? (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(contact.phone!);
                      toast.success('Phone copied to clipboard');
                    }}
                    className="w-6 h-6 rounded bg-[#D1FAE5] flex items-center justify-center text-[#047857] hover:opacity-80 transition-opacity cursor-pointer"
                    title={`Click to copy: ${contact.phone}`}
                  >
                    <Phone className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="w-6 h-6 rounded bg-[#FEE2E2] flex items-center justify-center text-[#B91C1C]" title="Phone not found">
                    <Phone className="h-3 w-3" />
                  </span>
                )}
                {contact.linkedin_url && (
                  <a
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-6 h-6 rounded bg-muted flex items-center justify-center text-muted-foreground hover:bg-[#0A66C2] hover:text-white transition-colors"
                    title="LinkedIn Profile"
                  >
                    <Linkedin className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
