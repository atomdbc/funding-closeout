import { icon } from "./icons.ts";
import { reportCard } from "./report-card.ts";

const steps = [
  {
    t: "Write down the deal",
    p: "Enter what was approved, what actually arrived and whether unused money has to go back. Take it straight from your grant agreement. Nothing is guessed from the blockchain.",
    k: "2 minutes · your agreement",
  },
  {
    t: "Paste each payment. NEAR confirms it.",
    p: "Copy a transaction hash from your treasury's history. We read NEAR mainnet and lock in who paid, who received it, the exact USDC amount and that it actually went through. Payouts made through a Sputnik DAO work too.",
    k: "Read-only · no wallet",
  },
  {
    t: "Say what each payment was for",
    p: "Add a line like “Milestone 1, invoice #104” and where the proof lives. Anything you haven't explained is flagged, never quietly counted as fine.",
    k: "Your words, kept separate",
  },
  {
    t: "List what's still owed",
    p: "Record work that's been agreed but not paid yet. Now the leftover balance tells the truth: some of it is promised, some of it is free.",
    k: "Owed is not unused",
  },
  {
    t: "Hand over a report people can read",
    p: "When nothing is missing, you get a clean closeout: the deal, every payment and its reason, what's owed and what could be returned. Print it to PDF or keep the full backup file.",
    k: "Unsigned · ready to review",
  },
];

export function story(): string {
  return `<section class="story" id="how-it-works" aria-labelledby="story-title">
  <div class="story-intro" data-reveal>
    <p class="section-kicker">How it works</p>
    <h2 id="story-title">Five steps from “we spent it” to “here's exactly how.”</h2>
  </div>
  <div class="story-grid">
    <ol class="story-steps">
      ${steps
        .map(
          (
            s,
            i,
          ) => `<li class="story-step${i === 0 ? " is-active" : ""}" data-story-step="${i + 1}">
        <span class="step-num">${i + 1}</span>
        <div><h3>${s.t}</h3><p>${s.p}</p><span class="step-key">${s.k}</span></div>
      </li>`,
        )
        .join("")}
    </ol>
    <div class="story-stage" aria-hidden="true">
      <div class="story-sticky">${reportCard("story")}</div>
    </div>
  </div>
  <div class="story-cta" data-reveal><a class="btn" href="/app">Create a review ${icon.arrow}</a><span>Free. No sign-up, no wallet.</span></div>
</section>`;
}
