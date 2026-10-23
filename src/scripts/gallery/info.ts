// The "about" panel: what these photos are and where they came from.
const btn = document.querySelector<HTMLButtonElement>(".g-info-btn")!;
const panel = document.querySelector<HTMLElement>(".g-info")!;

function toggle(show: boolean) {
  btn.setAttribute("aria-expanded", String(show));
  if (show) {
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
  } else {
    panel.classList.remove("is-open");
    setTimeout(() => {
      if (!panel.classList.contains("is-open")) panel.hidden = true;
    }, 500);
  }
}

btn.addEventListener("click", () => toggle(!panel.classList.contains("is-open")));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panel.hidden) toggle(false);
});
panel.addEventListener("click", (e) => {
  if (e.target === panel || (e.target as Element).closest(".g-info-close")) toggle(false);
});
