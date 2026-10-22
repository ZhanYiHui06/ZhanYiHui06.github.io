// The wall: columns of photos covering the whole screen, tiled forever in
// both directions. Drag, scroll or swipe to move it; it glides to a stop on a
// spring, and each column travels at a slightly different speed so the grid
// keeps sliding against itself.
import { stepSpring } from "../../lib/spring.mjs";
import { reduceMotion, type SpringParams } from "./spring";

const root = document.documentElement;
const wall = document.querySelector<HTMLElement>(".wall")!;
const sources = Array.from(document.querySelectorAll<HTMLAnchorElement>(".g-list .g-item"));
const ratios = sources.map((a) => {
  const img = a.querySelector("img")!;
  return Number(img.getAttribute("width")) / Number(img.getAttribute("height"));
});
const n = sources.length;

const DRAG: SpringParams = { stiffness: 420, damping: 42 }; // follows the finger, a hair behind
const GLIDE: SpringParams = { stiffness: 46, damping: 14 }; // after a throw
const WHEEL: SpringParams = { stiffness: 140, damping: 26 };
const SPEEDS = [1, 1.18, 0.86, 1.1, 0.93, 1.22, 0.9];
const THROW = 0.32; // seconds of momentum a release carries

export const wallState = { dragged: false, paused: false };

interface Tile { el: HTMLElement; y: number; photo: number }
interface Column { height: number; speed: number; stagger: number; tiles: Tile[] }

let columns: Column[] = [];
let colW = 0;
let tileW = 0;
let overhang = 0; // how far above the screen a column starts

const mod = (a: number, b: number) => ((a % b) + b) % b;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

function build() {
  wall.textContent = "";
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  colW = vw < 700 ? vw / 2.2 : vw < 1100 ? vw / 3.4 : vw / 4.7;
  const gap = Math.round(Math.max(8, vw * 0.011));
  const w = colW - gap;
  const count = Math.max(Math.ceil(vw / colW) + 2, 4);
  tileW = count * colW;
  overhang = Math.max(...ratios.map((r) => w / r)) + gap;
  const seen = new Set<number>();
  const centre = { x: vw / 2, y: vh / 2 };

  // Deal photos into the shortest column, like laying prints on a table:
  // neighbours rarely match, and every photo turns up about equally often.
  // The deck is walked with a stride so consecutive photos land apart.
  const stride = [5, 7, 3, 1].find((k) => gcd(k, n) === 1) ?? 1;
  columns = Array.from({ length: count }, (_, c) => ({
    height: 0,
    speed: SPEEDS[c % SPEEDS.length],
    stagger: (c % 2) * colW * 0.5 + (c % 3) * colW * 0.14,
    tiles: [] as Tile[],
  }));
  const need = vh + overhang * 2;
  for (let k = 0; columns.some((col) => col.height < need || col.tiles.length < 2); k++) {
    const col = columns.reduce((a, b) => (b.height < a.height ? b : a));
    const photo = (k * stride) % n;
    const h = w / ratios[photo];
    const el = sources[photo].cloneNode(true) as HTMLElement;
    el.classList.add("w-item");
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    for (const s of el.querySelectorAll("img, source")) s.setAttribute("sizes", `${Math.ceil(w)}px`);
    el.querySelector("img")!.loading = "lazy";
    // only the first copy of each photo is reachable by keyboard and screen readers
    if (seen.has(photo)) {
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
    }
    seen.add(photo);
    col.tiles.push({ el, y: col.height, photo });
    wall.append(el);
    col.height += h + gap;
  }
  paint();

  // entrance: tiles pop in outward from the centre of the screen
  for (const col of columns) {
    for (const t of col.tiles) {
      const r = t.el.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - centre.x, r.top + r.height / 2 - centre.y);
      t.el.style.setProperty("--d", `${Math.round(d * 0.55)}ms`);
    }
  }
}

// ——— motion state ———
const pos = { x: 0, y: 0 };
const vel = { x: 0, y: 0 };
const target = { x: 0, y: 0 };
let params = WHEEL;
let running = false;
let last = 0;

function paint() {
  const vh = window.innerHeight;
  columns.forEach((col, c) => {
    const x = mod(c * colW + pos.x, tileW) - colW;
    const shift = pos.y * col.speed + col.stagger;
    for (const t of col.tiles) {
      const y = mod(t.y + shift, col.height) - overhang;
      // tiles far off screen skip the style write
      const visible = y < vh + 50 && y > -overhang - 50;
      if (visible || t.el.dataset.off !== "1") {
        t.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        t.el.dataset.off = visible ? "" : "1";
      }
    }
  });
  // a fast-moving wall leans back slightly
  const speed = Math.hypot(vel.x, vel.y);
  wall.style.setProperty("--squeeze", reduceMotion.matches ? "1" : (1 - Math.min(speed / 9000, 0.07)).toFixed(4));
}

function tick(now: number) {
  let dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;
  for (; dt > 0; dt -= 1 / 240) {
    const h = Math.min(dt, 1 / 240);
    [pos.x, vel.x] = stepSpring(pos.x, vel.x, target.x, params, h);
    [pos.y, vel.y] = stepSpring(pos.y, vel.y, target.y, params, h);
  }
  paint();
  const settled = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) < 0.2 && Math.hypot(vel.x, vel.y) < 2;
  if (settled && !dragging) {
    running = false;
    vel.x = vel.y = 0;
    paint();
    return;
  }
  requestAnimationFrame(tick);
}

function kick(p: SpringParams) {
  params = reduceMotion.matches ? { stiffness: 900, damping: 60 } : p;
  if (wallState.paused || running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(tick);
}

let explored = false;
function explore() {
  if (explored) return;
  explored = true;
  root.classList.add("is-exploring");
}

// ——— input ———
let dragging = false;
let start = { x: 0, y: 0, tx: 0, ty: 0 };
let samples: { x: number; y: number; t: number }[] = [];

wall.addEventListener("pointerdown", (e) => {
  if (wallState.paused || (e.pointerType === "mouse" && e.button !== 0)) return;
  dragging = true;
  wallState.dragged = false;
  start = { x: e.clientX, y: e.clientY, tx: target.x, ty: target.y };
  samples = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
});

wall.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  if (!wallState.dragged && Math.hypot(dx, dy) > 6) {
    wallState.dragged = true;
    // capture only once it is a drag, so a plain click still lands on the photo
    wall.setPointerCapture(e.pointerId);
    root.classList.add("is-dragging");
    explore();
  }
  if (!wallState.dragged) return;
  target.x = start.tx + dx;
  target.y = start.ty + dy;
  samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
  if (samples.length > 6) samples.shift();
  kick(DRAG);
});

const release = (e: PointerEvent) => {
  if (!dragging) return;
  dragging = false;
  root.classList.remove("is-dragging");
  if (!wallState.dragged) return;
  // fling: carry on in the direction of the last few moves, unless the
  // pointer stopped before letting go
  const first = samples[0];
  const lastS = samples[samples.length - 1];
  const dt = Math.max((lastS.t - first.t) / 1000, 0.016);
  if (e.timeStamp - lastS.t < 80 && !reduceMotion.matches) {
    target.x += ((lastS.x - first.x) / dt) * THROW;
    target.y += ((lastS.y - first.y) / dt) * THROW;
  }
  kick(GLIDE);
};
wall.addEventListener("pointerup", release);
wall.addEventListener("pointercancel", release);

// a drag must not also count as a click on the photo under the pointer
wall.addEventListener("click", (e) => {
  if (wallState.dragged) {
    e.preventDefault();
    e.stopImmediatePropagation();
    wallState.dragged = false;
  }
}, true);

window.addEventListener("wheel", (e) => {
  if (wallState.paused) return;
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
  // a mouse wheel only scrolls vertically; shift turns it sideways
  const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit;
  const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * unit;
  target.x -= dx;
  target.y -= dy;
  if (Math.abs(target.y - pos.y) + Math.abs(target.x - pos.x) > 40) explore();
  kick(WHEEL);
}, { passive: false });

document.addEventListener("keydown", (e) => {
  if (wallState.paused || e.target instanceof HTMLButtonElement) return;
  const step = Math.min(window.innerWidth, window.innerHeight) * 0.4;
  const moves: Record<string, [number, number]> = {
    ArrowUp: [0, step], ArrowDown: [0, -step], ArrowLeft: [step, 0], ArrowRight: [-step, 0],
  };
  const m = moves[e.key];
  if (!m) return;
  e.preventDefault();
  target.x += m[0];
  target.y += m[1];
  explore();
  kick(WHEEL);
});

// keyboard focus brings the photo to the middle of the screen
wall.addEventListener("focusin", (e) => {
  const el = (e.target as Element).closest<HTMLElement>(".w-item");
  if (!el || dragging) return;
  const r = el.getBoundingClientRect();
  const col = columns.find((c) => c.tiles.some((t) => t.el === el))!;
  target.x += window.innerWidth / 2 - (r.left + r.width / 2);
  target.y += (window.innerHeight / 2 - (r.top + r.height / 2)) / col.speed;
  explore();
  kick(WHEEL);
});

// ——— hooks for the viewer ———
export function pauseWall(paused: boolean) {
  wallState.paused = paused;
  if (!paused) kick(params);
}

// The on-screen copy of a photo nearest the middle, to fly back to on close
export function tileFor(photo: number): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestD = Infinity;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  for (const col of columns) {
    for (const t of col.tiles) {
      if (t.photo !== photo) continue;
      const r = t.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue;
      const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
      if (d < bestD) { bestD = d; best = t.el; }
    }
  }
  return best;
}

// ——— start ———
build();
if (!reduceMotion.matches) {
  // the wall drifts up into place as it appears
  pos.y = window.innerHeight * 0.35;
  kick(GLIDE);
}
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-ready")));

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    root.classList.add("is-rebuilt");
    build();
  }, 150);
});
