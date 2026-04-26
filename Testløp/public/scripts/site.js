(function () {
  const byId = (id) => document.getElementById(id);
  const asNumber = (value) => (value === "" || value == null ? null : Number(value));
  const genderShort = (value) => (value === "Kvinner" ? "K" : value === "Menn" ? "M" : value);
  const groupOrder = {
    "600_Menn": 0,
    "600_Kvinner": 1,
    "1200_Menn": 2,
    "1200_Kvinner": 3,
  };
  const formatDate = (value) => {
    if (!value) return "-";
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}.${month}.${year.slice(2)}` : value;
  };
  const personUrl = (personId) => `${window.__BASE_URL__ || "/"}person/${personId}/`;
  const badgeHtml = (result) => {
    const labels = [];
    if (result.note) labels.push({ text: result.note, type: "warn" });
    if (result.checkStatus && result.checkStatus !== "OK") labels.push({ text: result.checkStatus, type: "bad" });
    if (!result.validToplist) labels.push({ text: "ikke off.", type: "warn" });
    return labels.map((label) => `<span class="badge ${label.type}">${label.text}</span>`).join("");
  };
  const parseJson = (id) => {
    const element = byId(id);
    if (!element) return null;
    return JSON.parse(element.textContent || "null");
  };
  const getParam = (params, ...names) => {
    for (const name of names) {
      const value = params.get(name);
      if (value) return value;
    }
    return null;
  };
  const normalizeAll = (value) => (value === "Alle" ? "all" : value);
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  function setFilterValue(root, name, value) {
    let found = false;
    root.querySelectorAll(`[data-filter-name="${name}"]`).forEach((candidate) => {
      const active = candidate.dataset.filterValue === value;
      found = found || active;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", active ? "true" : "false");
    });
    return found;
  }

  function replaceUrlParams(entries) {
    const url = new URL(window.location.href);
    Object.entries(entries).forEach(([name, value]) => {
      if (value === "" || value == null) url.searchParams.delete(name);
      else url.searchParams.set(name, value);
    });
    window.history.replaceState({}, "", url);
  }

  function initButtonGroups(root, onChange) {
    root.querySelectorAll("[data-filter-name]").forEach((button) => {
      button.addEventListener("click", () => {
        const name = button.dataset.filterName;
        root.querySelectorAll(`[data-filter-name="${name}"]`).forEach((candidate) => {
          candidate.classList.toggle("is-active", candidate === button);
          candidate.setAttribute("aria-pressed", candidate === button ? "true" : "false");
        });
        onChange();
      });
    });
  }

  function selected(root, name) {
    return root.querySelector(`[data-filter-name="${name}"].is-active`)?.dataset.filterValue || "all";
  }

  function initYearViews() {
    document.querySelectorAll("[data-year-view]").forEach((root) => {
      const tbody = root.querySelector("tbody");
      const rows = Array.from(root.querySelectorAll("tbody tr"));
      const search = root.querySelector("[data-search]");
      const count = root.querySelector("[data-visible-count]");
      const contextHeader = root.querySelector("[data-context-header]");

      function groupKey(row) {
        return `${row.dataset.distance}_${row.dataset.gender}`;
      }

      function groupLabel(row) {
        return `${row.dataset.distance} ${genderShort(row.dataset.gender)}`;
      }

      function syncPresetButtons() {
        const distance = selected(root, "distance");
        const gender = selected(root, "gender");
        root.querySelectorAll("[data-filter-preset]").forEach((button) => {
          const active = button.dataset.distanceValue === distance && button.dataset.genderValue === gender;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", active ? "true" : "false");
        });
      }

      function applyUrlState() {
        const params = new URLSearchParams(window.location.search);
        const distance = normalizeAll(getParam(params, "distanse", "distance"));
        const gender = normalizeAll(getParam(params, "kjonn", "gender"));
        const mode = normalizeAll(getParam(params, "visning", "mode"));
        const query = getParam(params, "sok", "q");
        if (distance) setFilterValue(root, "distance", distance);
        if (gender) setFilterValue(root, "gender", gender);
        if (mode) setFilterValue(root, "mode", mode);
        if (query && search) search.value = query;
        syncPresetButtons();
      }

      function updateUrlState() {
        replaceUrlParams({
          distanse: selected(root, "distance"),
          kjonn: selected(root, "gender"),
          visning: selected(root, "mode"),
          sok: (search?.value || "").trim() || null,
        });
      }

      function apply(options = {}) {
        const updateUrl = options.updateUrl !== false;
        const distance = selected(root, "distance");
        const gender = selected(root, "gender");
        const mode = selected(root, "mode");
        const query = (search?.value || "").trim().toLowerCase();
        const exactGroup = distance !== "all" && gender !== "all";
        const candidates = rows.filter((row) => {
          if (distance !== "all" && row.dataset.distance !== distance) return false;
          if (gender !== "all" && row.dataset.gender !== gender) return false;
          if (query && !(row.dataset.search || "").includes(query)) return false;
          return true;
        });
        const bestByPerson = new Map();
        if (mode === "best") {
          candidates.forEach((row) => {
            const person = row.dataset.person;
            const time = asNumber(row.dataset.time);
            if (time == null) return;
            const current = bestByPerson.get(person);
            if (!current || time < asNumber(current.dataset.time)) bestByPerson.set(person, row);
          });
        }
        const visible = candidates
          .filter((row) => mode !== "best" || bestByPerson.get(row.dataset.person) === row)
          .sort((a, b) => {
            const timeA = asNumber(a.dataset.time) ?? Number.POSITIVE_INFINITY;
            const timeB = asNumber(b.dataset.time) ?? Number.POSITIVE_INFINITY;
            if (!exactGroup) {
              const orderA = groupOrder[groupKey(a)] ?? 99;
              const orderB = groupOrder[groupKey(b)] ?? 99;
              if (orderA !== orderB) return orderA - orderB;
            }
            return timeA - timeB || (a.dataset.name || "").localeCompare(b.dataset.name || "");
          });
        if (contextHeader) {
          contextHeader.textContent = exactGroup ? "Plass" : "Gruppe";
          contextHeader.classList.toggle("num", exactGroup);
        }
        rows.forEach((row) => (row.hidden = true));
        visible.forEach((row, index) => {
          row.hidden = false;
          const rankCell = row.querySelector("[data-rank]");
          if (rankCell) {
            rankCell.textContent = exactGroup ? (row.dataset.time ? String(index + 1) : "") : groupLabel(row);
            rankCell.classList.toggle("num", exactGroup);
            rankCell.classList.toggle("group-cell", !exactGroup);
          }
          tbody.appendChild(row);
        });
        if (count) count.textContent = String(visible.length);
        if (updateUrl) updateUrlState();
      }

      applyUrlState();
      initButtonGroups(root, () => {
        syncPresetButtons();
        apply();
      });
      root.querySelectorAll("[data-filter-preset]").forEach((button) => {
        button.addEventListener("click", () => {
          setFilterValue(root, "distance", button.dataset.distanceValue || "all");
          setFilterValue(root, "gender", button.dataset.genderValue || "all");
          syncPresetButtons();
          apply();
        });
      });
      search?.addEventListener("input", () => apply());
      apply({ updateUrl: false });
    });
  }

  function initPeopleSearch() {
    document.querySelectorAll("[data-people-table]").forEach((root) => {
      const input = root.querySelector("[data-search]");
      const tbody = root.querySelector("tbody");
      const rows = Array.from(root.querySelectorAll("tbody tr"));
      const count = root.querySelector("[data-visible-count]");
      const sortButtons = Array.from(root.querySelectorAll("[data-sort-key]"));
      let sortState = { key: "name", type: "text", direction: "asc" };

      function sortValue(row, key, type, direction) {
        const raw = row.dataset[`sort${key.charAt(0).toUpperCase()}${key.slice(1)}`] || "";
        if (type === "number") {
          const value = asNumber(raw);
          if (value == null) return direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
          return value;
        }
        return raw.toLocaleLowerCase("nb-NO");
      }

      function compareRows(a, b) {
        const aValue = sortValue(a, sortState.key, sortState.type, sortState.direction);
        const bValue = sortValue(b, sortState.key, sortState.type, sortState.direction);
        let result = 0;
        if (sortState.type === "number") {
          result = aValue - bValue;
        } else {
          result = String(aValue).localeCompare(String(bValue), "nb-NO");
        }
        if (result === 0) {
          result = String(sortValue(a, "name", "text", "asc")).localeCompare(String(sortValue(b, "name", "text", "asc")), "nb-NO");
        }
        return sortState.direction === "asc" ? result : -result;
      }

      function updateSortHeaders() {
        sortButtons.forEach((button) => {
          const active = button.dataset.sortKey === sortState.key;
          const header = button.closest("th");
          const indicator = button.querySelector(".sort-indicator");
          button.classList.toggle("is-active", active);
          button.setAttribute(
            "aria-label",
            `${button.innerText.trim()} ${active && sortState.direction === "asc" ? "sortert stigende" : active ? "sortert synkende" : "sorter"}`
          );
          if (indicator) indicator.textContent = active ? (sortState.direction === "asc" ? "↑" : "↓") : "";
          if (header) header.setAttribute("aria-sort", active ? (sortState.direction === "asc" ? "ascending" : "descending") : "none");
        });
      }

      function apply() {
        const query = (input?.value || "").trim().toLowerCase();
        let visible = 0;
        rows.sort(compareRows).forEach((row) => {
          const show = !query || (row.dataset.search || "").includes(query);
          row.hidden = !show;
          if (show) visible += 1;
          tbody?.appendChild(row);
        });
        if (count) count.textContent = String(visible);
        updateSortHeaders();
      }

      sortButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const key = button.dataset.sortKey;
          const type = button.dataset.sortType || "text";
          const defaultDirection = button.dataset.sortDefault || "asc";
          const direction = sortState.key === key ? (sortState.direction === "asc" ? "desc" : "asc") : defaultDirection;
          sortState = { key, type, direction };
          apply();
        });
      });

      input?.addEventListener("input", apply);
      apply();
    });
  }

  function initLeaderboards() {
    const root = document.querySelector("[data-leaderboard-page]");
    if (!root) return;
    const results = parseJson("results-data") || [];
    const tbody = root.querySelector("tbody");
    const count = root.querySelector("[data-visible-count]");
    const includeChecksControl = root.querySelector("[data-include-checks]");
    let urlReady = false;

    function applyUrlState() {
      const params = new URLSearchParams(window.location.search);
      const distance = normalizeAll(getParam(params, "distanse", "distance"));
      const gender = normalizeAll(getParam(params, "kjonn", "gender"));
      const limit = getParam(params, "topp", "limit");
      if (distance) setFilterValue(root, "distance", distance);
      if (gender) setFilterValue(root, "gender", gender);
      if (limit) setFilterValue(root, "limit", limit);
      if (includeChecksControl) includeChecksControl.checked = params.get("sjekk") === "1" || params.get("checks") === "1";
    }

    function updateUrlState() {
      replaceUrlParams({
        distanse: selected(root, "distance"),
        kjonn: selected(root, "gender"),
        topp: selected(root, "limit"),
        sjekk: includeChecksControl?.checked ? "1" : null,
      });
    }

    function render() {
      const distance = Number(selected(root, "distance"));
      const gender = selected(root, "gender");
      const limit = Number(selected(root, "limit"));
      const includeChecks = includeChecksControl?.checked;
      const best = new Map();
      results
        .filter((row) => row.distance === distance && row.gender === gender && row.timeSeconds != null)
        .filter((row) => includeChecks || row.validToplist)
        .forEach((row) => {
          const current = best.get(row.personId);
          if (!current || row.timeSeconds < current.timeSeconds) best.set(row.personId, row);
        });
      const rows = Array.from(best.values())
        .sort((a, b) => a.timeSeconds - b.timeSeconds || a.name.localeCompare(b.name))
        .slice(0, limit);
      tbody.innerHTML = rows
        .map(
          (row, index) => `
          <tr>
            <td class="num">${index + 1}</td>
            <td class="name-cell"><a href="${personUrl(row.personId)}">${row.name}</a></td>
            <td class="time num">${row.timeDisplay || "-"}</td>
            <td class="num">${row.year}</td>
            <td>${formatDate(row.date)}</td>
            <td>${row.testlopId || "-"}</td>
            <td><span class="note-list">${badgeHtml(row)}</span></td>
          </tr>`
        )
        .join("");
      if (count) count.textContent = String(rows.length);
      if (urlReady) updateUrlState();
    }

    applyUrlState();
    initButtonGroups(root, render);
    includeChecksControl?.addEventListener("change", render);
    render();
    urlReady = true;
  }

  function bestByPerson(rows) {
    const best = new Map();
    rows.forEach((row) => {
      if (row.timeSeconds == null) return;
      const current = best.get(row.personId);
      if (!current || row.timeSeconds < current.timeSeconds) best.set(row.personId, row);
    });
    return best;
  }

  function deltaLabel(a, b) {
    if (!a || !b) return "";
    const delta = Math.round((a.timeSeconds - b.timeSeconds) * 10) / 10;
    if (delta === 0) return "0,0 sek";
    const value = Math.abs(delta).toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${delta < 0 ? "-" : "+"}${value} sek`;
  }

  function initComparison() {
    const root = document.querySelector("[data-comparison-page]");
    if (!root) return;
    const results = parseJson("results-data") || [];
    const sections = root.querySelector("[data-level-sections]");
    const summary = root.querySelector("[data-level-summary]");
    const countA = root.querySelector("[data-comparison-count-a]");
    const countB = root.querySelector("[data-comparison-count-b]");
    const commonSection = root.querySelector("[data-common-section]");
    const commonBody = root.querySelector("[data-common-body]");
    const commonYearA = root.querySelector("[data-common-year-a]");
    const commonYearB = root.querySelector("[data-common-year-b]");

    function control(name) {
      return root.querySelector(`[name="${name}"]`)?.value;
    }

    function setControl(name, value) {
      const element = root.querySelector(`[name="${name}"]`);
      if (!element || value == null) return;
      const normalized = normalizeMode(normalizeAll(value));
      const option = Array.from(element.options || []).find((candidate) => {
        const candidateValue = normalizeMode(normalizeAll(candidate.value));
        const candidateText = normalizeMode(normalizeAll(candidate.textContent?.trim()));
        return candidateValue === normalized || candidateText === normalized;
      });
      if (option) element.value = option.value;
    }

    function normalizeMode(value) {
      if (value === "best" || value === "arsbeste" || value === "Årsbeste per person") return "yearBest";
      if (value === "Alle resultater") return "all";
      return value;
    }

    function applyUrlState() {
      const params = new URLSearchParams(window.location.search);
      setControl("yearA", getParam(params, "a", "yearA"));
      setControl("yearB", getParam(params, "b", "yearB"));
      setControl("distance", getParam(params, "distanse", "distance"));
      setControl("gender", getParam(params, "kjonn", "gender"));
      setControl("mode", getParam(params, "grunnlag", "mode", "visning"));
    }

    function updateUrlState() {
      replaceUrlParams({
        a: control("yearA"),
        b: control("yearB"),
        distanse: control("distance"),
        kjonn: control("gender"),
        grunnlag: control("mode"),
      });
    }

    function modeLabel(mode) {
      return mode === "yearBest" ? "Årsbeste per person" : "Alle resultater";
    }

    function genderGroups(gender) {
      return gender === "Alle" ? ["Kvinner", "Menn"] : [gender];
    }

    function sortResults(rows) {
      return [...rows].sort((a, b) => {
        const timeA = a.timeSeconds ?? Number.POSITIVE_INFINITY;
        const timeB = b.timeSeconds ?? Number.POSITIVE_INFINITY;
        return timeA - timeB || (a.name || "").localeCompare(b.name || "") || (a.date || "").localeCompare(b.date || "");
      });
    }

    function filteredRows(year, distance, gender) {
      return sortResults(results.filter((row) => {
        if (year && row.year !== Number(year)) return false;
        if (row.distance !== Number(distance)) return false;
        if (row.gender !== gender) return false;
        return row.timeSeconds != null && row.validToplist === true;
      }));
    }

    function bestRowsPerPerson(rows) {
      const best = new Map();
      rows.forEach((row) => {
        const current = best.get(row.personId);
        if (!current || row.timeSeconds < current.timeSeconds) best.set(row.personId, row);
      });
      return sortResults(Array.from(best.values()));
    }

    function comparisonResults(year, distance, gender, mode) {
      const rows = filteredRows(year, distance, gender);
      return mode === "yearBest" ? bestRowsPerPerson(rows) : rows;
    }

    function formatSeconds(value) {
      if (value == null || !Number.isFinite(value)) return "-";
      const sign = value < 0 ? "-" : "";
      const tenths = Math.round(Math.abs(value) * 10);
      const minutes = Math.floor(tenths / 600);
      const remaining = tenths - minutes * 600;
      const seconds = Math.floor(remaining / 10);
      const decimal = remaining % 10;
      const secondText = `${String(seconds).padStart(minutes ? 2 : 1, "0")}${decimal ? `,${decimal}` : ""}`;
      return minutes ? `${sign}${minutes}:${secondText}` : `${sign}${secondText}`;
    }

    function formatDeltaSeconds(value) {
      if (value == null || !Number.isFinite(value)) return "";
      if (Math.abs(value) < 0.05) return "0,0 sek";
      const rounded = Math.round(value * 10) / 10;
      const formatted = Math.abs(rounded).toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      return `${rounded > 0 ? "+" : "-"}${formatted} sek`;
    }

    function formatCountDiff(value) {
      if (!Number.isFinite(value)) return "";
      if (value === 0) return "0";
      return `${value > 0 ? "+" : ""}${value}`;
    }

    function average(values, minimum) {
      if (values.length < minimum) return null;
      return values.slice(0, minimum).reduce((sum, value) => sum + value, 0) / minimum;
    }

    function median(values) {
      if (!values.length) return null;
      const middle = Math.floor(values.length / 2);
      return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    }

    function calculateStats(rows) {
      const times = rows.map((row) => row.timeSeconds).filter((value) => value != null).sort((a, b) => a - b);
      return {
        resultCount: rows.length,
        personCount: new Set(rows.map((row) => row.personId)).size,
        fastest: times[0] ?? null,
        top5Average: average(times, 5),
        top10Average: average(times, 10),
        top20Average: average(times, 20),
        median: median(times),
        top5Cutoff: times.length >= 5 ? times[4] : null,
        top10Cutoff: times.length >= 10 ? times[9] : null,
        top20Cutoff: times.length >= 20 ? times[19] : null,
      };
    }

    const statRows = [
      { key: "resultCount", label: "Resultater", type: "count" },
      { key: "personCount", label: "Personer", type: "count" },
      { key: "fastest", label: "Raskeste", type: "time" },
      { key: "top5Average", label: "Topp 5 snitt", type: "time" },
      { key: "top10Average", label: "Topp 10 snitt", type: "time" },
      { key: "top20Average", label: "Topp 20 snitt", type: "time" },
      { key: "median", label: "Median", type: "time" },
      { key: "top5Cutoff", label: "Siste tid topp 5", type: "time" },
      { key: "top10Cutoff", label: "Siste tid topp 10", type: "time" },
      { key: "top20Cutoff", label: "Siste tid topp 20", type: "time" },
    ];

    function statValue(stats, row) {
      const value = stats[row.key];
      return row.type === "count" ? String(value) : formatSeconds(value);
    }

    function statDiff(statsA, statsB, row) {
      const valueA = statsA[row.key];
      const valueB = statsB[row.key];
      if (valueA == null || valueB == null) return "";
      return row.type === "count" ? formatCountDiff(valueA - valueB) : formatDeltaSeconds(valueA - valueB);
    }

    function diffClass(statsA, statsB, row) {
      if (row.type !== "time") return "";
      const valueA = statsA[row.key];
      const valueB = statsB[row.key];
      if (valueA == null || valueB == null || Math.abs(valueA - valueB) < 0.05) return "";
      return valueA < valueB ? "good" : "bad";
    }

    function resultLink(row) {
      if (!row) return "";
      return `<a href="${personUrl(row.personId)}">${escapeHtml(row.name)}</a>`;
    }

    function resultNameWithMeta(row) {
      if (!row) return "";
      const date = row.date ? formatDate(row.date) : "";
      const meta = [date, row.testlopId].filter(Boolean).map(escapeHtml).join(" · ");
      return `${resultLink(row)}${meta ? `<span class="subtle row-meta">${meta}</span>` : ""}`;
    }

    function noteCell(row) {
      if (!row) return "";
      const badges = badgeHtml(row);
      return badges || `<span class="subtle">-</span>`;
    }

    function renderStatsTable(label, yearA, yearB, statsA, statsB) {
      return `
        <div class="table-wrap level-stats">
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(label)}</th>
                <th class="num">${escapeHtml(yearA)}</th>
                <th class="num">${escapeHtml(yearB)}</th>
                <th class="num">Diff</th>
              </tr>
            </thead>
            <tbody>
              ${statRows
                .map(
                  (row) => `
                    <tr>
                      <td>${row.label}</td>
                      <td class="num time">${statValue(statsA, row)}</td>
                      <td class="num time">${statValue(statsB, row)}</td>
                      <td class="num ${diffClass(statsA, statsB, row)}">${statDiff(statsA, statsB, row)}</td>
                    </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
    }

    function renderSideBySide(yearA, yearB, rowsA, rowsB) {
      const length = Math.max(rowsA.length, rowsB.length);
      const rows = Array.from({ length }, (_, index) => {
        const a = rowsA[index];
        const b = rowsB[index];
        const diff = a && b ? formatDeltaSeconds(a.timeSeconds - b.timeSeconds) : "";
        return `
          <tr>
            <td class="num">${index + 1}</td>
            <td class="time num">${a?.timeDisplay || ""}</td>
            <td class="name-cell">${resultNameWithMeta(a)}</td>
            <td class="time num">${b?.timeDisplay || ""}</td>
            <td class="name-cell">${resultNameWithMeta(b)}</td>
            <td class="num">${diff}</td>
          </tr>`;
      }).join("");
      return `
        <h3 class="subsection-title">Side ved side</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="num">Plass</th>
                <th class="num">${escapeHtml(yearA)}</th>
                <th>Navn</th>
                <th class="num">${escapeHtml(yearB)}</th>
                <th>Navn</th>
                <th class="num">Diff</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="6" class="empty-state">Ingen resultater.</td></tr>`}</tbody>
          </table>
        </div>`;
    }

    function renderCombined(yearA, yearB, rowsA, rowsB) {
      const rows = sortResults([...rowsA.map((row) => ({ ...row, compareYear: yearA })), ...rowsB.map((row) => ({ ...row, compareYear: yearB }))]);
      return `
        <h3 class="subsection-title">Samlet rangert liste</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="num">Rank</th>
                <th class="num">År</th>
                <th>Navn</th>
                <th class="num">Tid</th>
                <th>Dato</th>
                <th>Testløp</th>
                <th>Merknad</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row, index) => `
                    <tr>
                      <td class="num">${index + 1}</td>
                      <td class="num">${escapeHtml(row.compareYear)}</td>
                      <td class="name-cell">${resultLink(row)}</td>
                      <td class="time num">${row.timeDisplay || ""}</td>
                      <td>${formatDate(row.date)}</td>
                      <td>${escapeHtml(row.testlopId || "-")}</td>
                      <td>${noteCell(row)}</td>
                    </tr>`
                )
                .join("") || `<tr><td colspan="7" class="empty-state">Ingen resultater.</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    function renderBlock(group, yearA, yearB, distance, mode) {
      const rowsA = comparisonResults(yearA, distance, group, mode);
      const rowsB = comparisonResults(yearB, distance, group, mode);
      const statsA = calculateStats(rowsA);
      const statsB = calculateStats(rowsB);
      const label = `${distance} m ${group.toLowerCase()}`;
      return {
        rowsA,
        rowsB,
        statsA,
        statsB,
        html: `
          <section class="level-block">
            <h2 class="section-title">${escapeHtml(label)}</h2>
            ${renderStatsTable(label, yearA, yearB, statsA, statsB)}
            ${renderSideBySide(yearA, yearB, rowsA, rowsB)}
            ${renderCombined(yearA, yearB, rowsA, rowsB)}
          </section>`,
      };
    }

    function renderSummary(yearA, yearB, distance, gender, mode, blocks) {
      const totalA = blocks.reduce((sum, block) => sum + block.rowsA.length, 0);
      const totalB = blocks.reduce((sum, block) => sum + block.rowsB.length, 0);
      const first = blocks[0];
      countA.textContent = String(totalA);
      countB.textContent = String(totalB);
      if (!summary) return;
      const title = `${distance} m ${gender === "Alle" ? "alle kjønn" : gender.toLowerCase()} · ${modeLabel(mode)}`;
      if (gender === "Alle") {
        summary.innerHTML = `
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(yearA)} har ${totalA} resultater, ${escapeHtml(yearB)} har ${totalB} resultater.</span>
          <span>Kvinner og menn vises som egne blokker.</span>`;
        return;
      }
      const fastest = first ? `${formatSeconds(first.statsA.fastest)} mot ${formatSeconds(first.statsB.fastest)}` : "-";
      const top10 = first ? `${formatSeconds(first.statsA.top10Average)} mot ${formatSeconds(first.statsB.top10Average)}` : "-";
      summary.innerHTML = `
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(yearA)} har ${totalA} resultater, ${escapeHtml(yearB)} har ${totalB} resultater.</span>
        <span>Raskeste tid: ${fastest}.</span>
        <span>Topp 10-snitt: ${top10}.</span>`;
    }

    function renderCommonRows(yearA, yearB, distance, gender) {
      if (!commonBody) return;
      const groups = genderGroups(gender);
      const rows = [];
      groups.forEach((group) => {
        const a = bestRowsPerPerson(filteredRows(yearA, distance, group));
        const b = bestRowsPerPerson(filteredRows(yearB, distance, group));
        const byA = new Map(a.map((row) => [row.personId, row]));
        const byB = new Map(b.map((row) => [row.personId, row]));
        byA.forEach((rowA, personId) => {
          const rowB = byB.get(personId);
          if (!rowB) return;
          rows.push({ rowA, rowB, group, sort: rowA.timeSeconds ?? rowB.timeSeconds ?? 99999 });
        });
      });
      rows.sort((a, b) => a.sort - b.sort || a.rowA.name.localeCompare(b.rowA.name));
      if (commonYearA) commonYearA.textContent = String(yearA);
      if (commonYearB) commonYearB.textContent = String(yearB);
      if (commonSection) commonSection.hidden = rows.length === 0;
      commonBody.innerHTML = rows
        .map(
          ({ rowA, rowB, group }) => `
            <tr>
              <td class="name-cell">${resultLink(rowA)}</td>
              <td>${genderShort(group)}</td>
              <td class="time num">${rowA.timeDisplay || ""}</td>
              <td class="time num">${rowB.timeDisplay || ""}</td>
              <td class="num">${deltaLabel(rowA, rowB)}</td>
            </tr>`
        )
        .join("");
    }

    function render(updateUrl = true) {
      const yearA = control("yearA");
      const yearB = control("yearB");
      const distance = control("distance");
      const gender = control("gender");
      const mode = control("mode");
      const blocks = genderGroups(gender).map((group) => renderBlock(group, yearA, yearB, distance, mode));
      sections.innerHTML = blocks.map((block) => block.html).join("");
      renderSummary(yearA, yearB, distance, gender, mode, blocks);
      renderCommonRows(yearA, yearB, distance, gender);
      if (updateUrl) updateUrlState();
    }

    applyUrlState();
    root.querySelectorAll("select").forEach((select) => select.addEventListener("change", () => render()));
    render(false);
  }

  window.__BASE_URL__ = document.querySelector("body")?.dataset.baseUrl || "/";
  initYearViews();
  initPeopleSearch();
  initLeaderboards();
  initComparison();
})();
