// Full-screen viewer. A photo grows out of its spot on the page (FLIP, driven
// by a spring), can be flicked sideways to the next one or pulled down to put
// it back, and returns to wherever it lives on the page when closed.
import { spring, lerp, reduceMotion, type Running, type SpringParams } from "./spring";
import { reveal } from "./scroll";

interface Item {
  title: string;
  caption: string;
  camera: string;
  alt: string;
  width: number;
  height: number;
  avif: string;
  webp: string;
  color: string;
}

const OPEN: SpringParams = { stiffness: 170, damping: 21 }; // a touch of overshoot
const CLOSE: SpringParams = { stiffness: 240, damping: 30 };
const SLIDE_OUT: SpringParams = { stiffness: 420, damping: 42 };
const SLIDE_IN: SpringParams = { stiffness: 190, damping: 20 };
const BACK: SpringParams = { stiffness: 300, damping: 26 };

const items: Item[] = JSON.parse(document.getElementById("lb-data")!.textContent!);
const figures = Array.from(document.querySelectorAll<HTMLElement>(".g-photo"));
const root = document.documentElement;
const lb = document.querySelector<HTMLElement>(".lb")!;
const stage = lb.querySelector<HTMLElement>(".lb-stage")!;
const frame = lb.querySelector<HTMLElement>(".lb-frame")!;
const low = lb.querySelector<HTMLImageElement>(".lb-low")!;
const hi = lb.querySelector<HTMLImageElement>(".lb-hi")!;
const cap = lb.querySelector<HTMLElement>(".lb-cap")!;
const counter = lb.querySelector<HTMLElement>("[data-lb-index]")!;
const closeBtn = lb.querySelector<HTMLButtonElement>(".lb-close")!;
const prevBtn = lb.querySelector<HTMLButtonElement>(".lb-prev")!;
const nextBtn = lb.querySelector<HTMLButtonElement>(".lb-next")!;
const pad = (n: number) => String(n).padStart(2, "0");

let index = -1;
let isOpen = false;
let running: Running | null = null;
let busy = false;
let lastFocus: HTMLElement | null = null;
let box = { left: 0, top: 0, width: 0, height: 0 }; // where the photo rests on screen

// Transform of the frame relative to its resting box: x/y offset in px, uniform scale.
type T = { x: number; y: number; s: number };
const REST: T = { x: 0, y: 0, s: 1 };
let now: T = { ...REST };
let shade = 0; // backdrop opacity
let alpha = 1; // frame opacity

function paint() {
  frame.style.transform = `translate3d(${now.x.toFixed(2)}px, ${now.y.toFixed(2)}px, 0) scale(${now.s.toFixed(4)})`;
  frame.style.opacity = String(alpha);
  lb.style.setProperty("--lb-p", String(Math.max(0, Math.min(shade, 1))));
}

const thumbOf = (i: number) => figures[i].querySelector<HTMLElement>(".g-frame")!;

function restBox(i: number) {
  const { width: w, height: h } = items[i];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const narrow = vw < 900;
  const padX = narrow ? 0 : Math.max(96, vw * 0.07);
  const top = narrow ? 56 : 64;
  const bottom = narrow ? 96 : 88;
  const s = Math.min((vw - padX * 2) / w, (vh - top - bottom) / h);
  const width = w * s;
  const height = h * s;
  return { left: (vw - width) / 2, top: top + (vh - top - bottom - height) / 2, width, height };
}

// The transform that makes the resting frame sit exactly over photo i's thumbnail
function thumbT(i: number): T {
  const r = thumbOf(i).getBoundingClientRect();
  return { x: r.left - box.left, y: r.top - box.top, s: r.width / box.width };
}

function place(i: number) {
  box = restBox(i);
  Object.assign(frame.style, {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  });
}

// Shows photo i: the thumbnail's already-loaded file first, then a sharp one on top
function load(i: number) {
  const item = items[i];
  const thumbImg = thumbOf(i).querySelector("img")!;
  const usesAvif = /\.avif(\?|$)/.test(thumbImg.currentSrc);
  frame.style.setProperty("--tone", item.color);
  low.src = thumbImg.currentSrc || thumbImg.src;
  hi.classList.remove("is-loaded");
  hi.onload = () => hi.classList.add("is-loaded");
  hi.removeAttribute("src");
  hi.sizes = `${Math.ceil(box.width)}px`;
  hi.srcset = usesAvif ? item.avif : item.webp;
  hi.alt = item.alt;
  if (hi.complete && hi.naturalWidth) hi.classList.add("is-loaded");

  counter.textContent = pad(i + 1);
  cap.querySelector(".lb-title")!.textContent = item.title;
  cap.querySelector(".lb-meta")!.textContent = item.caption;
  cap.querySelector(".lb-camera")!.textContent = item.camera;

  // warm up the neighbours so flicking through never waits
  for (const j of [i - 1, i + 1]) {
    const n = items[(j + items.length) % items.length];
    const pre = new Image();
    pre.sizes = hi.sizes;
    pre.srcset = usesAvif ? n.avif : n.webp;
  }
}

function hideThumb(i: number, hidden: boolean) {
  thumbOf(i).style.visibility = hidden ? "hidden" : "";
}

// Springs every animated value from where it is now to the target at once.
function animate(to: T, toShade: number, toAlpha: number, params: SpringParams) {
  running?.stop();
  const from = { ...now };
  const fromShade = shade;
  const fromAlpha = alpha;
  running = spring(0, 1, params, (p) => {
    now = { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p), s: lerp(from.s, to.s, p) };
    shade = lerp(fromShade, toShade, p);
    alpha = lerp(fromAlpha, toAlpha, Math.min(p, 1));
    paint();
  });
  return running.done;
}

let scrollbar = 0;
function lockScroll(lock: boolean) {
  if (lock) {
    scrollbar = window.innerWidth - root.clientWidth;
    root.classList.add("lb-open");
    document.body.style.paddingRight = scrollbar ? `${scrollbar}px` : "";
  } else {
    root.classList.remove("lb-open");
    document.body.style.paddingRight = "";
  }
}

async function open(i: number, instant = false) {
  if (isOpen || busy) return;
  busy = true;
  isOpen = true;
  index = i;
  lastFocus = document.activeElement as HTMLElement;
  reveal(figures[i]);
  lockScroll(true);
  lb.hidden = false;
  place(i);
  load(i);
  history.replaceState(null, "", `#p${i + 1}`);

  if (instant || reduceMotion.matches) {
    now = { ...REST };
    shade = 1;
    alpha = instant ? 1 : 0;
    paint();
    hideThumb(i, true);
    lb.classList.add("is-ui");
    closeBtn.focus({ preventScroll: true });
    if (!instant) await animate(REST, 1, 1, { stiffness: 400, damping: 40 });
    busy = false;
    return;
  }

  now = thumbT(i);
  shade = 0;
  alpha = 1;
  paint();
  hideThumb(i, true);
  lb.classList.add("is-ui");
  closeBtn.focus({ preventScroll: true });
  await animate(REST, 1, 1, OPEN);
  busy = false;
}

async function close() {
  if (!isOpen) return;
  busy = true;
  lb.classList.remove("is-ui");
  const i = index;
  // a photo reached by flicking may be far down the page: bring its spot into view first
  const r = thumbOf(i).getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) {
    window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - window.innerHeight / 2, behavior: "instant" });
  }
  reveal(figures[i]);
  if (reduceMotion.matches) {
    await animate(now, 0, 0, { stiffness: 400, damping: 40 });
  } else {
    await animate(thumbT(i), 0, 1, CLOSE);
  }
  hideThumb(i, false);
  lb.hidden = true;
  lockScroll(false);
  isOpen = false;
  busy = false;
  history.replaceState(null, "", location.pathname + location.search);
  (thumbOf(i) as HTMLElement).focus({ preventScroll: true });
  lastFocus = null;
}

async function go(dir: 1 | -1) {
  if (!isOpen || busy) return;
  busy = true;
  const next = (index + dir + items.length) % items.length;
  cap.classList.add("is-swapping");

  if (reduceMotion.matches) {
    await animate({ ...REST }, 1, 0, { stiffness: 500, damping: 45 });
  } else {
    const away = Math.min(window.innerWidth * 0.22, 220);
    await animate({ x: -dir * away, y: 0, s: 0.96 }, 1, 0, SLIDE_OUT);
  }

  hideThumb(index, false);
  index = next;
  hideThumb(index, true);
  place(index);
  load(index);
  history.replaceState(null, "", `#p${index + 1}`);
  cap.classList.remove("is-swapping");

  const enter = reduceMotion.matches ? 0 : Math.min(window.innerWidth * 0.18, 180);
  now = { x: dir * enter, y: 0, s: reduceMotion.matches ? 1 : 0.96 };
  alpha = 0;
  paint();
  busy = false;
  await animate(REST, 1, 1, reduceMotion.matches ? { stiffness: 500, damping: 45 } : SLIDE_IN);
}

// ——— wiring ———
figures.forEach((fig, i) => {
  thumbOf(i).addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    open(i);
  });
});
closeBtn.addEventListener("click", () => close());
prevBtn.addEventListener("click", () => go(-1));
nextBtn.addEventListener("click", () => go(1));

document.addEventListener("keydown", (e) => {
  if (!isOpen) return;
  if (e.key === "Escape") close();
  else if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === "Tab") {
    // keep focus inside the viewer
    const stops = [prevBtn, nextBtn, closeBtn].filter((b) => b.offsetParent);
    const at = stops.indexOf(document.activeElement as HTMLButtonElement);
    e.preventDefault();
    stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
  }
});

window.addEventListener("resize", () => {
  if (!isOpen || busy) return;
  place(index);
  hi.sizes = `${Math.ceil(box.width)}px`;
});

// Drag: sideways flicks to the neighbour, downward (or upward) pulls it home.
interface Drag { id: number; x0: number; y0: number; dx: number; dy: number; t: number; axis: "" | "x" | "y"; vx: number; vy: number }
let drag: Drag | null = null;
let moved = false;

stage.addEventListener("pointerdown", (e) => {
  if (!isOpen || busy || (e.pointerType === "mouse" && e.button !== 0)) return;
  running?.stop();
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, t: e.timeStamp, axis: "", vx: 0, vy: 0 };
  moved = false;
  stage.setPointerCapture(e.pointerId);
});

stage.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0;
  const dy = e.clientY - drag.y0;
  if (!drag.axis) {
    if (Math.hypot(dx, dy) < 8) return;
    drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    moved = true;
  }
  // smoothed velocity in px per second, for telling a flick from a slow drag
  const dt = Math.max(e.timeStamp - drag.t, 1) / 1000;
  drag.vx = drag.vx * 0.5 + ((dx - drag.dx) / dt) * 0.5;
  drag.vy = drag.vy * 0.5 + ((dy - drag.dy) / dt) * 0.5;
  Object.assign(drag, { dx, dy, t: e.timeStamp });

  if (drag.axis === "x") {
    now = { x: dx, y: 0, s: 1 };
    alpha = 1 - Math.min(Math.abs(dx) / window.innerWidth, 0.6);
  } else {
    const pull = Math.min(Math.abs(dy) / window.innerHeight, 1);
    const s = 1 - pull * 0.35;
    // shrink around the photo's centre while it follows the finger
    now = { x: dx * 0.6 + ((1 - s) * box.width) / 2, y: dy + ((1 - s) * box.height) / 2, s };
    shade = 1 - pull * 1.4;
  }
  paint();
});

const endDrag = (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.id) return;
  const { axis, dx, dy, vx, vy } = drag;
  drag = null;
  if (!axis) return;
  if (axis === "x") {
    if (Math.abs(dx) > window.innerWidth * 0.16 || Math.abs(vx) > 650) go(dx < 0 ? 1 : -1);
    else animate(REST, 1, 1, BACK);
  } else if (Math.abs(dy) > window.innerHeight * 0.12 || Math.abs(vy) > 700) {
    close();
  } else {
    animate(REST, 1, 1, BACK);
  }
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

// A plain click on the dark area (not the photo, not after a drag) closes.
stage.addEventListener("click", (e) => {
  if (moved) return;
  if (!(e.target as Element).closest(".lb-frame")) close();
});

// #p3 in the address opens photo 3 directly, so a single photo can be shared
const fromHash = /^#p(\d+)$/.exec(location.hash);
if (fromHash) {
  const i = Number(fromHash[1]) - 1;
  if (items[i]) {
    figures[i].scrollIntoView({ block: "center" });
    open(i, true);
  }
}
