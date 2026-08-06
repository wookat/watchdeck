document.addEventListener("change", (e) => {
  const el = e.target;
  if (el instanceof HTMLSelectElement && el.dataset.autosubmit !== undefined && el.form) el.form.submit();
});
document.addEventListener("submit", (e) => {
  const form = e.target;
  if (form instanceof HTMLFormElement && form.dataset.confirm && !window.confirm(form.dataset.confirm)) e.preventDefault();
});
