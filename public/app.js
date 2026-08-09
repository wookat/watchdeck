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
  document.querySelectorAll("#site-nav a[href]:not([data-logo]), #bottom-nav a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === path || (href !== "/" && href.length > 1 && path.startsWith(href + "/"))) {
      a.setAttribute("aria-current", "page");
      a.classList.remove("text-slate-400");
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
    const invalid = !el.checkValidity();
    el.classList.toggle("border-amber-500", invalid);
    el.classList.toggle("border-slate-700", !invalid);
  }
});
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-dismiss-key]").forEach((el) => {
    try {
      if (localStorage.getItem("dismiss:" + el.dataset.dismissKey)) el.remove();
      else el.hidden = false;
    } catch {
      el.hidden = false;
    }
  });
});
document.addEventListener("click", (e) => {
  const btn = e.target instanceof Element && e.target.closest("[data-dismiss]");
  if (!btn) return;
  const box = btn.closest("[data-dismiss-key]");
  if (!box) return;
  try {
    localStorage.setItem("dismiss:" + box.dataset.dismissKey, "1");
  } catch {}
  box.remove();
});
document.addEventListener("submit", (e) => {
  const form = e.target;
  if (form instanceof HTMLFormElement && form.dataset.confirm && !window.confirm(form.dataset.confirm)) e.preventDefault();
});
function showToast(msg) {
  let t = document.getElementById("app-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "app-toast";
    t.className = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.remove("toast-show");
  void t.offsetWidth;
  t.classList.add("toast-show");
  clearTimeout(t.dataset.timer);
  t.dataset.timer = setTimeout(() => t.classList.remove("toast-show"), 2400);
}
// episode mark-watched: instant inline feedback (row flash + progress bar + toast) without a reload
document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement) || form.dataset.epWatch === undefined || !window.fetch) return;
  e.preventDefault();
  const btn = form.querySelector("button");
  const undoInput = form.querySelector('input[name="undo"]');
  const marking = undoInput.value !== "1";
  const body = new URLSearchParams(new FormData(form));
  btn.disabled = true;
  fetch(form.action, { method: "POST", body: body, redirect: "manual" })
    .then((res) => {
      if (res.status >= 400) throw new Error("http " + res.status);
      const row = form.closest("li");
      undoInput.value = marking ? "1" : "";
      btn.textContent = marking ? "\u2713 Watched" : "Mark watched";
      btn.className = marking
        ? "rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
        : "rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-violet-500";
      if (row) {
        if (marking) {
          const upTo = row.querySelector('form[action="/api/watch-up-to"]');
          if (upTo) upTo.remove();
        }
        row.classList.remove("ep-flash");
        void row.offsetWidth;
        row.classList.add("ep-flash");
      }
      const bar = document.getElementById("season-progress-bar");
      if (bar) {
        const total = parseInt(bar.dataset.total, 10) || 1;
        const seen = Math.max(0, Math.min(total, (parseInt(bar.dataset.seen, 10) || 0) + (marking ? 1 : -1)));
        bar.dataset.seen = String(seen);
        bar.style.width = Math.round((100 * seen) / total) + "%";
        const txt = document.getElementById("season-progress-text");
        if (txt) txt.textContent = seen + "/" + total + " aired watched";
      }
      showToast(marking ? "\u2713 " + form.dataset.epLabel + " marked as watched" : form.dataset.epLabel + " unmarked");
    })
    .catch(() => form.submit())
    .finally(() => {
      btn.disabled = false;
    });
});

// Live search suggestions (progressive enhancement)
document.addEventListener("DOMContentLoaded", () => {
  if (!window.fetch) return;
  document.querySelectorAll('form[action="/search"] input[name="q"]').forEach((input) => {
    const form = input.form;
    form.classList.add("suggest-anchor");
    const list = document.createElement("ul");
    list.className = "suggest-list hidden";
    list.setAttribute("role", "listbox");
    form.appendChild(list);
    let items = [];
    let active = -1;
    let timer = 0;
    let lastQ = "";

    function close() {
      list.classList.add("hidden");
      list.innerHTML = "";
      items = [];
      active = -1;
    }
    function render(results) {
      list.innerHTML = "";
      active = -1;
      if (!results.length) return close();
      results.forEach((r) => {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        const a = document.createElement("a");
        a.href = r.u;
        a.className = "suggest-item";
        const img = document.createElement("img");
        img.src = "https://image.tmdb.org/t/p/w92" + r.p;
        img.alt = "";
        img.loading = "lazy";
        a.appendChild(img);
        const span = document.createElement("span");
        span.textContent = r.t;
        a.appendChild(span);
        const meta = document.createElement("small");
        meta.textContent = (r.y ? r.y + " · " : "") + (r.m === "tv" ? "TV" : r.m === "person" ? "Person" : "Movie");
        a.appendChild(meta);
        li.appendChild(a);
        list.appendChild(li);
      });
      items = Array.from(list.querySelectorAll("a"));
      list.classList.remove("hidden");
    }
    input.addEventListener("input", () => {
      const q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) return close();
      timer = setTimeout(() => {
        lastQ = q;
        fetch("/api/suggest?q=" + encodeURIComponent(q))
          .then((r) => r.json())
          .then((d) => {
            if (input.value.trim() === lastQ) render(d.results || []);
          })
          .catch(close);
      }, 250);
    });
    input.addEventListener("keydown", (e) => {
      if (list.classList.contains("hidden")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = e.key === "ArrowDown" ? (active + 1) % items.length : (active - 1 + items.length) % items.length;
        items.forEach((a, i) => a.classList.toggle("suggest-active", i === active));
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        location.href = items[active].href;
      } else if (e.key === "Escape") {
        close();
      }
    });
    document.addEventListener("click", (e) => {
      if (!form.contains(e.target)) close();
    });
  });
});
