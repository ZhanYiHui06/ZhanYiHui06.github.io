// Image stacks: clicking lifts the front card off the pile, tucks it under
// the back, and lets the next card slide forward. Depth lives in data-depth
// (0 = front, 3 = hidden behind the third card) and CSS does the motion.

const LIFT_MS = 260;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

for (const stack of document.querySelectorAll<HTMLButtonElement>("[data-stack]")) {
  const cards = Array.from(stack.querySelectorAll<HTMLElement>(".stack-card"));
  if (cards.length < 2) continue;

  const baseLabel = stack.getAttribute("aria-label")?.replace(/，第 \d+ 张.*$/, "") ?? "";
  let order = cards.map((_, i) => i); // order[0] is the card on top
  let busy = false;

  const render = () => {
    order.forEach((cardIndex, depth) => {
      cards[cardIndex].dataset.depth = String(Math.min(depth, 3));
    });
    const front = order[0] + 1;
    stack.setAttribute("aria-label", `${baseLabel}，第 ${front} 张，共 ${cards.length} 张，点击换下一张`);
  };

  stack.addEventListener("click", () => {
    if (busy) return;
    const top = cards[order[0]];
    order = [...order.slice(1), order[0]];

    if (reduceMotion.matches) {
      render();
      return;
    }

    // Lift the top card up and away while it is still on top, then drop it
    // in at the back once it is clear of the pile.
    busy = true;
    top.classList.add("is-lifting");
    window.setTimeout(() => {
      top.classList.remove("is-lifting");
      top.classList.add("is-tucking");
      render();
      window.setTimeout(() => {
        top.classList.remove("is-tucking");
        busy = false;
      }, LIFT_MS);
    }, LIFT_MS);
  });
}
