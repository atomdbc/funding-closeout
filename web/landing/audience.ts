import { icon } from "./icons.ts";

const people = [
  {
    icon: icon.building,
    who: "Grant program managers",
    line: "Close a round and send the foundation one clear report instead of a spreadsheet and a pile of explorer links.",
    art: "art-a",
  },
  {
    icon: icon.people,
    who: "DAO treasury and ops leads",
    line: "Explain council payouts made through Sputnik DAO, including what's still promised to contributors.",
    art: "art-b",
  },
  {
    icon: icon.spark,
    who: "Builders closing out a grant",
    line: "Show your funder exactly what their money paid for, and why the leftover balance isn't all unused.",
    art: "art-c",
  },
];

export function audience(): string {
  return `<section class="who" id="who" aria-labelledby="who-title">
  <div class="who-head" data-reveal>
    <p class="section-kicker">Who it's for</p>
    <h2 id="who-title">Anyone who has to account for<br>someone else's money.</h2>
  </div>
  <div class="who-grid">
    ${people
      .map(
        (p) => `<article class="who-card ${p.art}" data-reveal>
      <span class="who-icon">${p.icon}</span>
      <h3>${p.who}</h3>
      <p>${p.line}</p>
    </article>`,
      )
      .join("")}
  </div>
</section>`;
}
