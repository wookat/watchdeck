document.addEventListener("change", (e) => {
  const el = e.target;
  if (el instanceof HTMLSelectElement && el.dataset.autosubmit !== undefined && el.form) el.form.submit();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable)) return;
  const box = document.querySelector('input[type="search"][name="q"]');
  if (box) {
    e.preventDefault();
    box.focus();
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const path = location.pathname;
  document.querySelectorAll("#site-nav a[href]:not([data-logo])").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === path || (href !== "/" && href.length > 1 && path.startsWith(href + "/"))) {
      a.setAttribute("aria-current", "page");
      a.classList.add("text-violet-400", "font-semibold");
    }
  });
});
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  const hint = document.getElementById("pw-hint");
  if (!hint || !el.form || !el.form.contains(hint)) return;
  if (el.id === "auth-password") {
    const left = 8 - el.value.length;
    hint.classList.remove("hidden");
    if (left > 0) {
      hint.textContent = left + " more character" + (left === 1 ? "" : "s") + " needed";
      hint.className = "mt-1.5 text-xs text-amber-400";
    } else {
      hint.textContent = "✓ Password looks good";
      hint.className = "mt-1.5 text-xs text-emerald-400";
    }
  } else if (el.id === "auth-email" && el.value.length > 3) {
    el.classList.toggle("border-amber-500", !el.checkValidity());
  }
});
document.addEventListener("submit", (e) => {
  const form = e.target;
  if (form instanceof HTMLFormElement && form.dataset.confirm && !window.confirm(form.dataset.confirm)) e.preventDefault();
});
