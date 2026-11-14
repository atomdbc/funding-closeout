// Presentation only. No records, storage or financial calculations live here.
const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
root.classList.add("js");

const stages = ["s1", "s2", "s3", "s4", "s5"];
function stage(report, n) {
  if (!report) return;
  stages.forEach((s, i) => report.classList.toggle(s, i < n));
}

// Sticky nav border once the page moves.
const nav = document.querySelector("[data-nav]");
const onScroll = () => nav?.classList.toggle("is-scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Reveal blocks as they enter the viewport.
const revealer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries)
      if (entry.isIntersecting) {
        entry.target.classList.add("is-in");
        revealer.unobserve(entry.target);
      }
  },
  { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
);
document.querySelectorAll("[data-reveal]").forEach((node, i) => {
  if (reduced) return node.classList.add("is-in");
  node.style.transitionDelay = node.classList.contains("who-card")
    ? `${(i % 3) * 90}ms`
    : "";
  revealer.observe(node);
});

// Hero: assemble the report, one beat at a time.
const heroReport = document.querySelector('[data-report="hero"]');
if (heroReport && !reduced) {
  stage(heroReport, 0);
  [350, 1000, 2100, 3300, 4700].forEach((ms, i) =>
    setTimeout(() => stage(heroReport, i + 1), ms),
  );
}

// Story: the pinned report follows the step you are reading.
const storyReport = document.querySelector('[data-report="story"]');
const steps = [...document.querySelectorAll("[data-story-step]")];
if (storyReport && steps.length) {
  stage(storyReport, 1);
  const activate = (step) => {
    const n = Number(step.dataset.storyStep);
    steps.forEach((s) => s.classList.toggle("is-active", s === step));
    stage(storyReport, n);
  };
  const storyObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) activate(entry.target);
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  steps.forEach((s) => storyObserver.observe(s));
}

// One-shot effects for the balance split and the handover stamp.
const once = new IntersectionObserver(
  (entries) => {
    for (const entry of entries)
      if (entry.isIntersecting) {
        entry.target.classList.add(
          entry.target.matches("[data-split]") ? "is-split" : "is-in",
        );
        once.unobserve(entry.target);
      }
  },
  { threshold: 0.45 },
);
document
  .querySelectorAll("[data-split], .packet-art")
  .forEach((n) =>
    reduced ? n.classList.add("is-split", "is-in") : once.observe(n),
  );
