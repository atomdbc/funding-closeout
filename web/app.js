// Progressive enhancement only: native forms and all calculations work without JavaScript.
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const button = event.submitter;
  if (button instanceof HTMLButtonElement) {
    // Keep name/value in the native submission; aria-disabled alone preserves the submitted intent.
    if (form.dataset.sending) {
      event.preventDefault();
      return;
    }
    form.dataset.sending = "true";
    button.dataset.originalLabel = button.textContent;
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("aria-busy", "true");
    button.textContent = button.dataset.busyLabel ?? "Saving…";
  }
});
window.addEventListener("pageshow", () => {
  for (const form of document.querySelectorAll("form"))
    delete form.dataset.sending;
  for (const button of document.querySelectorAll("button[aria-busy]")) {
    button.removeAttribute("aria-busy");
    button.removeAttribute("aria-disabled");
    if (button.dataset.originalLabel)
      button.textContent = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
});
const error =
  document.querySelector("[aria-invalid='true']") ??
  document.querySelector("[data-error]");
if (error instanceof HTMLElement) error.focus();
// Prevent a guided Next/Back action from silently discarding unsubmitted edits.
if (document.body.classList.contains("guided")) {
  const dirty = new Set();
  document.addEventListener("input", (event) => {
    const field = event.target;
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLSelectElement
    ) {
      if (field.form && field.type !== "hidden") dirty.add(field.form);
    }
  });
  document.addEventListener("change", (event) => {
    const field = event.target;
    if (
      (field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement) &&
      field.form
    )
      dirty.add(field.form);
  });
  document.addEventListener("submit", (event) => {
    if (!event.defaultPrevented) dirty.delete(event.target);
  });
  document.addEventListener("click", (event) => {
    const link =
      event.target instanceof Element
        ? event.target.closest("[data-guide-nav], .flow-progress a")
        : null;
    if (!link || !dirty.size) return;
    event.preventDefault();
    const warning = document.querySelector("#unsaved-warning");
    if (warning instanceof HTMLElement) {
      warning.hidden = false;
      warning.focus();
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty.size) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}
// Location-based navigation only: no animation or client-side accounting on repeated form work.
const reviewNav = document.querySelector(".section-nav");
function markSection() {
  if (!reviewNav) return;
  let id;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const target = document.getElementById(id);
  const section = target?.closest("section, aside")?.id ?? "terms";
  for (const link of reviewNav.querySelectorAll("a[href^='#']")) {
    if (link.getAttribute("href") === `#${section}`)
      link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
reviewNav?.addEventListener("click", (event) => {
  const link =
    event.target instanceof Element ? event.target.closest("a") : null;
  if (link?.getAttribute("href") === "#near-check") {
    const details = document.querySelector("#near-check > details");
    if (details instanceof HTMLDetailsElement) details.open = true;
  }
});
window.addEventListener("hashchange", markSection);
markSection();
const picker = document.querySelector("[data-statement-file]");
if (picker instanceof HTMLInputElement)
  picker.addEventListener("change", async () => {
    const file = picker.files?.[0],
      target = document.querySelector("#statement-source"),
      status = document.querySelector("[data-file-status]");
    if (!file || !(target instanceof HTMLTextAreaElement) || !status) return;
    target.value = "";
    if (file.size > 262144) {
      status.textContent =
        "Choose a JSON statement no larger than 256 KiB. Nothing was imported.";
      return;
    }
    try {
      const content = await file.text();
      if (picker.files?.[0] !== file) return;
      target.value = content;
      status.textContent =
        "File loaded locally. Review the replacement confirmation, then import it as unverified claims.";
    } catch {
      status.textContent =
        "The selected file could not be read. Try again or paste the exported JSON.";
    }
  });
