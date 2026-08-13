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
// Inline validation + pending submit state for every form[data-validate] (login/signup/forgot/reset)
function fieldMessage(el) {
  if (el.validity.valueMissing) return el.type === "email" ? "Enter your email address" : "Enter your password";
  if (el.validity.tooShort) {
    const left = el.minLength - el.value.length;
    return left + " more character" + (left === 1 ? "" : "s") + " needed";
  }
  if (!el.checkValidity()) return "Enter a valid email address";
  return "";
}
function renderFieldHint(el) {
  let hint = el.parentElement.querySelector("[data-field-hint]");
  if (!hint) {
    hint = document.createElement("p");
    hint.setAttribute("data-field-hint", "");
    hint.setAttribute("aria-live", "polite");
    el.parentElement.appendChild(hint);
  }
  const msg = fieldMessage(el);
  el.classList.toggle("border-amber-500", !!msg);
  el.classList.toggle("border-slate-700", !msg);
  if (msg) {
    hint.textContent = msg;
    hint.className = "mt-1.5 text-xs text-amber-400";
  } else if (el.autocomplete === "new-password" && el.value) {
    hint.textContent = "✓ Password looks good";
    hint.className = "mt-1.5 text-xs text-emerald-400";
  } else {
    hint.textContent = "";
    hint.className = "hidden";
  }
  return !msg;
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("form[data-validate]").forEach((form) => {
    form.setAttribute("novalidate", "");
    form.addEventListener("input", (e) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && (el.dataset.touched || el.autocomplete === "new-password")) renderFieldHint(el);
    });
    form.addEventListener("submit", (e) => {
      let firstBad = null;
      form.querySelectorAll("input[required]").forEach((el) => {
        el.dataset.touched = "1";
        if (!renderFieldHint(el) && !firstBad) firstBad = el;
      });
      if (firstBad) {
        e.preventDefault();
        firstBad.focus();
        return;
      }
      const btn = form.querySelector("button[data-pending]");
      if (btn) {
        btn.textContent = btn.dataset.pending;
        btn.setAttribute("aria-busy", "true");
        btn.classList.add("opacity-70", "cursor-wait");
        setTimeout(() => {
          btn.disabled = true;
        }, 0);
      }
    });
  });
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
function showToast(msg, undoFn) {
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
  if (undoFn) {
    const u = document.createElement("button");
    u.type = "button";
    u.textContent = "Undo";
    u.className = "toast-undo";
    u.addEventListener("click", () => {
      t.classList.remove("toast-show");
      undoFn();
    });
    t.appendChild(u);
  }
  t.classList.remove("toast-show");
  void t.offsetWidth;
  t.classList.add("toast-show");
  clearTimeout(t.dataset.timer);
  t.dataset.timer = setTimeout(() => t.classList.remove("toast-show"), undoFn ? 5000 : 2400);
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
      // single source of truth: every season counter declares data-season-count and re-derives itself
      document.querySelectorAll("[data-season-count]").forEach((el) => {
        const total = parseInt(el.dataset.total, 10) || 0;
        const seen = Math.max(0, Math.min(total, (parseInt(el.dataset.seen, 10) || 0) + (marking ? 1 : -1)));
        el.dataset.seen = String(seen);
        if (el.dataset.seasonCount === "bar") {
          el.style.width = Math.round((100 * seen) / Math.max(1, total)) + "%";
        } else {
          el.textContent = seen + "/" + total + (el.dataset.suffix || "");
        }
        if (el.dataset.doneClass && el.dataset.todoClass) {
          el.classList.remove(el.dataset.doneClass, el.dataset.todoClass);
          el.classList.add(total > 0 && seen >= total ? el.dataset.doneClass : el.dataset.todoClass);
        }
      });
      showToast(marking ? "\u2713 " + form.dataset.epLabel + " marked as watched" : form.dataset.epLabel + " unmarked", () => form.requestSubmit());
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
