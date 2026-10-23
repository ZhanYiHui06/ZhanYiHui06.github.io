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
  avif: string;
  webp: string;
  fallback: string; // a mid-size WebP, for links when JS is off
  thumb: string; // a small WebP for the viewer's strip
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
  const [avif, webp, fallback, thumb] = await Promise.all([
    getImage({ src: meta, widths, format: "avif", quality: 58 }),
    getImage({ src: meta, widths, format: "webp", quality: 80 }),
    getImage({ src: meta, width: Math.min(meta.width, 1600), format: "webp", quality: 80 }),
    getImage({ src: meta, width: 160, format: "webp", quality: 70 }),
  ]);

  const img = sharp(path).rotate();
  const [{ data: px }, blur] = await Promise.all([
    img.clone().resize(1, 1).raw().toBuffer({ resolveWithObject: true }),
    img.clone().resize(24).webp({ quality: 40 }).toBuffer(),
  ]);

  return {
    index: index + 1,
    ...entry,
    width: meta.width,
    height: meta.height,
    avif: avif.srcSet.attribute,
    webp: webp.srcSet.attribute,
    fallback: fallback.src,
    thumb: thumb.src,
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
