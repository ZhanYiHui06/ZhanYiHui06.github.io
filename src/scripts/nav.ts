// Top bar → left rail morph (FLIP) and active-section highlighting.
// Breakpoint must match the `min-width: 1280px` block in global.css.

const SIDE_MQ = window.matchMedia("(min-width: 1280px)");
const REDUCE_MQ = window.matchMedia("(prefers-reduced-motion: reduce)");
const COMPACT_AFTER = 96; // px scrolled before the nav turns into the rail
const FLY_MS = 680;
const DRAW_MS = 720;

const siteNav = document.getElementById("site-nav");

if (siteNav) {
  const brand = siteNav.querySelector<HTMLElement>(".top-mark");
  const navLinks = Array.from(siteNav.querySelectorAll<HTMLAnchorElement>(".top-nav a"));
  const flightItems = [brand, ...navLinks].filter((el): el is HTMLElement => !!el);
  const sections = navLinks
    .map((a) => document.getElementById(a.hash.slice(1)))
    .filter((el): el is HTMLElement => !!el);
  const frameSvg = siteNav.querySelector<SVGSVGElement>(".hand-frame");
  const framePath = frameSvg?.querySelector("path") ?? null;

  let compact = false;
  let morphing = false;

  const wantCompact = () => SIDE_MQ.matches && window.scrollY > COMPACT_AFTER;

  function applyMode(isCompact: boolean) {
    siteNav!.classList.toggle("is-side", isCompact);
    siteNav!.classList.toggle("is-top", !isCompact);
    compact = isCompact;
  }

  // ——— hand-drawn frame ———
  function frameLength() {
    try {
      return framePath?.getTotalLength() || 720;
    } catch {
      return 720;
    }
  }

  function hideFrame() {
    if (!frameSvg || !framePath) return;
    frameSvg.classList.remove("is-drawing", "is-drawn");
    framePath.getAnimations().forEach((a) => a.cancel());
    const len = frameLength();
    framePath.style.strokeDasharray = `${len}`;
    framePath.style.strokeDashoffset = `${len}`;
  }

  function drawFrame(duration: number) {
    if (!frameSvg || !framePath) return;
    framePath.getAnimations().forEach((a) => a.cancel());
    const len = frameLength();
    framePath.style.strokeDasharray = `${len}`;

    if (duration <= 0) {
      framePath.style.strokeDashoffset = "0";
      frameSvg.classList.remove("is-drawing");
      frameSvg.classList.add("is-drawn");
      return;
    }

    frameSvg.classList.remove("is-drawn");
    frameSvg.classList.add("is-drawing");
    framePath.style.strokeDashoffset = `${len}`;
    framePath
      .animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
        duration,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        fill: "forwards",
      })
      .finished.then(() => {
        frameSvg.classList.remove("is-drawing");
        frameSvg.classList.add("is-drawn");
      })
      .catch(() => {}); // cancelled by a newer morph
  }

  // ——— mode switches ———
  function switchInstantly(next: boolean) {
    siteNav!.classList.add("no-anim");
    applyMode(next);
    void siteNav!.offsetWidth;
    siteNav!.classList.remove("no-anim");
    if (next) drawFrame(0);
    else hideFrame();
  }

  function copyTextStyles(src: HTMLElement, dst: HTMLElement) {
    const cs = getComputedStyle(src);
    dst.style.fontFamily = cs.fontFamily;
    dst.style.fontSize = cs.fontSize;
    dst.style.letterSpacing = cs.letterSpacing;
    dst.style.lineHeight = cs.lineHeight;
    dst.style.color = cs.color;
  }

  // Measure start and end layout, then fly copies of the labels between them
  // while the nav box itself transitions underneath.
  function morph(next: boolean) {
    siteNav!.classList.add("no-anim");
    const first = flightItems.map((el) => el.getBoundingClientRect());
    applyMode(next);
    void siteNav!.offsetWidth;
    const last = flightItems.map((el) => el.getBoundingClientRect());
    applyMode(!next);
    void siteNav!.offsetWidth;
    siteNav!.classList.remove("no-anim");

    hideFrame();
    applyMode(next);
    morphing = true;

    const clones = flightItems.map((el, i) => {
      // copy child nodes so the crooked handwritten glyphs survive the flight
      const clone = document.createElement("span");
      clone.className = el.classList.contains("hand") ? "nav-fly hand" : "nav-fly";
      clone.setAttribute("aria-hidden", "true");
      el.childNodes.forEach((n) => clone.appendChild(n.cloneNode(true)));
      copyTextStyles(el, clone);
      clone.style.left = `${first[i].left}px`;
      clone.style.top = `${first[i].top}px`;
      document.body.appendChild(clone);
      el.style.visibility = "hidden";
      clone.animate(
        [
          { transform: "translate3d(0, 0, 0)" },
          { transform: `translate3d(${last[i].left - first[i].left}px, ${last[i].top - first[i].top}px, 0)` },
        ],
        { duration: FLY_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
      );
      return clone;
    });

    if (next) window.setTimeout(() => compact && drawFrame(DRAW_MS), FLY_MS - 40);

    window.setTimeout(() => {
      clones.forEach((c) => c.remove());
      flightItems.forEach((el) => (el.style.visibility = ""));
      morphing = false;
      // the old page ignored scrolls that happened mid-morph, so a quick
      // flick down and back up could leave the rail stuck at the top
      sync();
    }, FLY_MS + 30);
  }

  function sync() {
    if (morphing) return;
    const next = wantCompact();
    if (next === compact) return;
    if (REDUCE_MQ.matches) switchInstantly(next);
    else morph(next);
  }

  // ——— active link ———
  function setActiveLink() {
    const doc = document.documentElement;
    const marker = window.scrollY + window.innerHeight * 0.28;
    const atBottom = window.scrollY + window.innerHeight >= doc.scrollHeight - 2;

    let current = atBottom ? sections[sections.length - 1]?.id : undefined;
    if (!current) {
      for (const section of sections) {
        if (section.getBoundingClientRect().top + window.scrollY <= marker) current = section.id;
      }
    }

    navLinks.forEach((link) => {
      const active = link.hash.slice(1) === current;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      sync();
      setActiveLink();
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  // crossing the breakpoint (resize, zoom, rotate) snaps instead of flying
  SIDE_MQ.addEventListener("change", () => {
    if (!morphing) switchInstantly(wantCompact());
  });

  hideFrame();
  // reloading mid-page starts directly in rail mode, no fly-in on load
  if (wantCompact()) switchInstantly(true);
  setActiveLink();
}
