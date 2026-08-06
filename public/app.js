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
document.addEventListener("submit", (e) => {
  const form = e.target;
  if (form instanceof HTMLFormElement && form.dataset.confirm && !window.confirm(form.dataset.confirm)) e.preventDefault();
});
