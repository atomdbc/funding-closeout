import { illustration as d } from "./report-card.ts";

export function balance(): string {
  return `<section class="balance" aria-labelledby="balance-title" data-reveal>
  <div class="balance-copy">
    <p class="section-kicker">The problem nobody budgets for</p>
    <h2 id="balance-title">A wallet balance<br>is not a refund.</h2>
    <p>When a program ends, funders look at what's left and ask for it back. But part of that balance is already promised to people who did the work, and some payments were never written up at all.</p>
    <p>Spreadsheets and block explorers show <em>that</em> money moved. They don't say <em>why</em>, or what's still owed. That's the gap this closes.</p>
  </div>
  <div class="balance-art" data-split>
    <div class="wallet-card">
      <span class="wallet-label">Left in the treasury</span>
      <strong class="wallet-amount">${d.balance} <small>USDC</small></strong>
      <span class="wallet-ask">“Can we have this back?”</span>
    </div>
    <div class="split-bar" role="img" aria-label="Of ${d.balance} USDC, ${d.owed} is still owed to a contractor and ${d.returnable} is actually unused.">
      <span class="split split-owed"><b>${d.owed}</b> still owed to the contractor</span>
      <span class="split split-free"><b>${d.returnable}</b> actually unused</span>
    </div>
    <p class="split-foot"><span class="dot dot-why"></span>Plus 3,150.00 USDC paid out that nobody has explained yet.</p>
  </div>
</section>`;
}
