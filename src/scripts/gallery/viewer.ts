// Full-screen viewer. A photo grows out of its tile on the wall (FLIP on a
// spring) over a blurred wash of its own colours; the next one wipes in from
// the side. Flick, scroll, use the arrows or the strip to move; pull down,
// press Esc or click the dark area to put it back on the wall.
import { spring, lerp, reduceMotion, type Running, type SpringParams } from "./spring";
import { pauseWall, tileFor } from "./wall";

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
  blur: string;
}

const OPEN: SpringParams = { stiffness: 150, damping: 20 };
const CLOSE: SpringParams = { stiffness: 220, damping: 28 };
const WIPE: SpringParams = { stiffness: 70, damping: 17 };
const BACK: SpringParams = { stiffness: 300, damping: 26 };
const QUICK: SpringParams = { stiffness: 500, damping: 46 };

const items: Item[] = JSON.parse(document.getElementById("view-data")!.textContent!);
const root = document.documentElement;
const view = document.querySelector<HTMLElement>(".view")!;
const stage = view.querySelector<HTMLElement>(".view-stage")!;
const frames = Array.from(view.querySelectorAll<HTMLElement>(".view-frame"));
const amb = Array.from(view.querySelectorAll<HTMLElement>(".view-amb span"));
const thumbs = Array.from(view.querySelectorAll<HTMLButtonElement>(".view-thumb"));
const counter = view.querySelector<HTMLElement>("[data-view-index]")!;
const num = view.querySelector<HTMLElement>("[data-view-num]")!;
const capTitle = view.querySelector<HTMLElement>(".view-title")!;
const capMeta = view.querySelector<HTMLElement>(".view-meta")!;
const capCamera = view.querySelector<HTMLElement>(".view-camera")!;
const closeBtn = view.querySelector<HTMLButtonElement>(".view-close")!;
const prevBtn = view.querySelector<HTMLButtonElement>(".view-prev")!;
const nextBtn = view.querySelector<HTMLButtonElement>(".view-next")!;
const pad = (n: number) => String(n).padStart(2, "0");
const ease = (name: string, fallback: string) =>
  getComputedStyle(root).getPropertyValue(`--ease-${name}`).trim() || fallback;

let index = -1;
let isOpen = false;
let busy = false;
let running: Running | null = null;
let front = 0; // which of the two frames is showing
let source: HTMLElement | null = null; // the wall tile the viewer opened from
let ambFront = 0;

type Box = { left: number; top: number; width: number; height: number };
const boxes: Box[] = [{ left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 0, height: 0 }];

// Where photo i rests: as large as the screen allows above the caption and strip
function restBox(i: number): Box {
  const { width: w, height: h } = items[i];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const narrow = vw < 900;
  const padX = narrow ? 0 : Math.max(72, vw * 0.06);
  const top = narrow ? 64 : 56;
  const bottom = narrow ? 190 : 132;
  const s = Math.min((vw - padX * 2) / w, (vh - top - bottom) / h);
  const width = w * s;
  const height = h * s;
  return { left: (vw - width) / 2, top: top + (vh - top - bottom - height) / 2, width, height };
}

function place(f: number, i: number) {
  const b = (boxes[f] = restBox(i));
  Object.assign(frames[f].style, {
    left: `${b.left}px`,
    top: `${b.top}px`,
    width: `${b.width}px`,
    height: `${b.height}px`,
  });
}

function load(f: number, i: number, from?: HTMLElement | null) {
  const item = items[i];
  const frame = frames[f];
  const low = frame.querySelector<HTMLImageElement>(".view-low")!;
  const hi = frame.querySelector<HTMLImageElement>(".view-hi")!;
  const thumbImg = from?.querySelector("img");
  const usesAvif = /\.avif(\?|$)/.test(thumbImg?.currentSrc ?? "") || supportsAvif;
  frame.style.setProperty("--tone", item.color);
  low.src = thumbImg?.currentSrc || item.blur;
  hi.classList.remove("is-loaded");
  hi.onload = () => hi.classList.add("is-loaded");
  hi.sizes = `${Math.ceil(boxes[f].width)}px`;
  hi.srcset = usesAvif ? item.avif : item.webp;
  hi.alt = item.alt;
  if (hi.complete && hi.naturalWidth) hi.classList.add("is-loaded");
  for (const j of [i - 1, i + 1]) {
    const nb = items[(j + items.length) % items.length];
    const pre = new Image();
    pre.sizes = hi.sizes;
    pre.srcset = usesAvif ? nb.avif : nb.webp;
  }
}

let supportsAvif = false;
{
  const probe = new Image();
  probe.onload = () => (supportsAvif = probe.width > 0);
  probe.src = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=";
}

function setAmbient(i: number) {
  ambFront = 1 - ambFront;
  amb[ambFront].style.backgroundImage = `url(${items[i].blur})`;
  amb[ambFront].classList.add("is-on");
  amb[1 - ambFront].classList.remove("is-on");
}

function setCaption(i: number, dir = 0) {
  counter.textContent = pad(i + 1);
  capTitle.textContent = items[i].title;
  capMeta.textContent = items[i].caption;
  capCamera.textContent = items[i].camera;
  thumbs.forEach((t, j) => t.setAttribute("aria-current", j === i ? "true" : "false"));
  thumbs[i].scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion.matches ? "auto" : "smooth" });

  // the big numeral rolls over like a counter
  if (!dir || reduceMotion.matches || !num.animate) {
    num.textContent = pad(i + 1);
    return;
  }
  num.animate([{ transform: "none", opacity: 1 }, { transform: `translateY(${-dir * 70}%)`, opacity: 0 }], {
    duration: 220,
    easing: "cubic-bezier(.5,0,.9,.5)",
  }).finished.then(() => {
    num.textContent = pad(i + 1);
    num.animate([{ transform: `translateY(${dir * 70}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: 900,
      easing: ease("pop", "cubic-bezier(.34,1.4,.5,1)"),
    });
  });
}

// transform of a frame relative to its resting box
type T = { x: number; y: number; s: number };
const REST: T = { x: 0, y: 0, s: 1 };
function apply(f: number, t: T, opacity = 1) {
  frames[f].style.transform = `translate3d(${t.x.toFixed(2)}px, ${t.y.toFixed(2)}px, 0) scale(${t.s.toFixed(4)})`;
  frames[f].style.opacity = String(opacity);
}
function toTile(f: number, el: HTMLElement): T {
  const r = el.querySelector(".g-inner")!.getBoundingClientRect();
  const b = boxes[f];
  return { x: r.left - b.left, y: r.top - b.top, s: r.width / b.width };
}
const shade = (v: number) => view.style.setProperty("--shade", String(Math.max(0, Math.min(v, 1))));

function showSource(el: HTMLElement | null, visible: boolean) {
  if (el) el.style.visibility = visible ? "" : "hidden";
}

let lastFocus: Element | null = null;

export async function open(i: number, from: HTMLElement | null, instant = false) {
  if (isOpen || busy) return;
  busy = true;
  isOpen = true;
  index = i;
  source = from;
  lastFocus = document.activeElement;
  pauseWall(true);
  root.classList.add("view-open");
  view.hidden = false;
  front = 0;
  current = { ...REST };
  frames[1].style.visibility = "hidden";
  frames[0].style.visibility = "";
  frames[0].style.clipPath = "";
  place(0, i);
  load(0, i, from);
  setAmbient(i);
  setCaption(i);
  history.replaceState(null, "", `#p${i + 1}`);
  closeBtn.focus({ preventScroll: true });

  if (instant || reduceMotion.matches || !from) {
    apply(0, REST, instant ? 1 : 0);
    shade(1);
    view.classList.add("is-ui");
    if (!instant) {
      running = spring(0, 1, QUICK, (p) => apply(0, REST, Math.min(p, 1)));
      await running.done;
    }
    busy = false;
    return;
  }

  const t0 = toTile(0, from);
  showSource(from, false);
  apply(0, t0);
  shade(0);
  view.classList.add("is-ui");
  running = spring(0, 1, OPEN, (p) => {
    apply(0, { x: lerp(t0.x, 0, p), y: lerp(t0.y, 0, p), s: lerp(t0.s, 1, p) });
    shade(p);
  });
  await running.done;
  busy = false;
}

export async function close() {
  if (!isOpen) return;
  running?.stop();
  busy = true;
  view.classList.remove("is-ui");
  showSource(source, true);
  // whichever copy of this photo is on screen now; the one it opened from may have scrolled away
  const tile = tileFor(index);
  const from = current;
  if (tile && !reduceMotion.matches) {
    const t1 = toTile(front, tile);
    showSource(tile, false);
    running = spring(0, 1, CLOSE, (p) => {
      apply(front, { x: lerp(from.x, t1.x, p), y: lerp(from.y, t1.y, p), s: lerp(from.s, t1.s, p) });
      shade(1 - p);
    });
    await running.done;
    showSource(tile, true);
  } else {
    running = spring(0, 1, QUICK, (p) => {
      apply(front, { x: from.x, y: from.y, s: lerp(from.s, 0.96, p) }, 1 - Math.min(p, 1));
      shade(1 - p);
    });
    await running.done;
  }
  view.hidden = true;
  root.classList.remove("view-open");
  amb.forEach((a) => a.classList.remove("is-on"));
  isOpen = false;
  busy = false;
  source = null;
  pauseWall(false);
  history.replaceState(null, "", location.pathname + location.search);
  const focusTo = tile?.getAttribute("aria-hidden") ? null : tile;
  (focusTo ?? (lastFocus as HTMLElement | null))?.focus?.({ preventScroll: true });
}

let current: T = { ...REST }; // live transform of the front frame (drags)

async function go(to: number, dir: 1 | -1) {
  if (!isOpen || busy || to === index) return;
  busy = true;
  running?.stop();
  const out = front;
  const inn = 1 - front;
  const from = current;
  index = to;
  place(inn, to);
  load(inn, to);
  setAmbient(to);
  setCaption(to, dir);
  history.replaceState(null, "", `#p${to + 1}`);

  const incoming = frames[inn];
  incoming.style.visibility = "";
  incoming.style.zIndex = "2";
  frames[out].style.zIndex = "1";
  apply(inn, REST);

  if (reduceMotion.matches) {
    incoming.style.clipPath = "";
    running = spring(0, 1, QUICK, (p) => {
      apply(inn, REST, Math.min(p, 1));
      apply(out, from, 1 - Math.min(p, 1));
    });
  } else {
    // the new photo is uncovered from the side it comes from, settling from a slight zoom,
    // while the old one drifts the other way and dims
    const drift = Math.min(window.innerWidth * 0.08, 90);
    running = spring(0, 1, WIPE, (p) => {
      const q = Math.max(0, Math.min(p, 1));
      const edge = `${((1 - q) * 100).toFixed(2)}%`;
      incoming.style.clipPath = dir > 0 ? `inset(0 0 0 ${edge})` : `inset(0 ${edge} 0 0)`;
      incoming.style.setProperty("--zoom", (1.14 - 0.14 * p).toFixed(4));
      apply(out, { x: from.x - dir * drift * p, y: from.y, s: from.s }, 1 - q * 0.75);
    });
  }
  await running.done;
  incoming.style.clipPath = "";
  incoming.style.removeProperty("--zoom");
  frames[out].style.visibility = "hidden";
  front = inn;
  current = { ...REST };
  busy = false;
}
const step = (dir: 1 | -1) => go((index + dir + items.length) % items.length, dir);

// ——— wiring ———
document.querySelector(".wall")!.addEventListener("click", (e) => {
  const el = (e.target as Element).closest<HTMLElement>(".w-item");
  if (!el) return;
  const me = e as MouseEvent;
  if (me.metaKey || me.ctrlKey || me.shiftKey) return;
  e.preventDefault();
  open(Number(el.dataset.index), el);
});
closeBtn.addEventListener("click", () => close());
prevBtn.addEventListener("click", () => step(-1));
nextBtn.addEventListener("click", () => step(1));
thumbs.forEach((t, j) => t.addEventListener("click", () => go(j, j > index ? 1 : -1)));

document.addEventListener("keydown", (e) => {
  if (!isOpen) return;
  if (e.key === "Escape") close();
  else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); step(1); }
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); step(-1); }
  else if (e.key === "Tab") {
    const stops = Array.from(view.querySelectorAll<HTMLElement>("button")).filter((b) => b.offsetParent);
    const at = stops.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
  }
});

// scrolling flips through, one photo per gesture
let wheelAcc = 0;
let wheelLock = 0;
view.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (performance.now() < wheelLock) return;
  wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(wheelAcc) > 60) {
    step(wheelAcc > 0 ? 1 : -1);
    wheelAcc = 0;
    wheelLock = performance.now() + 700;
  }
}, { passive: false });

window.addEventListener("resize", () => {
  if (!isOpen || busy) return;
  place(front, index);
});

// Drag: sideways to flip, downward to put the photo back.
interface Drag { id: number; x0: number; y0: number; dx: number; dy: number; t: number; axis: "" | "x" | "y"; vx: number; vy: number }
let drag: Drag | null = null;
let moved = false;

stage.addEventListener("pointerdown", (e) => {
  if (!isOpen || busy || (e.pointerType === "mouse" && e.button !== 0)) return;
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, t: e.timeStamp, axis: "", vx: 0, vy: 0 };
  moved = false;
});

stage.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0;
  const dy = e.clientY - drag.y0;
  if (!drag.axis) {
    if (Math.hypot(dx, dy) < 8) return;
    drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    moved = true;
    stage.setPointerCapture(e.pointerId);
  }
  const dt = Math.max(e.timeStamp - drag.t, 1) / 1000;
  drag.vx = drag.vx * 0.5 + ((dx - drag.dx) / dt) * 0.5;
  drag.vy = drag.vy * 0.5 + ((dy - drag.dy) / dt) * 0.5;
  Object.assign(drag, { dx, dy, t: e.timeStamp });
  const b = boxes[front];
  if (drag.axis === "x") {
    current = { x: dx * 0.6, y: 0, s: 1 };
    apply(front, current, 1 - Math.min(Math.abs(dx) / window.innerWidth, 0.5));
  } else {
    const pull = Math.min(Math.abs(dy) / window.innerHeight, 1);
    const s = 1 - pull * 0.4;
    current = { x: dx * 0.5 + ((1 - s) * b.width) / 2, y: dy + ((1 - s) * b.height) / 2, s };
    apply(front, current);
    shade(1 - pull * 1.5);
  }
});

const endDrag = (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.id) return;
  const { axis, dx, dy, vx, vy } = drag;
  drag = null;
  if (!axis) return;
  const settle = () => {
    const from = current;
    running = spring(0, 1, BACK, (p) => {
      current = { x: lerp(from.x, 0, p), y: lerp(from.y, 0, p), s: lerp(from.s, 1, p) };
      apply(front, current, Math.min(1, 0.5 + p));
      shade(lerp(1 - Math.min(Math.abs(from.y) / window.innerHeight, 1) * 1.5, 1, p));
    });
  };
  if (axis === "x") {
    if (Math.abs(dx) > window.innerWidth * 0.14 || Math.abs(vx) > 600) step(dx < 0 ? 1 : -1);
    else settle();
  } else if (Math.abs(dy) > window.innerHeight * 0.12 || Math.abs(vy) > 700) {
    close();
  } else {
    settle();
  }
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

// clicking the photo moves on; clicking around it goes back to the wall
stage.addEventListener("click", (e) => {
  if (moved) return;
  if ((e.target as Element).closest(".view-frame")) step(1);
  else close();
});

// #p3 in the address opens photo 3 directly, so one photo can be shared
const fromHash = /^#p(\d+)$/.exec(location.hash);
if (fromHash && items[Number(fromHash[1]) - 1]) open(Number(fromHash[1]) - 1, null, true);
