// A soft follower for mouse users: a dot that trails the pointer on a spring
// and opens into a "View" disc over photos. Touch and reduced-motion users
// keep the normal cursor.
import { reduceMotion, type SpringParams } from "./spring";
import { stepSpring } from "../../lib/spring.mjs";

const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
const el = document.querySelector<HTMLElement>(".g-cursor")!;
const FOLLOW: SpringParams = { stiffness: 520, damping: 44 };

if (fine.matches && !reduceMotion.matches) {
  document.documentElement.classList.add("has-cursor");
  el.classList.add("is-hidden");

  let x = -100, y = -100, vx = 0, vy = 0, tx = -100, ty = -100;
  let running = false;
  let last = 0;

  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    for (let t = dt; t > 0; t -= 1 / 240) {
      [x, vx] = stepSpring(x, vx, tx, FOLLOW, Math.min(t, 1 / 240));
      [y, vy] = stepSpring(y, vy, ty, FOLLOW, Math.min(t, 1 / 240));
    }
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    if (Math.abs(tx - x) + Math.abs(ty - y) < 0.1 && Math.abs(vx) + Math.abs(vy) < 1) {
      running = false;
      return;
    }
    requestAnimationFrame(tick);
  };

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    tx = e.clientX;
    ty = e.clientY;
    if (el.classList.contains("is-hidden")) {
      // first sight: appear where the pointer is rather than flying in
      x = tx; y = ty; vx = vy = 0;
      el.classList.remove("is-hidden");
    }
    el.classList.toggle("is-view", !!(e.target as Element).closest?.(".g-frame"));
    if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", () => el.classList.add("is-hidden"));
  window.addEventListener("blur", () => el.classList.add("is-hidden"));
  // the viewer covers the page; forget whatever photo was under the pointer
  document.querySelector(".lb")!.addEventListener("click", () => el.classList.remove("is-view"));
}
