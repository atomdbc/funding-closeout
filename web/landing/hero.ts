import { icon } from "./icons.ts";
import { reportCard } from "./report-card.ts";

export function hero(): string {
  return `<section class="hero" aria-labelledby="hero-title">
  <div class="hero-copy">
    <p class="eyebrow-chip">For grant programs, DAOs and ecosystem funds that pay in USDC on NEAR</p>
    <h1 id="hero-title">The grant is over.<br><span class="ink-underline">Where did the money go?</span></h1>
    <p class="lede">Funding closeout turns your treasury's payments into a report your funder can actually read: what was paid, what it was for, what's still owed, and what, if anything, should go back.</p>
    <div class="hero-actions">
      <a class="btn" href="/app">Create a review ${icon.arrow}</a>
      <a class="btn btn-ghost" href="#how-it-works">See how it works</a>
    </div>
    <ul class="trust-row" aria-label="Good to know">
      <li>${icon.lock}No wallet connection</li>
      <li>${icon.eye}Reads NEAR, never writes</li>
      <li>${icon.code}Free and open source</li>
    </ul>
  </div>
  <div class="hero-art" aria-label="Illustration of a finished closeout report">
    <div class="hero-paper" aria-hidden="true"></div>
    ${reportCard("hero")}
    <div class="hero-note" aria-hidden="true">${icon.check}<span>Payer, recipient and amount<br>confirmed on NEAR mainnet</span></div>
  </div>
</section>`;
}
