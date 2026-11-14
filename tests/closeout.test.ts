import test from "node:test";
import assert from "node:assert/strict";
import { assess, validateProgram } from "../src/domain/closeout.ts";
import { exampleProgram } from "../src/domain/demo.ts";
import { units, decimal, money } from "../src/domain/money.ts";
import { statement } from "../server/statements.ts";

function reviewed() {
  const p = exampleProgram();
  Object.assign(p.payments[2]!, {
    kind: "expense",
    purpose: "Support session",
    evidence: "DEMO-INVOICE-03",
    reviewed: true,
  });
  p.paymentsComplete = p.commitmentsComplete = true;
  return p;
}

test("the initial 50 USDC outflow stays unknown and blocks a return", () => {
  const a = assess(exampleProgram());
  assert.equal(a.supportedExpenses, "550");
  assert.equal(a.unresolvedOutflow, "50");
  assert.equal(a.commitments, "250");
  assert.equal(a.balance, "400");
  assert.equal(a.cashAfterCommitments, "150");
  assert.equal(a.cashDifference, "0");
  assert.equal(a.returnProposal, null);
  assert.deepEqual(a.unresolvedPaymentIds, ["pay-unknown"]);
});

test("a reviewed, reconciled statement proposes only cash after commitments", () => {
  const a = assess(reviewed());
  assert.equal(a.supportedExpenses, "600");
  assert.equal(a.returnProposal, "150");
  assert.equal(a.readyForReview, true);
  assert.deepEqual(a.blockers, []);
});

for (const field of [
  "purpose",
  "evidence",
  "recipient",
  "reference",
] as const) {
  test(`a review checkbox cannot replace missing payment ${field}`, () => {
    const p = reviewed();
    p.payments[2]![field] = " ";
    assert.equal(assess(p).returnProposal, null);
    assert.equal(assess(p).unresolvedOutflow, "50");
  });
}

test("an explanation without explicit review is not treated as supported", () => {
  const p = reviewed();
  p.payments[2]!.reviewed = false;
  assert.equal(assess(p).returnProposal, null);
});

for (const policy of ["fixed-award", "unclear"] as const) {
  test(`${policy} terms do not create an automatic return obligation`, () => {
    const p = reviewed();
    p.policy = policy;
    assert.equal(assess(p).returnProposal, null);
    assert(assess(p).blockers.some((v) => /terms|award/.test(v)));
  });
}

test("a missing terms reference blocks even when arithmetic reconciles", () => {
  const p = reviewed();
  p.termsReference = "";
  assert.equal(assess(p).returnProposal, null);
});

for (const field of ["paymentsComplete", "commitmentsComplete"] as const) {
  test(`missing ${field} is not inferred from a zero discrepancy`, () => {
    const p = reviewed();
    p[field] = false;
    assert.equal(assess(p).returnProposal, null);
  });
}

test("commitment evidence and review are required and the amount is still reserved", () => {
  const p = reviewed();
  p.commitments[0]!.evidence = "";
  const a = assess(p);
  assert.equal(a.commitments, "250");
  assert.equal(a.returnProposal, null);
  assert.deepEqual(a.unreviewedCommitmentIds, ["due-docs"]);
});

test("a shortfall is reported rather than rounded/clamped into a return", () => {
  const p = reviewed();
  p.commitments[0]!.remaining = "450";
  const a = assess(p);
  assert.equal(a.shortfall, "50");
  assert.equal(a.cashAfterCommitments, "-50");
  assert.equal(a.returnProposal, null);
});

test("a balance mismatch in either direction blocks a proposal", () => {
  for (const balance of ["399.999999", "400.000001"]) {
    const p = reviewed();
    p.balance = balance;
    assert.notEqual(assess(p).cashDifference, "0");
    assert.equal(assess(p).returnProposal, null);
  }
});

test("overfunding and unsupported approval scope are explicit blockers", () => {
  const p = reviewed();
  p.approved = "900";
  assert(assess(p).blockers.some((b) => b.includes("exceeds the approved")));
});

test("already-returned funds are not counted as program expenses or returned twice", () => {
  const p = reviewed();
  p.payments[1]!.kind = "returned";
  const a = assess(p);
  assert.equal(a.supportedReturns, "250");
  assert.equal(a.supportedExpenses, "350");
  assert.equal(a.totalOutflow, "600");
  assert.equal(a.returnProposal, "150");
});

test("zero is a valid reviewed proposal, unlike unknown", () => {
  const p = reviewed();
  p.commitments[0]!.remaining = "400";
  assert.equal(assess(p).returnProposal, "0");
});

test("exact millionths survive accounting, display and export", () => {
  const p = reviewed();
  p.approved = p.received = "1.000003";
  p.balance = "0.000002";
  p.payments = [{ ...p.payments[0]!, amount: "1.000001" }];
  p.commitments[0]!.remaining = "0.000001";
  const a = assess(p);
  assert.equal(a.returnProposal, "0.000001");
  assert.equal(a.cashDifference, "0");
  assert.equal(money(a.returnProposal!), "0.000001 USDC");
  assert.equal(statement(p, 1).inputs.balance, "0.000002");
});

for (const value of [
  "-1",
  "1e3",
  "NaN",
  "Infinity",
  "1,000",
  "0.0000001",
  "01",
  "",
  " 1",
  "1000000000000",
]) {
  test(`reject invalid or out-of-range amount ${JSON.stringify(value)}`, () =>
    assert.throws(() => units(value)));
}

test("duplicate payment references and record IDs are rejected", () => {
  const p = reviewed();
  p.payments[2]!.reference = p.payments[0]!.reference;
  assert.throws(() => validateProgram(p), /already recorded/);
  p.payments[2]!.reference = "another";
  p.payments[2]!.id = p.payments[0]!.id;
  assert.throws(() => assess(p), /unique/);
});

test("the engine rejects mixed assets and unknown classifications", () => {
  const p = reviewed();
  assert.throws(
    () => assess({ ...p, asset: "NEAR" } as unknown as typeof p),
    /one asset/,
  );
  assert.throws(
    () => assess({ ...p, policy: "refund-always" } as unknown as typeof p),
    /policy/,
  );
  p.payments[0]!.kind = "internal-transfer" as (typeof p.payments)[0]["kind"];
  assert.throws(() => assess(p), /classification/);
});

test("every assessed outflow is partitioned exactly; arithmetic never mutates inputs", () => {
  for (let i = 0; i < 100; i++) {
    const p = reviewed(),
      original = JSON.stringify(p);
    p.payments[0]!.amount = decimal(BigInt(i) * 12345n);
    const before = JSON.stringify(p),
      a = assess(p);
    assert.equal(
      units(a.supportedExpenses) +
        units(a.supportedReturns) +
        units(a.unresolvedOutflow),
      units(a.totalOutflow),
    );
    assert.equal(JSON.stringify(p), before);
    assert(original.length > 0);
  }
});

test("export keeps blockers, is unsigned, and binds the complete exact snapshot", () => {
  const p = exampleProgram(),
    s = statement(p, 1);
  assert.equal(s.exampleData, true);
  assert.equal(s.network, "none");
  assert.equal(s.approval, "not-signed");
  assert.equal(s.assessment.returnProposal, null);
  assert(s.assessment.blockers.length > 0);
  assert.match(s.digestSha256, /^[a-f0-9]{64}$/);
  assert.equal(statement(p, 1).digestSha256, s.digestSha256);
  p.payments[2]!.purpose = "Changed";
  assert.notEqual(statement(p, 1).digestSha256, s.digestSha256);
  assert.equal(s.inputs.payments[2]!.purpose, "");
});
