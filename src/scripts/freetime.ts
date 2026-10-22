// Free-time cells: months already gone are dropped (the page is only rebuilt
// on push, so a stale "26.11" would otherwise linger), and tapping a cell opens
// its bubble on touch screens, where there is no hover. Tapping it again or
// anywhere else closes it.

const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

for (const block of document.querySelectorAll<HTMLElement>("[data-freetime]")) {
  for (const cell of block.querySelectorAll<HTMLElement>(".ft-cell")) {
    if ((cell.dataset.month ?? "") < thisMonth) cell.remove();
  }
  if (!block.querySelector(".ft-cell")) block.remove();
}

// Slide each bubble sideways just enough to stay inside the page column;
// its tail moves the other way so it still points at the cell.
const placeBubbles = () => {
  for (const block of document.querySelectorAll<HTMLElement>("[data-freetime]")) {
    const area = block.closest(".page")?.getBoundingClientRect() ?? block.getBoundingClientRect();
    for (const cell of block.querySelectorAll<HTMLElement>(".ft-cell")) {
      const bubble = cell.querySelector<HTMLElement>(".ft-bubble");
      if (!bubble) continue;
      const c = cell.getBoundingClientRect();
      const half = bubble.offsetWidth / 2;
      const mid = c.left + c.width / 2;
      const room = Math.max(0, half - 16); // the tail must stay on the bubble
      let shift = 0;
      if (mid - half < area.left) shift = area.left - (mid - half);
      else if (mid + half > area.right) shift = area.right - (mid + half);
      shift = Math.max(-room, Math.min(room, shift));
      cell.style.setProperty("--shift", `${shift}px`);
    }
  }
};
placeBubbles();
window.addEventListener("resize", placeBubbles);
document.fonts?.ready.then(placeBubbles);

const closeAll = (except?: Element) => {
  for (const open of document.querySelectorAll(".ft-cell.is-open")) {
    if (open !== except) open.classList.remove("is-open");
  }
};

document.addEventListener("click", (e) => {
  const box = (e.target as Element).closest(".ft-box");
  const cell = box?.closest(".ft-cell") ?? undefined;
  closeAll(cell);
  cell?.classList.toggle("is-open");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAll();
});
