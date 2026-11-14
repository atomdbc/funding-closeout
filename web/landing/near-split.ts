import { icon } from "./icons.ts";

export function nearSplit(): string {
  const chain = [
    ["Who paid", "The treasury, or the DAO that paid on its behalf"],
    ["Who received it", "The exact recipient account"],
    ["How much", "Native USDC, exact to six decimals"],
    ["That it went through", "Final, successful execution only"],
  ];
  const you = [
    ["Why it was paid", "Milestone, invoice, event, refund"],
    ["Where the proof is", "Invoice number, contract, folder link"],
    ["What's still owed", "Agreed work that isn't paid yet"],
    ["What the review covers", "The whole program and period"],
  ];
  const list = (rows: string[][]) =>
    rows
      .map(
        ([a, b]) =>
          `<li>${icon.check}<span><strong>${a}</strong><small>${b}</small></span></li>`,
      )
      .join("");
  return `<section class="near" aria-labelledby="near-title">
  <div class="near-head" data-reveal>
    <p class="section-kicker">Why NEAR</p>
    <h2 id="near-title">NEAR proves the money moved.<br>You explain why.</h2>
    <p>Payments on NEAR are public and final, so nobody has to take your word for the numbers. Funding closeout reads them straight from NEAR mainnet and keeps those facts apart from your explanations, so a reviewer can always tell which is which.</p>
  </div>
  <div class="near-columns">
    <article class="near-card near-chain" data-reveal>
      <header><span class="near-badge">NEAR mainnet</span><h3>Checked from the chain</h3></header>
      <ul>${list(chain)}</ul>
      <p class="near-foot">Locked once checked. You can't edit these by hand.</p>
    </article>
    <div class="near-plus" aria-hidden="true">+</div>
    <article class="near-card near-you" data-reveal>
      <header><span class="near-badge near-badge-you">You</span><h3>Explained by the program team</h3></header>
      <ul>${list(you)}</ul>
      <p class="near-foot">Clearly marked as your statement, not a chain fact.</p>
    </article>
  </div>
  <ul class="near-facts" data-reveal>
    <li>${icon.lock}<span><strong>No wallet connection.</strong> Paste a public account and transaction hashes. Nothing to sign.</span></li>
    <li>${icon.eye}<span><strong>Read-only.</strong> The app never sends money, refunds or transactions.</span></li>
    <li>${icon.building}<span><strong>DAO-ready.</strong> Follows Sputnik DAO and relayer payouts, where the signer and the payer differ.</span></li>
  </ul>
</section>`;
}
