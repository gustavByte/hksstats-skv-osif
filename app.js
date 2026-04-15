const app = document.querySelector("#app");

const state = {
  selectedYear: "all",
  selectedOrganization: "all",
  selectedClass: "all",
  honoursTab: "skv-men",
  honoursDisplay: "top5",
  expandedHonours: {},
  search: "",
  data: null,
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const meterFormatter = new Intl.NumberFormat("nb-NO");

function formatDistanceMeters(value) {
  if (!Number.isFinite(value)) {
    return "";
  }
  return `${meterFormatter.format(value)} m`;
}

function matchesSearch(haystack, needle) {
  return !needle || haystack.toLowerCase().includes(needle);
}

function buildPersonStats(results) {
  const people = new Map();
  for (const row of results) {
    const current = people.get(row.person_name) ?? {
      canonical_name: row.person_name,
      appearances: 0,
      seasons: new Set(),
      organizations: new Set(),
      classes: new Set(),
      best_category_rank: Number.POSITIVE_INFINITY,
      category_wins: 0,
    };
    current.appearances += 1;
    current.seasons.add(row.year);
    current.organizations.add(row.organization_code);
    current.classes.add(row.class_label);
    current.best_category_rank = Math.min(
      current.best_category_rank,
      row.category_rank ?? Number.POSITIVE_INFINITY,
    );
    if (row.category_rank === 1) {
      current.category_wins += 1;
    }
    people.set(row.person_name, current);
  }

  return [...people.values()]
    .map((item) => ({
      canonical_name: item.canonical_name,
      appearances: item.appearances,
      seasons: item.seasons.size,
      organizations: [...item.organizations].sort(),
      classes: [...item.classes].sort(),
      best_category_rank:
        item.best_category_rank === Number.POSITIVE_INFINITY ? null : item.best_category_rank,
      category_wins: item.category_wins,
    }))
    .sort((a, b) => {
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      if (b.category_wins !== a.category_wins) return b.category_wins - a.category_wins;
      return a.canonical_name.localeCompare(b.canonical_name, "no");
    });
}

function filterData() {
  const searchValue = state.search.trim().toLowerCase();
  const filteredResults = state.data.results.filter((row) => {
    const matchesYear = state.selectedYear === "all" || String(row.year) === state.selectedYear;
    const matchesOrganization =
      state.selectedOrganization === "all" || row.organization_code === state.selectedOrganization;
    const matchesClass = state.selectedClass === "all" || row.class_code === state.selectedClass;
    const haystack = [
      row.person_name,
      row.raw_name,
      row.team_name,
      row.stage_label,
      row.class_label,
      row.organization_name,
    ].join(" ");
    return matchesYear && matchesOrganization && matchesClass && matchesSearch(haystack, searchValue);
  });

  const filteredTeams = state.data.teams.filter((row) => {
    const matchesYear = state.selectedYear === "all" || String(row.year) === state.selectedYear;
    const matchesOrganization =
      state.selectedOrganization === "all" || row.organization_code === state.selectedOrganization;
    const matchesClass = state.selectedClass === "all" || row.class_code === state.selectedClass;
    const haystack = [row.team_name, row.class_label, row.organization_name].join(" ");
    return matchesYear && matchesOrganization && matchesClass && matchesSearch(haystack, searchValue);
  });

  return {
    filteredResults,
    filteredTeams,
    personStats: buildPersonStats(filteredResults),
  };
}

function renderStageHonours() {
  const groups = state.data.stageHonours ?? [];
  const activeGroup = groups.find((group) => group.key === state.honoursTab) ?? groups[0];
  if (!activeGroup) {
    return "";
  }

  return `
    <section class="panel panel-wide honours-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Etappe for etappe</p>
          <h2>Hederliste per etappe</h2>
        </div>
        <span class="muted">Her sammenlignes bare tider innen samme etappe.</span>
        </div>
        <p class="panel-copy stage-intro">
          SK Vidar viser topp 5 per etappe, slik du har i Hedersliste-arket, og du kan velge topp 10
          i filteret. OSI Friidrett viser topp 3. Hver rad viser splittid, prosent av etapperekord,
          klasse, overall-plassering, kategori, lag og år.
        </p>
      <div class="tab-row">
        ${groups
          .map(
            (group) => `
              <button class="tab-button ${group.key === activeGroup.key ? "is-active" : ""}" data-tab="${group.key}">
                ${escapeHtml(group.title)}
              </button>
            `,
          )
          .join("")}
      </div>
        <div class="honours-toolbar">
          <label class="honours-display-control">
            <span>Vis antall toppresultater</span>
            <select id="honours-display-filter">
              <option value="top5" ${state.honoursDisplay === "top5" ? "selected" : ""}>Topp 5</option>
              <option value="top10" ${state.honoursDisplay === "top10" ? "selected" : ""}>Topp 10</option>
            </select>
          </label>
      </div>
      <div class="stage-summary">
        <strong>${escapeHtml(activeGroup.title)}</strong>
        <span>${escapeHtml(activeGroup.subtitle)}</span>
      </div>
      <div class="honours-grid">
        ${activeGroup.stages
          .map((stage) => {
            const stageKey = `${activeGroup.key}:${stage.stage_number}`;
            const isExpanded = Boolean(state.expandedHonours[stageKey]);
            const visibleEntries =
              state.honoursDisplay === "top10" || isExpanded
                ? stage.expanded_entries ?? stage.entries
                : stage.entries;
            return `
              <article class="honour-stage-card">
                <div class="honour-stage-header">
                  <div>
                    <p class="eyebrow">Etappe ${String(stage.stage_number).padStart(2, "0")}</p>
                    <div class="stage-title-row">
                      <h3>${escapeHtml(stage.stage_label)}</h3>
                      ${
                        stage.distance_m
                          ? `<span class="distance-badge">${escapeHtml(formatDistanceMeters(stage.distance_m))}</span>`
                          : ""
                      }
                    </div>
                  </div>
                  ${
                    stage.record
                      ? `
                        <div class="record-chip">
                          <strong>${escapeHtml(stage.record.record_text)}</strong>
                          <span>${escapeHtml(stage.record.record_holder ?? "")}</span>
                          <small>${escapeHtml(stage.record.record_club ?? "")} ${escapeHtml(
                            stage.record.record_year ?? "",
                          )}</small>
                        </div>
                      `
                      : ""
                  }
                </div>
                <div class="table-wrap">
                  <table class="honour-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Navn</th>
                        <th>Tid</th>
                        <th>% rek.</th>
                        <th>Klasse</th>
                        <th>O/A</th>
                        <th>Cat</th>
                        <th>Lag</th>
                        <th>År</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${visibleEntries
                        .map(
                          (entry) => `
                            <tr>
                              <td>${entry.rank}</td>
                              <td><strong>${escapeHtml(entry.person_name)}</strong></td>
                              <td>${escapeHtml(entry.split_text ?? "-")}</td>
                              <td>${entry.percent_of_record ? `${entry.percent_of_record}%` : "-"}</td>
                              <td>${escapeHtml(entry.class_label)}</td>
                              <td>${escapeHtml(entry.oa_rank ?? "-")}</td>
                              <td>${escapeHtml(entry.category_rank ?? "-")}</td>
                              <td>${escapeHtml(entry.team_name)}</td>
                              <td>${escapeHtml(entry.year)}</td>
                            </tr>
                          `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
                ${
                  stage.has_expansion && state.honoursDisplay !== "top10"
                    ? `
                      <div class="stage-toggle-row">
                        <button
                          class="stage-toggle-button"
                          type="button"
                          data-stage-toggle="${stageKey}"
                          aria-expanded="${isExpanded ? "true" : "false"}"
                        >
                          ${isExpanded ? "Skjul topp 10" : "Vis topp 10"}
                        </button>
                      </div>
                    `
                    : ""
                }
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderPersonCards(personStats) {
  return `
    <div class="person-card-list" aria-label="Mest deltakelse mobilvisning">
      ${personStats
        .slice(0, 18)
        .map(
          (row, index) => `
            <article class="person-card">
              <div class="person-card-header">
                <span class="person-rank">${index + 1}</span>
                <div>
                  <strong>${escapeHtml(row.canonical_name)}</strong>
                  <span class="cell-subtle">${escapeHtml(row.organizations.join(" / "))}</span>
                </div>
              </div>
              <div class="person-card-stats">
                <span><strong>${row.appearances}</strong> etapper</span>
                <span><strong>${row.seasons}</strong> år</span>
                <span><strong>${escapeHtml(row.classes.join(", "))}</strong> klasser</span>
                <span><strong>${row.best_category_rank ?? "-"}</strong> beste cat.</span>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function render() {
  if (!state.data) {
    app.innerHTML = "<p>Laster data ...</p>";
    return;
  }

  const { filteredTeams, personStats } = filterData();

  app.innerHTML = `
    <div class="page-shell">
      <div class="page-glow page-glow-left"></div>
      <div class="page-glow page-glow-right"></div>

      <header class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Holmenkollstafetten</p>
          <h1>HKSstatsSKV&amp;OSIF</h1>
          <p class="hero-lead">
            Etappesammenligning for SK Vidar og OSI Friidrett, bygget fra regneark
            "HKS-resultater 2022 - d.d.".
          </p>
          <a class="quick-jump-link" href="#most-deltakelse">Mest deltakelse &lt;3</a>
        </div>
        <div class="hero-grid">
          ${state.data.overview.kpis
            .filter((item) => item.label !== "Navn til gjennomgang")
            .map(
              (item) => `
                <article class="metric-card">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${escapeHtml(item.value)}</strong>
                </article>
              `,
            )
            .join("")}
        </div>
      </header>

      ${renderStageHonours()}

      <section class="filter-panel">
        <label>
          <span>År</span>
          <select id="year-filter">
            <option value="all">Alle år</option>
            ${state.data.metadata.years
              .map(
                (year) =>
                  `<option value="${year}" ${String(year) === state.selectedYear ? "selected" : ""}>${year}</option>`,
              )
              .join("")}
          </select>
        </label>
        <label>
          <span>Klubb</span>
          <select id="organization-filter">
            <option value="all">Alle klubber</option>
            ${state.data.metadata.organizations
              .map(
                (organization) => `
                  <option value="${organization.code}" ${
                    organization.code === state.selectedOrganization ? "selected" : ""
                  }>
                    ${escapeHtml(organization.name)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>
        <label>
          <span>Klasse</span>
          <select id="class-filter">
            <option value="all">Alle klasser</option>
            ${state.data.metadata.classes
              .map(
                (item) => `
                  <option value="${item.code}" ${item.code === state.selectedClass ? "selected" : ""}>
                    ${escapeHtml(item.label)}
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>
        <label class="search-field">
          <span>Søk</span>
          <input id="search-filter" type="search" value="${escapeHtml(state.search)}" placeholder="Navn, lag, etappe ..." />
        </label>
      </section>

      <main class="content-grid">
        <section class="panel panel-wide">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Oversikt</p>
                <h2>Klasser og sesonger</h2>
              </div>
            </div>
            <div class="breakdown-grid">
            <div class="stack">
              ${state.data.overview.classBreakdown
                .map((item) => {
                  const maxValue = Math.max(
                    ...state.data.overview.classBreakdown.map((row) => row.result_count || 1),
                  );
                  const width = Math.max(12, ((item.result_count || 0) / maxValue) * 100);
                  return `
                    <div class="bar-row">
                      <div>
                        <strong>${escapeHtml(item.class_label)}</strong>
                        <span>${escapeHtml(item.people_count)} personer</span>
                      </div>
                      <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
                      <span>${escapeHtml(item.result_count)}</span>
                    </div>
                  `;
                })
                .join("")}
            </div>
            <div class="stack">
              ${state.data.overview.yearBreakdown
                .map(
                  (item) => `
                    <article class="year-card">
                      <strong>${item.year}</strong>
                      <span>${item.result_count} etapper</span>
                      <span>${item.team_count} lag</span>
                      <span>${item.people_count} personer</span>
                    </article>
                  `,
                )
                .join("")}
            </div>
          </div>
        </section>

        <section class="panel" id="most-deltakelse">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Personer</p>
              <h2>Mest deltakelse</h2>
            </div>
            <span class="muted">${personStats.length} treff i gjeldende filter</span>
          </div>
          <div class="table-wrap desktop-table">
            <table>
              <thead>
                <tr><th>Navn</th><th>Etapper</th><th>År</th><th>Klasser</th><th>Beste cat.</th></tr>
              </thead>
              <tbody>
                ${personStats
                  .slice(0, 18)
                  .map(
                    (row) => `
                      <tr>
                        <td>
                          <strong>${escapeHtml(row.canonical_name)}</strong>
                          <span class="cell-subtle">${escapeHtml(row.organizations.join(" / "))}</span>
                        </td>
                        <td>${row.appearances}</td>
                        <td>${row.seasons}</td>
                        <td>${escapeHtml(row.classes.join(", "))}</td>
                        <td>${row.best_category_rank ?? "-"}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          ${renderPersonCards(personStats)}
        </section>

        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Lag</p>
              <h2>Lag i utvalget</h2>
            </div>
            <span class="muted">${filteredTeams.length} lag</span>
          </div>
          <div class="team-list">
            ${filteredTeams
              .slice(0, 18)
              .map(
                (team) => `
                  <article class="team-card">
                    <span>${team.year}</span>
                    <strong>${escapeHtml(team.team_name)}</strong>
                    <p>${escapeHtml(team.class_label)} · ${escapeHtml(team.organization_name)}</p>
                    <div class="team-meta">
                      <span>Total: ${escapeHtml(team.total_time_text ?? "-")}</span>
                      <span>Plass: ${escapeHtml(team.team_rank ?? "-")}</span>
                    </div>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>
      </main>
    </div>
  `;

  document.querySelector("#year-filter")?.addEventListener("change", (event) => {
    state.selectedYear = event.target.value;
    render();
  });
  document.querySelector("#organization-filter")?.addEventListener("change", (event) => {
    state.selectedOrganization = event.target.value;
    render();
  });
  document.querySelector("#class-filter")?.addEventListener("change", (event) => {
    state.selectedClass = event.target.value;
    render();
  });
  document.querySelector("#honours-display-filter")?.addEventListener("change", (event) => {
    state.honoursDisplay = event.target.value;
    render();
  });
  document.querySelector("#search-filter")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", (event) => {
      state.honoursTab = event.currentTarget.dataset.tab;
      render();
    });
  });
  document.querySelectorAll("[data-stage-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const stageKey = event.currentTarget.dataset.stageToggle;
      state.expandedHonours[stageKey] = !state.expandedHonours[stageKey];
      render();
    });
  });
}

async function bootstrap() {
  app.innerHTML = "<p>Laster data ...</p>";
  const dataUrl = new URL("./public/data/site-data.json", window.location.href);
  dataUrl.searchParams.set("v", "2026-04-06-1");

  const response = await fetch(dataUrl.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Kunne ikke hente datafilen (${response.status}).`);
  }

  state.data = await response.json();
  render();
}

bootstrap().catch((error) => {
  console.error(error);
  app.innerHTML =
    "<p>Kunne ikke laste site-data.json. Prøv å laste siden på nytt. Hvis feilen fortsetter, er det sannsynligvis en cache-feil i nettleseren.</p>";
});
