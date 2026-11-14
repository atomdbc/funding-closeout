import { render, escape as e } from "./view.ts";
import type { ViewState } from "./view.ts";
import { assess } from "../src/domain/closeout.ts";
import { money } from "../src/domain/money.ts";
export const steps = [
  "terms",
  "source",
  "payments",
  "commitments",
  "scope",
  "result",
] as const;
export type GuideStep = (typeof steps)[number];
export function guideStep(params: URLSearchParams, key = "step"): GuideStep {
  const value = params.get(key) ?? "terms";
  if (params.getAll(key).length > 1 || !steps.includes(value as GuideStep))
    throw new Error(
      "Choose terms, source, payments, commitments, scope or result.",
    );
  return value as GuideStep;
}
export function renderGuide(state: ViewState, step: GuideStep): string {
  const index = steps.indexOf(step),
    p = state.program,
    a = assess(p);
  const titles = [
    "Record the funding terms",
    "Add the program’s payments",
    "Explain the payments",
    "Record what is still owed",
    "Confirm the review scope",
    "Review and export",
  ];
  const descriptions = [
    "Use the actual funding agreement and accounting records. Approved funding, total received and closing balance are reported by you—not inferred from a transfer.",
    "Enter the transaction hash for each USDC outflow from this treasury. Checking a transfer does not connect a wallet or send funds.",
    "Open each payment that needs an explanation. Record what it covered, add an evidence reference and save your review.",
    "Add the unpaid remainder for each obligation, including commitments outside this wallet. Do not count paid amounts again.",
    "Check the complete program and period before confirming. These declarations are your statements, not funder approval.",
    "Review the calculation and anything unresolved. Download the unsigned packet for the person reviewing the program. No refund is executed.",
  ];
  const q = (s: GuideStep) => `/guided?step=${s}`;
  const header = `<div class="guide-heading"><p class="eyebrow">${e(p.name)} · Step ${index + 1} of ${steps.length}</p><h1>${titles[index]}</h1><p class="start-intro">${e(descriptions[index])}</p><ol class="flow-progress" aria-label="Review steps">${steps.map((s, i) => `<li><a data-guide-nav href="${q(s)}"${s === step ? ' aria-current="step"' : ""}><span aria-hidden="true">${i + 1}</span>${["Terms", "Payments", "Explain", "Owed", "Scope", "Review"][i]}</a></li>`).join("")}</ol><p class="guide-state">Conditional return proposal: <strong>${a.returnProposal === null ? "Not established" : e(money(a.returnProposal))}</strong>. ${a.readyForReview ? "For human review only." : "Missing information is not assumed."}</p><p id="unsaved-warning" class="error" role="alert" tabindex="-1" hidden>Save the edited form before moving to another step. Your typing has not been saved yet.</p></div>`;
  const footer = `<nav class="flow-actions guide-actions" aria-label="Step navigation">${index > 0 ? `<a class="button quiet-link" data-guide-nav href="${q(steps[index - 1]!)}">Back</a>` : '<a data-guide-nav href="/app">Back to reviews</a>'}${index < 5 ? `<a class="button" data-guide-nav href="${q(steps[index + 1]!)}">Next: ${["", "Add payments", "Explain payments", "Unpaid obligations", "Scope checks", "Review result"][index + 1]}</a>` : '<a class="button quiet-link" data-guide-nav href="/app">Back to reviews</a>'}</nav><p class="small">Save edits before continuing. <a data-guide-nav href="/workspace">All records / backups</a>. <a data-guide-nav href="/app">Your reviews</a>.</p>`;
  return render({ ...state, openSource: step === "source" })
    .replace("<body>", `<body class="guided" data-step="${step}">`)
    .replace('<div class="app-content">', `<div class="app-content">${header}`)
    .replace("</footer>", `</footer>${footer}`)
    .replaceAll('action="/edit"', `action="/edit?flow=${step}"`)
    .replaceAll('href="#near-check"', `href="${q("source")}"`);
}
