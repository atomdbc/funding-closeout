// Shared building blocks for the customer workspace (reviews list + guided steps).
// Presentation only: every calculation comes from src/domain via assess().
import type { Assessment, Program } from "../../src/domain/closeout.ts";
import { money } from "../../src/domain/money.ts";
import { escape as e } from "../view.ts";
import type { ViewState } from "../view.ts";

export const ic = {
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  doc: '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
};
export const svg = (path: string, size = 18) =>
  `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const amount = (v: string | null | undefined) =>
  v === null || v === undefined ? "Not entered" : money(v);

export function page(
  title: string,
  bodyClass: string,
  topRight: string,
  content: string,
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(title)} · Funding closeout</title><link rel="preload" href="/assets/hanken-grotesk-variable.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="/flow.css"><script src="/app.js" defer></script></head><body class="${bodyClass}"><a class="skip" href="#main">Skip to content</a><header class="f-top"><a class="f-brand" href="/"><span class="f-mark" aria-hidden="true"><span></span></span>Funding closeout</a><div class="f-top-right">${topRight}</div></header>${content}</body></html>`;
}

/** Hidden fields every state-changing form needs. */
export function hidden(
  state: ViewState,
  action: string,
  form: string,
  id = "",
) {
  return `<input type="hidden" name="token" value="${e(state.token)}"><input type="hidden" name="revision" value="${state.revision}"><input type="hidden" name="action" value="${action}"><input type="hidden" name="form" value="${form}">${id ? `<input type="hidden" name="id" value="${e(id)}">` : ""}`;
}

export function fieldValue(
  state: ViewState,
  form: string,
  name: string,
  fallback: unknown,
) {
  return e(
    state.error?.form === form
      ? (state.error.values.get(name) ?? "")
      : fallback,
  );
}

export function field(
  state: ViewState,
  form: string,
  name: string,
  label: string,
  fallback: string,
  o: {
    area?: boolean;
    amount?: boolean;
    required?: boolean;
    hint?: string;
    placeholder?: string;
    mono?: boolean;
  } = {},
): string {
  const id = `${form}-${name}`,
    invalid = state.error?.form === form && state.error.field === name;
  const attrs = `id="${id}" name="${name}" autocomplete="off"${o.required ? " required" : ""}${invalid ? ' aria-invalid="true" autofocus' : ""} aria-describedby="${id}-hint"${o.placeholder ? ` placeholder="${e(o.placeholder)}"` : ""}`;
  const control = o.area
    ? `<textarea ${attrs} maxlength="1000" rows="3">${fieldValue(state, form, name, fallback)}</textarea>`
    : o.amount
      ? `<span class="f-amount"><input ${attrs} type="text" inputmode="decimal" maxlength="19" value="${fieldValue(state, form, name, fallback)}"><span aria-hidden="true">USDC</span></span>`
      : `<input ${attrs} type="text" maxlength="${o.mono ? 64 : 150}"${o.mono ? ' class="mono" spellcheck="false"' : ""} value="${fieldValue(state, form, name, fallback)}">`;
  return `<div class="f-field${invalid ? " is-invalid" : ""}"><label for="${id}">${e(label)}</label>${control}<small id="${id}-hint">${invalid ? e(state.error!.message) : e(o.hint ?? (o.amount ? "Numbers only, up to 6 decimals, no commas." : ""))}</small></div>`;
}

export function checkbox(
  state: ViewState,
  form: string,
  name: string,
  label: string,
  yes: boolean,
) {
  const on =
    state.error?.form === form ? state.error.values.get(name) === "on" : yes;
  return `<label class="f-check"><input type="checkbox" name="${name}"${on ? " checked" : ""}><span>${e(label)}</span></label>`;
}

export function select(
  state: ViewState,
  form: string,
  name: string,
  label: string,
  current: string,
  options: [string, string][],
  hint = "",
) {
  const id = `${form}-${name}`,
    chosen =
      state.error?.form === form ? state.error.values.get(name) : current;
  return `<div class="f-field"><label for="${id}">${e(label)}</label><select id="${id}" name="${name}" aria-describedby="${id}-hint">${options.map(([k, l]) => `<option value="${k}"${chosen === k ? " selected" : ""}>${e(l)}</option>`).join("")}</select><small id="${id}-hint">${e(hint)}</small></div>`;
}

export function notices(state: ViewState): string {
  return `${state.message ? `<p class="f-toast" role="status">${svg(ic.check)}${e(state.message)}</p>` : ""}${state.error ? `<div class="f-error" id="form-error" role="alert" tabindex="-1" data-error>${svg(ic.alert)}<div><strong>That wasn't saved.</strong> ${e(state.error.message)} Your entries are still in the form below.</div></div>` : ""}`;
}

export type StepId =
  "terms" | "source" | "payments" | "commitments" | "scope" | "result";
export const stepInfo: Record<StepId, { short: string; title: string }> = {
  terms: { short: "The deal", title: "What was the deal?" },
  source: { short: "Payments", title: "Add the program's payments" },
  payments: { short: "Explain", title: "What was each payment for?" },
  commitments: { short: "Still owed", title: "Is anything still owed?" },
  scope: { short: "Coverage", title: "Does this cover the whole program?" },
  result: { short: "Report", title: "Your closeout report" },
};

export function termsDone(p: Program) {
  return (
    !!p.chainReview?.totalsReported &&
    !!p.termsReference.trim() &&
    p.policy !== "unclear"
  );
}
export function stepStatus(
  p: Program,
  a: Assessment,
  s: StepId,
): "done" | "todo" | "attention" {
  switch (s) {
    case "terms":
      return termsDone(p)
        ? "done"
        : p.chainReview?.totalsReported
          ? "attention"
          : "todo";
    case "source":
      return p.payments.length ? "done" : "todo";
    case "payments":
      return !p.payments.length
        ? "todo"
        : a.unresolvedPaymentIds.length
          ? "attention"
          : "done";
    case "commitments":
      return a.unreviewedCommitmentIds.length
        ? "attention"
        : p.commitments.length || p.commitmentsComplete
          ? "done"
          : "todo";
    case "scope":
      return p.paymentsComplete && p.commitmentsComplete ? "done" : "todo";
    case "result":
      return a.readyForReview ? "done" : "todo";
  }
}

/** Which step fixes a given blocker message from assess(). */
export function blockerStep(text: string): StepId {
  const t = text.toLowerCase();
  if (
    t.includes("payment list covers") ||
    t.includes("commitments have been recorded")
  )
    return "scope";
  if (t.includes("rpc-checked")) return "source";
  if (t.includes("payment")) return "payments";
  if (t.includes("outstanding commitments")) return "commitments";
  if (t.includes("does not cover the remaining commitments"))
    return "commitments";
  return "terms";
}
export const blockerPlain: [RegExp, string][] = [
  [
    /^Enter the approved funding/,
    "Enter the approved amount, what was received and the closing balance.",
  ],
  [
    /^Add the approved funding terms/,
    "Say where the funding terms are written.",
  ],
  [
    /^Confirm whether the terms require/,
    "Choose what the terms say about unused money.",
  ],
  [
    /^Fixed-award terms/,
    "This is a fixed award, so unused money isn't automatically owed back.",
  ],
  [
    /^Confirm the payment list covers/,
    "Confirm the payment list covers the whole program.",
  ],
  [
    /^Confirm all remaining commitments/,
    "Confirm you've listed everything still owed.",
  ],
  [/needs? an explanation/, ""],
  [
    /missing an RPC-checked transfer/,
    "A payment hasn't been checked on NEAR yet.",
  ],
  [
    /^Review the evidence for outstanding/,
    "Finish the details for money still owed (who, what, proof, and tick reviewed).",
  ],
  [
    /do not reconcile/,
    "The numbers don't add up: received − paid out should equal the closing balance.",
  ],
  [
    /^Received funding exceeds/,
    "More was received than approved. Check the amounts.",
  ],
  [
    /does not cover the remaining commitments/,
    "The closing balance is smaller than what's still owed.",
  ],
  [
    /^Expenses and commitments exceed/,
    "Spending plus what's owed is more than the approved amount.",
  ],
];
export function plainBlocker(text: string): string {
  for (const [re, plain] of blockerPlain)
    if (re.test(text))
      return (
        plain ||
        text.replace(
          "an explanation, evidence and review",
          "an explanation (what it was for, proof, and tick reviewed)",
        )
      );
  return text;
}

export function moneyPanel(p: Program, a: Assessment): string {
  const reported = !!p.chainReview?.totalsReported;
  const rows = [
    ["Funding received", a.fundingReceived, "From your records"],
    [
      "Paid out",
      a.totalOutflow,
      `${p.payments.length} payment${p.payments.length === 1 ? "" : "s"} · ${a.unresolvedPaymentIds.length} not explained`,
    ],
    ["Left in the treasury", a.balance, "Your closing balance"],
    [
      "Still owed",
      a.commitments,
      `${p.commitments.length} item${p.commitments.length === 1 ? "" : "s"}`,
    ],
  ];
  const diff = a.cashDifference;
  const reconcile = !reported
    ? `<p class="f-recon is-muted">${svg(ic.info, 16)}Add the deal to see if the numbers add up.</p>`
    : diff === "0"
      ? `<p class="f-recon is-ok">${svg(ic.check, 16)}Received − paid out = closing balance.</p>`
      : `<p class="f-recon is-bad">${svg(ic.alert, 16)}Off by ${e(money(diff!.replace("-", "")))}. Missing a payment, or a figure is wrong?</p>`;
  return `<aside class="f-panel" aria-labelledby="money-title">
  <p class="f-panel-kicker">Money picture</p>
  <h2 id="money-title" class="f-sr">Money picture</h2>
  <dl class="f-sums">${rows.map(([l, v, h]) => `<div><dt>${l}<small>${e(h)}</small></dt><dd${v === null ? ' class="is-empty"' : ""}>${e(amount(v))}</dd></div>`).join("")}</dl>
  ${reconcile}
  <div class="f-result ${a.readyForReview ? "is-ready" : ""}"><span>Possibly returnable</span><strong>${a.returnProposal === null ? "Not yet" : e(money(a.returnProposal))}</strong><small>${a.readyForReview ? "Ready for your funder to review." : `${a.blockers.length} thing${a.blockers.length === 1 ? "" : "s"} to finish first.`}</small></div>
  <p class="f-panel-note">${svg(ic.lock, 14)}Read-only. Nothing is signed or sent.</p>
</aside>`;
}
