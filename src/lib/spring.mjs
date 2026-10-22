// Damped-spring motion, shared by the build (CSS easing) and the browser
// (JS-driven drags and the lightbox). Units: stiffness and damping per unit
// mass, time in seconds.

// Steps a spring from `from` toward `to`; returns the new [position, velocity].
// Semi-implicit Euler is stable at the small fixed step used below.
export function stepSpring(x, v, to, { stiffness, damping }, dt) {
  const a = -stiffness * (x - to) - damping * v;
  v += a * dt;
  return [x + v * dt, v];
}

// Samples a 0→1 spring into a CSS linear() easing and the duration it needs,
// so plain CSS transitions get the same overshoot-and-settle feel.
export function springEasing(params, samples = 48) {
  const dt = 1 / 1000;
  const curve = [];
  let x = 0;
  let v = 0;
  let t = 0;
  for (; t < 4; t += dt) {
    curve.push(x);
    [x, v] = stepSpring(x, v, 1, params, dt);
    if (Math.abs(x - 1) < 0.0008 && Math.abs(v) < 0.02) break;
  }
  curve.push(1);
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const value = curve[Math.round((i / samples) * (curve.length - 1))];
    points.push(+value.toFixed(4));
  }
  return { easing: `linear(${points.join(", ")})`, duration: Math.round(t * 1000) };
}
