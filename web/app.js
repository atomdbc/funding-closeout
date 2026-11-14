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
