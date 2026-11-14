// Small inline SVG icons drawn in an ink-outline style. Decorative only.
const svg = (body: string, size = 24) =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const icon = {
  check: svg('<path d="M5 12.5l4.2 4.2L19 7"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  wallet: svg(
    '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 9h13a2 2 0 0 1 2 2v1.5a2 2 0 0 1-2 2H3"/><circle cx="15.5" cy="11.75" r=".6" fill="currentColor"/>',
  ),
  doc: svg(
    '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  ),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  question: svg(
    '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.8" r=".5" fill="currentColor"/>',
  ),
  lock: svg(
    '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ),
  people: svg(
    '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16 14.6c2.3.1 4 1.4 4.5 4"/>',
  ),
  building: svg(
    '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-5h6v5M3 20h18M8 11h.01M12 11h.01M16 11h.01"/>',
  ),
  spark: svg(
    '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  ),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  code: svg('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'),
  eye: svg(
    '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  ),
};
