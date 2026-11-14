import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleProgram } from "../src/domain/demo.ts";
import { newNearReview } from "../src/near/review.ts";
import { render } from "../web/view.ts";
import type { Program } from "../src/domain/closeout.ts";
function page(program: Program) {
  return render({ program, revision: 3, token: "test-token" });
}
function explained() {
  const p = exampleProgram(),
    row = p.payments.find((r) => r.id === "pay-unknown")!;
  Object.assign(row, {
    recipient: "Fictional contributor",
    kind: "expense",
    purpose: "Support",
    evidence: "Fictional reference",
    reviewed: true,
  });
  return p;
}
test("workspace prioritizes the actual unresolved payment and retains blocked proposal", () => {
  const html = page(exampleProgram());
  assert.match(html, /Explain 1 payment/);
  assert.match(html, /href="#payment-pay-unknown"/);
  assert.match(html, /proposal-amount">Not established/);
  assert.ok(html.indexOf('id="payments"') < html.indexOf('id="saved-work"'));
  assert.match(html, /Unsigned review output/);
});
test("guidance advances to coverage, then human review without granting approval", () => {
  const p = explained();
  assert.match(page(p), /Confirm the review covers the whole program/);
  p.paymentsComplete = true;
  p.commitmentsComplete = true;
  const html = page(p);
  assert.match(html, /Prepare the human review/);
  assert.match(html, /proposal-amount">150 USDC/);
  assert.match(html, /No approval or transfer has taken place/);
});
test("a NEAR review keeps unknown money unknown and directs the user to terms", () => {
  const html = page(newNearReview("treasury.near"));
  assert.match(html, /Start with the funding terms/);
  assert.match(html, /Not entered/);
  assert.match(html, /proposal-amount">Not established/);
  assert.match(html, /NEAR mainnet · Read-only/);
});
test("a fixed award is not nudged into a refundable policy merely to get a proposal", () => {
  const p = explained();
  p.policy = "fixed-award";
  const html = page(p);
  assert.match(html, /Review whether a return applies/);
  assert.match(html, /Keep the actual terms/);
  assert.match(html, /proposal-amount">Not established/);
});

test("unreviewed commitments and cash discrepancies get actionable guidance", () => {
  const p = explained();
  p.commitments[0]!.reviewed = false;
  assert.match(page(p), /Review what is still owed/);
  p.commitments[0]!.reviewed = true;
  p.balance = "401";
  assert.match(page(p), /Reconcile the reported balance/);
});
test("reworked workspace escapes claims and keeps exact USDC quantities", () => {
  const p = exampleProgram();
  p.name = '<img src=x onerror="alert(1)">';
  p.balance = "400.000001";
  const html = page(p);
  assert.ok(!html.includes(p.name));
  assert.match(html, /&lt;img/);
  assert.match(html, /400\.000001 USDC/);
  assert.ok(html.includes('action="/edit"'));
  assert.ok(html.includes('name="revision" value="3"'));
  assert.match(html, /Local prototype|No funds move through this app/);
});
