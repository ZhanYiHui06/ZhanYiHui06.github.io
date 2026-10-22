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
const link = z.object({ label: text, href: optionalText });
// Pictures stacked beside an item; only the first three show, the rest wait
// behind the stack and come forward as the visitor clicks through.
const images = z.array(z.object({ src: text, alt: optionalText })).default([]);

// Each layout keeps the look of one block of the original page.
const rowItem = z.object({
  name: text,
  role: optionalText,
  summary: optionalText,
  facts: z.array(z.object({ label: text, value: text })).default([]),
  links: z.array(link).default([]),
  images,
});

const cardItem = z.object({
  name: text,
  when: optionalText,
  summary: optionalText,
  points: z.array(text).default([]),
});

const listItem = z.object({
  year: z.coerce.string(),
  name: text,
  summary: optionalText,
  badge: optionalText,
  links: z.array(link).default([]),
  images,
});

const sectionHead = {
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "id 只能用小写字母、数字和 -"),
  nav: optionalText,
  title: text,
  titleImage: z.string().optional(),
  en: optionalText,
  intro: optionalText,
};

const section = z.discriminatedUnion("layout", [
  z.object({ ...sectionHead, layout: z.literal("rows"), items: z.array(rowItem).default([]) }),
  z.object({ ...sectionHead, layout: z.literal("cards"), items: z.array(cardItem).default([]) }),
  z.object({ ...sectionHead, layout: z.literal("list"), items: z.array(listItem).default([]) }),
  z.object({
    ...sectionHead,
    layout: z.literal("taste"),
    photos: z
      .array(z.object({ src: text, caption: optionalText, alt: optionalText }))
      .default([]),
    tracks: z
      .array(z.object({ title: text, artist: optionalText, note: optionalText, href: optionalText }))
      .default([]),
    playlist: link.optional(),
  }),
]);

const schema = z.object({
  meta: z.object({
    title: text,
    description: optionalText,
    url: optionalText,
  }),
  draftNote: optionalText,
  name: text,
  hero: z.object({
    kicker: optionalText,
    greeting: text,
    tagline: optionalText,
    lead: optionalText,
    meta: z.array(text).default([]),
  }),
  menu: z
    .object({
      title: text,
      en: optionalText,
      items: z
        .array(
          z.object({
            name: text,
            tag: optionalText,
            price: optionalText,
            ingredients: optionalText,
            desc: optionalText,
            target: text,
          })
        )
        .default([]),
      footnote: optionalText,
    })
    .optional(),
  sections: z.array(section).min(1),
  note: z.object({
    title: text,
    paragraphs: z.array(text).default([]),
  }),
  contact: z.object({
    title: text,
    titleImage: z.string().optional(),
    lead: optionalText,
    links: z.array(link).default([]),
  }),
});

// A section with nothing in it is left off the page, along with its nav
// entry and any menu item pointing at it.
function hasContent(s) {
  if (s.layout === "taste") return s.photos.length > 0 || s.tracks.length > 0;
  return s.items.length > 0;
}

export function loadSite() {
  const raw = parse(readFileSync(SITE_YAML, "utf8"));
  const result = schema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`
    );
    throw new Error(`site.yaml 内容格式有误：\n${lines.join("\n")}`);
  }
  const site = result.data;
  site.sections = site.sections.filter(hasContent);
  const shown = new Set(site.sections.map((s) => s.id));
  if (site.menu) site.menu.items = site.menu.items.filter((m) => shown.has(m.target));
  site.nav = [
    ...site.sections.filter((s) => s.nav).map((s) => ({ label: s.nav, target: s.id })),
    { label: "联系", target: "contact" },
  ];
  return site;
}

// Every string rendered in the handwritten font. The font is subset to exactly
// these glyphs, so anything shown with .hand must be listed here.
export function handTexts(site) {
  return [
    site.name,
    site.hero.greeting,
    site.hero.tagline,
    site.note.title,
    site.contact.title,
    ...site.sections.map((s) => s.title),
    ...(site.menu ? [site.menu.title, ...site.menu.items.flatMap((m) => [m.name, m.price])] : []),
    "404找不到这一页回首页", // src/pages/404.astro
  ];
}
