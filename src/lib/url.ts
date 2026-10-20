// Prefixes site-relative paths ("/resume.pdf") with the deploy base, so the
// same content works at example.com/ and at <user>.github.io/<repo>/.
// External links, mailto:, tel: and #anchors pass through untouched.
export function withBase(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${href}`;
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}
