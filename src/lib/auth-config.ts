// Shared (client + server safe) auth configuration.
export const ALLOWED_EMAIL_DOMAINS = ["cintara.ai", "revcloud.com"] as const;

export function emailDomainAllowed(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}
