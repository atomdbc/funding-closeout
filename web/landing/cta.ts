import { icon } from "./icons.ts";
export function cta(): string {
  return `<section class="final" aria-labelledby="final-title" data-reveal>
  <h2 id="final-title">Close the program.<br>Keep the explanation.</h2>
  <p>Start with the program name and its NEAR treasury account. Everything else, step by step.</p>
  <div class="final-actions"><a class="btn btn-light" href="/app">Create a review ${icon.arrow}</a><a class="btn btn-ghost-light" href="https://github.com/atomdbc/funding-closeout">View the source</a></div>
</section>
<footer class="foot">
  <div><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"><span></span></span>Funding closeout</a><p>Built at NEAR HACKATHON 2026. Reads NEAR mainnet. No wallet connection, no signing, no money movement.</p></div>
  <nav aria-label="Footer"><a href="/app">Your reviews</a><a href="https://github.com/atomdbc/funding-closeout">Source</a><a href="https://github.com/atomdbc/funding-closeout/blob/main/LICENSE">MIT license</a></nav>
</footer>`;
}
