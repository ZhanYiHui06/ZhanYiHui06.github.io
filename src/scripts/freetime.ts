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
