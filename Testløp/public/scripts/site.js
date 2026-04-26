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
    const years = parseJson("years-data") || [];
    const abBody = root.querySelector("[data-ab-body]");
    const matrixBody = root.querySelector("[data-matrix-body]");
    const matrixHead = root.querySelector("[data-matrix-head]");

    function control(name) {
      return root.querySelector(`[name="${name}"]`)?.value;
    }

    function setControl(name, value) {
      const element = root.querySelector(`[name="${name}"]`);
      if (!element || value == null) return;
      const normalized = normalizeAll(value);
      const option = Array.from(element.options || []).find((candidate) => candidate.value === normalized || candidate.textContent === value);
      if (option) element.value = option.value;
    }

    function applyUrlState() {
      const params = new URLSearchParams(window.location.search);
      setControl("yearA", getParam(params, "a", "yearA"));
      setControl("yearB", getParam(params, "b", "yearB"));
      setControl("distance", getParam(params, "distanse", "distance"));
      setControl("gender", getParam(params, "kjonn", "gender"));
      setControl("matrixDistance", getParam(params, "matriseDistanse", "matrixDistance"));
      setControl("matrixGender", getParam(params, "matriseKjonn", "matrixGender"));
    }

    function updateUrlState() {
      replaceUrlParams({
        a: control("yearA"),
        b: control("yearB"),
        distanse: control("distance"),
        kjonn: control("gender"),
        matriseDistanse: control("matrixDistance"),
        matriseKjonn: control("matrixGender"),
      });
    }

    function filteredRows(year, distance, gender) {
      return results.filter((row) => {
        if (year && row.year !== Number(year)) return false;
        if (row.distance !== Number(distance)) return false;
        if (gender !== "Alle" && row.gender !== gender) return false;
        return row.timeSeconds != null;
      });
    }

    function renderAb() {
      const yearA = control("yearA");
      const yearB = control("yearB");
      const distance = control("distance");
      const gender = control("gender");
      const a = bestByPerson(filteredRows(yearA, distance, gender));
      const b = bestByPerson(filteredRows(yearB, distance, gender));
      const personIds = Array.from(new Set([...a.keys(), ...b.keys()]));
      const rows = personIds
        .map((personId) => {
          const rowA = a.get(personId);
          const rowB = b.get(personId);
          const name = rowA?.name || rowB?.name || personId;
          const genderLabel = rowA?.gender || rowB?.gender || "";
          const status = rowA && rowB ? (rowA.timeSeconds < rowB.timeSeconds ? "Forbedret" : rowA.timeSeconds > rowB.timeSeconds ? "Svakere" : "Lik") : rowA ? "Ny i år A" : "Mangler i år A";
          const sort = rowA?.timeSeconds ?? rowB?.timeSeconds ?? 99999;
          return { personId, name, genderLabel, rowA, rowB, status, sort };
        })
        .sort((x, y) => x.sort - y.sort || x.name.localeCompare(y.name));
      abBody.innerHTML = rows
        .map(
          (row) => `
          <tr>
            <td class="name-cell"><a href="${personUrl(row.personId)}">${row.name}</a></td>
            <td>${row.genderLabel}</td>
            <td class="time num">${row.rowA?.timeDisplay || ""}</td>
            <td class="time num">${row.rowB?.timeDisplay || ""}</td>
            <td class="num">${deltaLabel(row.rowA, row.rowB)}</td>
            <td>${row.status}</td>
          </tr>`
        )
        .join("");
    }

    function renderMatrix() {
      const distance = Number(root.querySelector('[name="matrixDistance"]')?.value || 600);
      const gender = root.querySelector('[name="matrixGender"]')?.value || "Kvinner";
      const rows = results.filter((row) => row.distance === distance && row.gender === gender && row.timeSeconds != null);
      const byPersonYear = new Map();
      rows.forEach((row) => {
        const key = `${row.personId}:${row.year}`;
        const current = byPersonYear.get(key);
        if (!current || row.timeSeconds < current.timeSeconds) byPersonYear.set(key, row);
      });
      const personIds = Array.from(new Set(rows.map((row) => row.personId)));
      const matrixRows = personIds
        .map((personId) => {
          const personRows = rows.filter((row) => row.personId === personId);
          const best = personRows.filter((row) => row.validToplist).sort((a, b) => a.timeSeconds - b.timeSeconds)[0] || personRows.sort((a, b) => a.timeSeconds - b.timeSeconds)[0];
          return { personId, name: best.name, best, personRows };
        })
        .sort((a, b) => a.best.timeSeconds - b.best.timeSeconds || a.name.localeCompare(b.name));
      matrixHead.innerHTML = `<tr><th>Navn</th>${years.map((year) => `<th class="num">${year}</th>`).join("")}<th class="num">PB</th></tr>`;
      matrixBody.innerHTML = matrixRows
        .map((row) => {
          const cells = years
            .map((year) => {
              const result = byPersonYear.get(`${row.personId}:${year}`);
              return `<td class="time num">${result ? `${result.timeDisplay || "-"}${badgeHtml(result) ? " *" : ""}` : ""}</td>`;
            })
            .join("");
          return `<tr><td class="name-cell"><a href="${personUrl(row.personId)}">${row.name}</a></td>${cells}<td class="time num">${row.best?.timeDisplay || ""}</td></tr>`;
        })
        .join("");
    }

    applyUrlState();
    root.querySelectorAll("select").forEach((select) => select.addEventListener("change", () => {
      renderAb();
      renderMatrix();
      updateUrlState();
    }));
    renderAb();
    renderMatrix();
  }

  window.__BASE_URL__ = document.querySelector("body")?.dataset.baseUrl || "/";
  initYearViews();
  initPeopleSearch();
  initLeaderboards();
  initComparison();
})();
