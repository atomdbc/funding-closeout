const qa = [
  [
    "Do I need to connect a wallet?",
    "No. You type a public NEAR account name and paste transaction hashes. There is nothing to sign and no keys are ever asked for.",
  ],
  [
    "Which money does it check?",
    "Native USDC on NEAR mainnet (Circle's contract), including payouts sent through a Sputnik DAO or a relayer. Other tokens aren't counted as USDC.",
  ],
  [
    "Does it send refunds?",
    "No. It tells you what could be returned and why. Any refund is a decision for you and your funder, made outside the app.",
  ],
  [
    "Where is my work saved?",
    "On the hosted app it is encrypted on the server and tied to this browser, not to an account login. Download a backup when you finish.",
  ],
  [
    "Can my funder trust the numbers?",
    "Payment facts come straight from NEAR and are locked. Your explanations are clearly labelled as yours. The report says which is which.",
  ],
  ["Is it open source?", "Yes, MIT licensed. Built at NEAR HACKATHON 2026."],
];
export function faq(): string {
  return `<section class="faq" id="faq" aria-labelledby="faq-title">
  <div class="faq-head" data-reveal><p class="section-kicker">Questions</p><h2 id="faq-title">Straight answers.</h2></div>
  <div class="faq-list" data-reveal>
    ${qa.map(([q, a]) => `<details><summary>${q}<span aria-hidden="true">+</span></summary><p>${a}</p></details>`).join("")}
  </div>
</section>`;
}
