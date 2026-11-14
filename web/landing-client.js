// Finite presentation only. Product records and all financial calculations stay server-side.
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const animations = new Set();
function reveal(node, duration = 540) {
  if (!node || reduced.matches || document.hidden) return;
  const animation = node.animate(
    [
      { opacity: 0, transform: "translateY(18px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration, easing: "cubic-bezier(.23,1,.32,1)" },
  );
  animations.add(animation);
  animation.finished
    .catch(() => {})
    .finally(() => animations.delete(animation));
}
reveal(document.querySelector(".hero-copy"), 680);
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries)
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        reveal(entry.target);
      }
  },
  { threshold: 0.12 },
);
for (const node of document.querySelectorAll("[data-reveal]"))
  observer.observe(node);
function finish() {
  for (const animation of animations) {
    try {
      animation.finish();
    } catch {
      animation.cancel();
    }
  }
  animations.clear();
}
reduced.addEventListener("change", () => {
  if (reduced.matches) finish();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) finish();
});
window.addEventListener("pagehide", () => {
  observer.disconnect();
  finish();
});
