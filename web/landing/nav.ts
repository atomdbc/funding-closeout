export function nav(): string {
  return `<header class="nav" data-nav>
  <a class="brand" href="/" aria-label="Funding closeout home"><span class="brand-mark" aria-hidden="true"><span></span></span>Funding closeout</a>
  <nav aria-label="Main">
    <a href="#how-it-works">How it works</a>
    <a href="#who">Who it's for</a>
    <a href="#faq">Questions</a>
    <a href="https://github.com/atomdbc/funding-closeout">Source</a>
  </nav>
  <div class="nav-actions"><a class="link-quiet" href="/app">Your reviews</a><a class="btn btn-small" href="/app">Create a review</a></div>
</header>`;
}
