/**
 * Domain validation utilities
 */

// Common file extensions that might be mistakenly used as domains
const FILE_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf',
  'ppt', 'pptx', 'odt', 'ods', 'odp',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp',
  'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv',
  'zip', 'rar', 'tar', 'gz', '7z',
  'exe', 'dll', 'dmg', 'iso',
  'html', 'htm', 'css', 'js', 'json', 'xml'
]);

// IP address pattern (IPv4)
const IP_ADDRESS_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;

// Basic domain pattern: alphanumeric with hyphens, followed by TLD
const DOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Validates if a string is a valid domain
 */
export function isValidDomain(domain: string | null | undefined): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  const trimmed = domain.trim().toLowerCase();

  if (!trimmed) {
    return false;
  }

  // Reject IP addresses
  if (IP_ADDRESS_PATTERN.test(trimmed)) {
    return false;
  }

  // Reject file extensions used as domains
  if (FILE_EXTENSIONS.has(trimmed)) {
    return false;
  }

  // Validate domain pattern
  return DOMAIN_PATTERN.test(trimmed);
}

/**
 * Returns the domain if valid, null otherwise
 */
export function getDomainOrNull(domain: string | null | undefined): string | null {
  if (!isValidDomain(domain)) {
    return null;
  }

  return domain!.trim().toLowerCase();
}
