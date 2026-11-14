// The illustrated closeout report used in the hero and the scroll story.
// Numbers are an illustration of the method, labelled as such on the page.
import { icon } from "./icons.ts";

export interface ReportRow {
  label: string;
  note: string;
  amount: string;
  state: "checked" | "why" | "explained";
}
export const illustration = {
  program: "Community tools grant · Round 3",
  received: "25,000.00",
  rows: [
    {
      label: "Design contractor",
      note: "Milestone 1 · invoice #104",
      amount: "6,000.00",
      state: "explained",
    },
    {
      label: "Security audit",
      note: "Paid through the program DAO",
      amount: "9,500.00",
      state: "explained",
    },
    {
      label: "Community meetup",
      note: "Venue and travel · receipts folder",
      amount: "3,150.00",
      state: "why",
    },
  ] satisfies ReportRow[],
  balance: "6,350.00",
  owed: "5,100.00",
  owedTo: "Final milestone · design contractor",
  returnable: "1,250.00",
};

const stamp = (state: ReportRow["state"]) =>
  `<span class="tag tag-near">${icon.check}Checked on NEAR</span>${state === "why" ? `<span class="tag tag-why">${icon.question}Why?</span>` : ""}`;

export function reportCard(variant: "hero" | "story"): string {
  const d = illustration;
  return `<div class="report report-${variant} s1 s2 s3 s4 s5" data-report="${variant}">
  <div class="report-head">
    <div><p class="report-kicker">Closeout report</p><p class="report-title">${d.program}</p></div>
    <span class="report-pill">Illustration</span>
  </div>
  <div class="report-line report-terms" data-part="terms"><span>Funding received</span><strong>${d.received} <small>USDC</small></strong></div>
  <ul class="report-rows">
    ${d.rows
      .map(
        (
          r,
          i,
        ) => `<li class="report-row row-${r.state}" data-part="row" data-row="${i}">
      <span class="row-dot" aria-hidden="true"></span>
      <span class="row-text"><strong>${r.label}</strong>${r.state === "why" ? `<small class="note-before">No explanation yet</small>` : ""}<small class="note-after">${r.note}</small></span>
      <span class="row-amount">−${r.amount}</span>
      ${stamp(r.state)}
    </li>`,
      )
      .join("")}
  </ul>
  <div class="report-line report-balance" data-part="balance"><span>Left in the wallet</span><strong>${d.balance} <small>USDC</small></strong></div>
  <div class="report-owed" data-part="owed"><span class="owed-pin" aria-hidden="true"></span><span><strong>Still owed · ${d.owed}</strong><small>${d.owedTo}</small></span></div>
  <div class="report-foot" data-part="foot">
    <span>Possibly returnable</span>
    <strong data-count="1250">${d.returnable} <small>USDC</small></strong>
  </div>
  <div class="report-status" data-part="status"><span class="status-blocked">1 payment needs an explanation</span><span class="status-ready">${icon.check}Ready for the funder to review</span></div>
</div>`;
}
