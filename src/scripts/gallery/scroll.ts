// Scroll-side motion: the intro plays once, photos open as they enter the
// viewport, paired photos drift at different speeds, and the bottom counter
// follows the photo nearest the middle of the screen.
import { reduceMotion } from "./spring";

const root = document.documentElement;
const photos = Array.from(document.querySelectorAll<HTMLElement>(".g-photo"));
const progress = document.querySelector<HTMLElement>(".g-progress")!;
const currentLabel = progress.querySelector<HTMLElement>("[data-current]")!;
const fill = progress.querySelector<HTMLElement>(".g-progress-fill")!;
const pad = (n: number) => String(n).padStart(2, "0");

requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-ready")));

// fade each photo in once its bytes arrive, instead of painting top to bottom
for (const img of document.querySelectorAll<HTMLImageElement>(".g-frame img")) {
  const loaded = () => img.classList.add("is-loaded");
  if (img.complete && img.naturalWidth) loaded();
  else img.addEventListener("load", loaded, { once: true });
}

// reveal; hover gets a quicker spring once the long reveal has finished
const settleAfter = parseFloat(getComputedStyle(root).getPropertyValue("--dur-reveal")) * 1.3 || 1800;
export function reveal(photo: HTMLElement) {
  if (photo.classList.contains("is-in")) return;
  photo.classList.add("is-in");
  setTimeout(() => photo.classList.add("is-settled"), reduceMotion.matches ? 0 : settleAfter);
}
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      reveal(e.target as HTMLElement);
      io.unobserve(e.target);
    }
  },
  { rootMargin: "0px 0px -12% 0px", threshold: 0.01 }
);
photos.forEach((p) => io.observe(p));

// Page positions are measured with parallax switched off, so the drift never
// feeds back into its own measurement.
const wide = window.matchMedia("(min-width: 900px)");
let centers: number[] = [];
const measure = () => {
  photos.forEach((p) => p.style.setProperty("--py", "0px"));
  centers = photos.map((p) => {
    const r = p.getBoundingClientRect();
    return r.top + window.scrollY + r.height / 2;
  });
  update();
};

let current = -1;
let queued = false;
function update() {
  queued = false;
  const vh = window.innerHeight;
  const mid = window.scrollY + vh / 2;
  const drift = wide.matches && !reduceMotion.matches;

  let nearest = 0;
  photos.forEach((p, i) => {
    if (Math.abs(centers[i] - mid) < Math.abs(centers[nearest] - mid)) nearest = i;
    if (!drift) return;
    const speed = parseFloat(p.style.getPropertyValue("--speed")) || 0;
    const offset = centers[i] - mid;
    if (speed && Math.abs(offset) < vh * 1.5) p.style.setProperty("--py", `${(-offset * speed).toFixed(1)}px`);
  });

  if (nearest !== current) {
    current = nearest;
    currentLabel.textContent = pad(nearest + 1);
  }
  const max = root.scrollHeight - vh;
  fill.style.setProperty("--p", String(max > 0 ? Math.min(window.scrollY / max, 1) : 0));
  progress.classList.toggle("is-shown", window.scrollY > vh * 0.5);
}

const queue = () => {
  if (!queued) requestAnimationFrame(update);
  queued = true;
};
window.addEventListener("scroll", queue, { passive: true });
window.addEventListener("resize", measure);
new ResizeObserver(measure).observe(document.querySelector(".g-frames")!);
reduceMotion.addEventListener("change", measure);
measure();
