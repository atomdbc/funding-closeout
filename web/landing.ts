import { nav } from "./landing/nav.ts";
import { hero } from "./landing/hero.ts";
import { balance } from "./landing/balance.ts";
import { story } from "./landing/story.ts";
import { nearSplit } from "./landing/near-split.ts";
import { audience } from "./landing/audience.ts";
import { packet } from "./landing/packet.ts";
import { faq } from "./landing/faq.ts";
import { cta } from "./landing/cta.ts";

export function renderLanding(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="description" content="Close a grant or DAO-funded program with a clear report: every NEAR USDC payment checked on chain, explained, with what's still owed. No wallet connection."><title>Funding closeout · Explain where the grant money went</title><link rel="preload" href="/assets/hanken-grotesk-variable.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="/welcome.css"><script src="/landing.js" defer></script></head><body class="landing"><a class="skip" href="#main">Skip to content</a>${nav()}<main id="main">${hero()}${balance()}${story()}${nearSplit()}${audience()}${packet()}${faq()}</main>${cta()}</body></html>`;
}
