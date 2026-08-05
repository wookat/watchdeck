(function () {
  var dropzone = document.getElementById("dropzone");
  var input = document.getElementById("zipfile");
  var progress = document.getElementById("progress");
  var progressText = document.getElementById("progress-text");
  var progressBar = document.getElementById("progress-bar");
  var progressDetail = document.getElementById("progress-detail");
  var done = document.getElementById("done");
  var doneDetail = document.getElementById("done-detail");
  if (!dropzone) return;

  dropzone.addEventListener("click", function () { input.click(); });
  dropzone.addEventListener("dragover", function (e) { e.preventDefault(); dropzone.classList.add("border-violet-500"); });
  dropzone.addEventListener("dragleave", function () { dropzone.classList.remove("border-violet-500"); });
  dropzone.addEventListener("drop", function (e) {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  input.addEventListener("change", function () { if (input.files.length) handleFile(input.files[0]); });

  function fail(msg) {
    progressText.textContent = "Import failed";
    progressDetail.textContent = msg;
    progressBar.classList.add("bg-red-500");
  }

  async function handleFile(file) {
    dropzone.classList.add("hidden");
    progress.classList.remove("hidden");
    progressText.textContent = "Parsing your export\u2026";
    try {
      var parseRes = await fetch("/api/import/parse", { method: "POST", body: file });
      var parsed = await parseRes.json();
      if (!parseRes.ok) return fail(parsed.error || "Could not parse the file.");

      var shows = parsed.shows || [];
      var movies = parsed.movies || [];
      var totalBatches = Math.ceil(shows.length / 20) + Math.ceil(movies.length / 20);
      var doneBatches = 0;
      var totals = { showsImported: 0, episodesImported: 0, moviesImported: 0, unmatched: 0 };

      progressText.textContent = "Matching your shows & movies\u2026";
      progressDetail.textContent = shows.length + " shows, " + movies.length + " movies found";

      async function send(batch) {
        var r = await fetch("/api/import/batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(batch),
        });
        if (!r.ok) throw new Error("batch failed");
        var out = await r.json();
        totals.showsImported += out.showsImported;
        totals.episodesImported += out.episodesImported;
        totals.moviesImported += out.moviesImported;
        totals.unmatched += out.unmatched;
        doneBatches++;
        progressBar.style.width = Math.round((doneBatches / Math.max(totalBatches, 1)) * 100) + "%";
      }

      for (var i = 0; i < shows.length; i += 20) await send({ shows: shows.slice(i, i + 20), movies: [] });
      for (var j = 0; j < movies.length; j += 20) await send({ shows: [], movies: movies.slice(j, j + 20) });

      progress.classList.add("hidden");
      done.classList.remove("hidden");
      doneDetail.textContent =
        totals.showsImported + " shows, " + totals.episodesImported + " episodes and " + totals.moviesImported +
        " movies imported" + (totals.unmatched ? " (" + totals.unmatched + " titles could not be matched)" : "") + ".";
    } catch (e) {
      fail("Something went wrong. Please try again.");
    }
  }
})();
