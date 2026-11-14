import { icon } from "./icons.ts";

export function packet(): string {
  const sections = [
    ["The deal", "Approved, received, the return terms"],
    ["Every payment", "NEAR-checked facts beside your explanation"],
    ["Still owed", "Who, how much, and the proof"],
    ["What's unresolved", "Listed openly, never hidden"],
    ["The math", "Exact USDC, no rounding"],
  ];
  return `<section class="packet" aria-labelledby="packet-title">
  <div class="packet-art" data-reveal aria-hidden="true">
    <div class="paper paper-back"></div>
    <div class="paper paper-front">
      <p class="paper-kicker">Closeout report · unsigned</p>
      <p class="paper-title">Community tools grant · Round 3</p>
      <ol>${sections.map(([a, b]) => `<li><strong>${a}</strong><span>${b}</span></li>`).join("")}</ol>
      <div class="paper-stamp">For review</div>
    </div>
  </div>
  <div class="packet-copy" data-reveal>
    <p class="section-kicker">What you hand over</p>
    <h2 id="packet-title">One report your funder<br>can read in five minutes.</h2>
    <p>Download a self-contained report and print it to PDF, plus a full backup file you can re-import later. It's a report for review, not an approval to pay: nothing is signed and no money moves.</p>
    <ul class="packet-list">
      <li>${icon.doc}Readable report, printable to PDF</li>
      <li>${icon.download}Full JSON backup of every entry</li>
      <li>${icon.question}Open questions shown, not buried</li>
    </ul>
  </div>
</section>`;
}
