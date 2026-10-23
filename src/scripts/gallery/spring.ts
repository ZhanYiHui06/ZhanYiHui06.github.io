// requestAnimationFrame driver for the shared spring maths in src/lib/spring.mjs.
import { stepSpring } from "../../lib/spring.mjs";

export interface SpringParams {
  stiffness: number;
  damping: number;
}

export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const STEP = 1 / 240;

export interface Running {
  /** Stops where it is and reports the current velocity, so a new motion can carry it on. */
  stop(): number;
  done: Promise<void>;
}

// Moves a value from `from` to `to` like a spring, calling onUpdate every
// frame. `velocity` is in units per second, e.g. how fast a drag was moving.
export function spring(
  from: number,
  to: number,
  params: SpringParams,
  onUpdate: (x: number) => void,
  velocity = 0
): Running {
  let x = from;
  let v = velocity;
  let frame = 0;
  let last = 0;
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const range = Math.max(Math.abs(to - from), 1e-3);

  const tick = (now: number) => {
    let dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    for (; dt > 0; dt -= STEP) [x, v] = stepSpring(x, v, to, params, Math.min(dt, STEP));
    if (Math.abs(x - to) < range * 0.0015 && Math.abs(v) < range * 0.02) {
      onUpdate(to);
      resolve();
      return;
    }
    onUpdate(x);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      cancelAnimationFrame(frame);
      resolve();
      return v;
    },
    done,
  };
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
