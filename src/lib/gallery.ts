// Loads src/content/gallery.yaml and turns every listed photo into responsive,
// self-hosted AVIF/WebP sets plus a tiny blurred preview. Build-time only.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { z } from "astro/zod";
import sharp from "sharp";
import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";

const GALLERY_YAML = resolve(process.cwd(), "src/content/gallery.yaml");
const PHOTO_DIR = resolve(process.cwd(), "src/assets/gallery");

const text = z.string().trim().min(1);
const optionalText = z.coerce.string().trim().optional().default("");

const schema = z.object({
  meta: z.object({ title: text, description: optionalText }),
  // true while the photos are stand-ins: keeps the page out of search engines
  // and shows a line saying so in the footer.
  draft: z.boolean().default(false),
  title: text,
  en: optionalText,
  intro: optionalText,
  photos: z
    .array(
      z.object({
        file: text,
        title: optionalText,
        place: optionalText,
        date: optionalText,
        camera: optionalText,
        alt: optionalText,
        credit: optionalText,
        source: optionalText,
      })
    )
    .min(1, "至少放一张照片"),
});

// Every file under src/assets/gallery, keyed by file name. Astro needs the
// import to see the images at build time; a plain path would be served as-is.
const files = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/gallery/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}",
  { eager: true }
);
const byName = new Map(Object.entries(files).map(([path, mod]) => [path.split("/").pop()!, mod.default]));

const WIDTHS = [480, 800, 1200, 1600, 2400];

export type Shape = "landscape" | "portrait" | "square";

export interface Photo {
  index: number;
  title: string;
  place: string;
  date: string;
  camera: string;
  alt: string;
  credit: string;
  source: string;
  width: number;
  height: number;
  shape: Shape;
  avif: string;
  webp: string;
  fallback: string; // a mid-size WebP, for links when JS is off
  color: string; // average colour, shown while the photo loads
  blur: string; // ~24px WebP data URI, blurred into a preview
}

async function build(entry: z.infer<typeof schema>["photos"][number], index: number): Promise<Photo> {
  const meta = byName.get(entry.file);
  const path = resolve(PHOTO_DIR, entry.file);
  if (!meta || !existsSync(path)) {
    throw new Error(`gallery.yaml 第 ${index + 1} 张：在 src/assets/gallery/ 里找不到 ${entry.file}`);
  }
  const widths = WIDTHS.filter((w) => w < meta.width);
  widths.push(Math.min(meta.width, 3000));
  const [avif, webp, fallback] = await Promise.all([
    getImage({ src: meta, widths, format: "avif", quality: 58 }),
    getImage({ src: meta, widths, format: "webp", quality: 80 }),
    getImage({ src: meta, width: Math.min(meta.width, 1600), format: "webp", quality: 80 }),
  ]);

  const img = sharp(path).rotate();
  const [{ data: px }, blur] = await Promise.all([
    img.clone().resize(1, 1).raw().toBuffer({ resolveWithObject: true }),
    img.clone().resize(24).webp({ quality: 40 }).toBuffer(),
  ]);

  const ratio = meta.width / meta.height;
  return {
    index: index + 1,
    ...entry,
    width: meta.width,
    height: meta.height,
    shape: ratio > 1.15 ? "landscape" : ratio < 0.87 ? "portrait" : "square",
    avif: avif.srcSet.attribute,
    webp: webp.srcSet.attribute,
    fallback: fallback.src,
    color: `rgb(${px[0]} ${px[1]} ${px[2]})`,
    blur: `data:image/webp;base64,${blur.toString("base64")}`,
  };
}

export async function loadGallery() {
  const result = schema.safeParse(parse(readFileSync(GALLERY_YAML, "utf8")));
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`gallery.yaml 内容格式有误：\n${lines.join("\n")}`);
  }
  const data = result.data;
  const photos = await Promise.all(data.photos.map(build));
  return { ...data, photos };
}

// Groups photos into rows for the wide layout: two photos share a row when
// they fit side by side (a portrait next to anything), otherwise a photo gets
// a row to itself. Positions alternate so the page never settles into a grid.
export interface Placed {
  photo: Photo;
  start: number; // grid column, 1–12
  span: number;
  lift: boolean; // second photo in a pair sits lower
  speed: number; // parallax factor
}

const SPAN: Record<Shape, number> = { landscape: 7, portrait: 4, square: 5 };

export function layoutRows(photos: Photo[]): Placed[][] {
  const rows: Placed[][] = [];
  let i = 0;
  let side = 0;
  while (i < photos.length) {
    const a = photos[i];
    const b = photos[i + 1];
    const pairable = b && (a.shape === "portrait" || b.shape === "portrait") && rows.length % 3 !== 2;
    if (pairable) {
      // on the right-hand rows a landscape gives up a column, leaving a margin on the left
      const trim = (p: Photo) => (side % 2 === 1 && p.shape === "landscape" ? 1 : 0);
      const spanA = SPAN[a.shape] - trim(a);
      const spanB = SPAN[b.shape] - trim(b);
      const gap = 12 - spanA - spanB >= 2 ? 2 : 1;
      const startA = side % 2 === 0 ? 1 : 13 - (spanA + gap + spanB);
      rows.push([
        { photo: a, start: startA, span: spanA, lift: false, speed: 0 },
        { photo: b, start: startA + spanA + gap, span: spanB, lift: true, speed: 0.08 },
      ]);
      i += 2;
    } else {
      // every third row is a lone, larger photo: the page's breathing points
      const wide = a.shape === "landscape" && rows.length % 3 === 2;
      const span = wide ? 10 : a.shape === "landscape" ? 8 : SPAN[a.shape] + 1;
      const start = wide ? 2 : side % 2 === 0 ? 13 - span - 1 : 2;
      rows.push([{ photo: a, start, span, lift: false, speed: wide ? -0.04 : 0.04 }]);
      i += 1;
    }
    side += 1;
  }
  return rows;
}
