// Loads and validates src/content/site.yaml.
// Plain JS on purpose: both the Astro pages and scripts/subset-font.mjs import it.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { z } from "astro/zod";

// Resolved from the project root (npm scripts always run there); a path
// relative to this module would break once Astro bundles it.
const SITE_YAML = resolve(process.cwd(), "src/content/site.yaml");

const text = z.string().trim().min(1);
const optionalText = z.string().trim().optional().default("");

const sectionHead = {
  title: text,
  titleImage: z.string().optional(),
  en: optionalText,
  intro: optionalText,
};

const schema = z.object({
  meta: z.object({
    title: text,
    description: optionalText,
    url: optionalText,
  }),
  draftNote: optionalText,
  name: text,
  nav: z.array(z.object({ label: text, target: text })).min(1),
  hero: z.object({
    kicker: optionalText,
    greeting: text,
    tagline: optionalText,
    lead: optionalText,
    meta: z.array(text).default([]),
  }),
  work: z.object({
    ...sectionHead,
    items: z.array(
      z.object({
        name: text,
        role: optionalText,
        summary: optionalText,
        facts: z.array(z.object({ label: text, value: text })).default([]),
      })
    ),
  }),
  collab: z.object({
    ...sectionHead,
    items: z.array(
      z.object({
        name: text,
        when: optionalText,
        summary: optionalText,
        points: z.array(text).default([]),
      })
    ),
  }),
  lab: z.object({
    ...sectionHead,
    items: z.array(
      z.object({
        year: z.coerce.string(),
        name: text,
        summary: optionalText,
        badge: optionalText,
      })
    ),
  }),
  note: z.object({
    title: text,
    paragraphs: z.array(text).default([]),
  }),
  contact: z.object({
    ...sectionHead,
    lead: optionalText,
    links: z.array(z.object({ label: text, href: optionalText })).default([]),
  }),
});

export function loadSite() {
  const raw = parse(readFileSync(SITE_YAML, "utf8"));
  const result = schema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`
    );
    throw new Error(`site.yaml 内容格式有误：\n${lines.join("\n")}`);
  }
  return result.data;
}

// Every string rendered in the handwritten font. The font is subset to exactly
// these glyphs, so anything shown with .hand must be listed here.
export function handTexts(site) {
  const sections = [site.work, site.collab, site.lab, site.contact];
  return [
    site.name,
    site.hero.greeting,
    site.hero.tagline,
    site.note.title,
    ...sections.map((s) => s.title),
    "404找不到这一页回首页", // src/pages/404.astro
  ];
}
