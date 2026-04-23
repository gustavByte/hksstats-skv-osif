const app = document.querySelector("#app");

const DATA_VERSION = "2026-04-23-v2";
const DEFAULT_STATE = {
  selectedYear: "all",
  selectedOrganization: "all",
  selectedClass: "all",
  honoursTab: "skv-men",
  honoursDisplay: "top5",
  search: "",
  expandedHonours: {},
  data: null,
};

const state = {
  ...DEFAULT_STATE,
};

const numberFormatter = new Intl.NumberFormat("nb-NO");
const compactNumberFormatter = new Intl.NumberFormat("nb-NO", { notation: "compact" });

const CLUB_META = {
  SKV: {
    shortName: "SK Vidar",
    label: "Vidar",
    asset: "../public/assets/v2/sk-vidar-logo.png",
    accent: "accent-vidar",
  },
  OSIF: {
    shortName: "OSI Friidrett",
    label: "OSI",
    asset: "../public/assets/v2/osi-logo.jpg",
    accent: "accent-osi",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readStateFromUrl() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  state.selectedYear = params.get("year") || DEFAULT_STATE.selectedYear;
  state.selectedOrganization = params.get("club") || DEFAULT_STATE.selectedOrganization;
  state.selectedClass = params.get("class") || DEFAULT_STATE.selectedClass;
  state.honoursTab = params.get("tab") || DEFAULT_STATE.honoursTab;
  state.honoursDisplay = params.get("show") || DEFAULT_STATE.honoursDisplay;
  state.search = params.get("q") || DEFAULT_STATE.search;
}

function syncStateToUrl() {
  const url = new URL(window.location.href);
  const entries = {
    year: state.selectedYear,
    club: state.selectedOrganization,
    class: state.selectedClass,
    tab: state.honoursTab,
    show: state.honoursDisplay,
    q: state.search.trim(),
  };

  for (const [key, value] of Object.entries(entries)) {
    const defaultValue = DEFAULT_STATE[
      key === "year"
        ? "selectedYear"
        : key === "club"
          ? "selectedOrganization"
          : key === "class"
            ? "selectedClass"
            : key === "tab"
              ? "honoursTab"
              : key === "show"
                ? "honoursDisplay"
                : "search"
    ];
    if (!value || value === defaultValue) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }

  window.history.replaceState({}, "", url);
}

function formatNumber(value) {
  return numberFormatter.format(value ?? 0);
}

function formatCompact(value) {
  return compactNumberFormatter.format(value ?? 0);
}

function formatDistanceMeters(value) {
  if (!Number.isFinite(value)) {
    return "";
  }
  return `${formatNumber(value)} m`;
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
      best_split_seconds: Number.POSITIVE_INFINITY,
      best_split_text: null,
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
    if (Number.isFinite(row.split_seconds) && row.split_seconds < current.best_split_seconds) {
      current.best_split_seconds = row.split_seconds;
      current.best_split_text = row.split_text;
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
      best_split_text: item.best_split_text,
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

function getFilteredStageGroup() {
  const groups = state.data.stageHonours ?? [];
  return groups.find((group) => group.key === state.honoursTab) ?? groups[0] ?? null;
}

function buildClubSummaries(filteredResults, filteredTeams) {
  const summaries = new Map();
  for (const code of Object.keys(CLUB_META)) {
    summaries.set(code, {
      code,
      teams: 0,
      results: 0,
      participants: new Set(),
      bestRank: Number.POSITIVE_INFINITY,
      wins: 0,
    });
  }

  for (const team of filteredTeams) {
    const entry = summaries.get(team.organization_code);
    if (!entry) continue;
    entry.teams += 1;
    if (Number.isFinite(team.team_rank)) {
      entry.bestRank = Math.min(entry.bestRank, team.team_rank);
    }
    if (team.team_rank === 1) {
      entry.wins += 1;
    }
  }

  for (const result of filteredResults) {
    const entry = summaries.get(result.organization_code);
    if (!entry) continue;
    entry.results += 1;
    entry.participants.add(result.person_name);
  }

  return [...summaries.values()].map((entry) => ({
    ...entry,
    participants: entry.participants.size,
    bestRank: entry.bestRank === Number.POSITIVE_INFINITY ? "-" : entry.bestRank,
  }));
}

function buildSeasonHighlights(filteredResults, filteredTeams) {
  const byYear = new Map();

  for (const result of filteredResults) {
    const year = String(result.year);
    const entry = byYear.get(year) ?? {
      year,
      participants: new Set(),
      results: 0,
      teams: 0,
    };
    entry.results += 1;
    entry.participants.add(result.person_name);
    byYear.set(year, entry);
  }

  for (const team of filteredTeams) {
    const year = String(team.year);
    const entry = byYear.get(year) ?? {
      year,
      participants: new Set(),
      results: 0,
      teams: 0,
    };
    entry.teams += 1;
    byYear.set(year, entry);
  }

  return [...byYear.values()]
    .map((entry) => ({
      year: entry.year,
      participants: entry.participants.size,
      results: entry.results,
      teams: entry.teams,
    }))
    .sort((a, b) => Number(b.year) - Number(a.year));
}

function buildFastestSplits(filteredResults) {
  return filteredResults
    .filter((row) => Number.isFinite(row.split_seconds))
    .slice()
    .sort((a, b) => a.split_seconds - b.split_seconds)
    .slice(0, 5);
}

function buildClassBreakdown(filteredResults) {
  const groups = new Map();
  for (const row of filteredResults) {
    const entry = groups.get(row.class_label) ?? {
      label: row.class_label,
      results: 0,
      people: new Set(),
    };
    entry.results += 1;
    entry.people.add(row.person_name);
    groups.set(row.class_label, entry);
  }

  return [...groups.values()]
    .map((entry) => ({
      label: entry.label,
      results: entry.results,
      people: entry.people.size,
    }))
    .sort((a, b) => b.results - a.results);
}

function renderHeader() {
  return `
    <header class="site-header">
      <div class="brand-lockup">
        <div class="brand-logos" aria-label="Klubber">
          <img class="brand-logo brand-logo-vidar" src="../public/assets/v2/sk-vidar-logo.png" alt="SK Vidar logo" />
          <span class="brand-divider" aria-hidden="true"></span>
          <img class="brand-logo brand-logo-osi" src="../public/assets/v2/osi-logo.jpg" alt="OSI Friidrett logo" />
        </div>
        <div class="brand-copy">
          <p class="eyebrow">Holmenkollstafetten</p>
          <strong>V2</strong>
        </div>
      </div>
      <nav class="top-nav" aria-label="Hovednavigasjon">
        <a href="#hederslister">Hederlister</a>
        <a href="#statistikk">Statistikk</a>
        <a href="#klubber">Klubber</a>
        <a href="../index.html">Se originalen</a>
      </nav>
    </header>
  `;
}

function renderHero(filteredResults, filteredTeams) {
  const kpis = state.data.overview.kpis.filter((item) => item.label !== "Navn til gjennomgang");
  const participants = new Set(filteredResults.map((row) => row.person_name)).size;
  const years = buildSeasonHighlights(filteredResults, filteredTeams);
  const earliestYear = years.length ? years[years.length - 1].year : null;
  const latestYear = years.length ? years[0].year : null;
  const periodLabel =
    years.length > 1 ? `${earliestYear}-${latestYear}` : latestYear ?? "2022-2025";

  return `
    <section class="hero-panel">
      <div class="hero-copy">
        <div class="hero-copy-inner">
          <p class="eyebrow hero-eyebrow">Holmenkollstafetten</p>
          <h1>HKSstats <span>SKV&amp;OSIF</span></h1>
          <p class="hero-lead">
            Resultater, etappeheltar og klubbhistorikk i et nytt designspor, bygget direkte på
            samme datasett som dagens side.
          </p>
          <div class="hero-actions">
            <a class="cta-primary" href="#filter-panel">Utforsk resultatene</a>
            <a class="cta-secondary" href="#statistikk">Se statistikk</a>
          </div>
          <dl class="hero-meta">
            <div>
              <dt>Periode</dt>
              <dd>${escapeHtml(periodLabel)}</dd>
            </div>
            <div>
              <dt>Utøvere i utvalget</dt>
              <dd>${formatNumber(participants)}</dd>
            </div>
            <div>
              <dt>Etapper i visning</dt>
              <dd>${formatNumber(filteredResults.length)}</dd>
            </div>
          </dl>
        </div>
        <div class="hero-kpis">
          ${kpis
            .slice(0, 5)
            .map(
              (item) => `
                <article class="stat-chip">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${escapeHtml(item.value)}</strong>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="hero-visual">
        <figure class="hero-photo-card">
          <img
            src="../public/assets/v2/hero-group-photo.jpg"
            alt="Gruppebilde av løpere fra SK Vidar og OSI Friidrett"
            class="hero-photo"
            width="5605"
            height="2911"
            fetchpriority="high"
          />
          <figcaption>Gruppebilde 2025</figcaption>
        </figure>
      </div>
    </section>
  `;
}

function renderClubSummaryCard(summary) {
  const meta = CLUB_META[summary.code];
  const bestRank = summary.bestRank === "-" ? "Ingen" : `#${summary.bestRank}`;
  return `
    <article class="club-summary-card ${meta.accent}">
      <div class="club-summary-header">
        <img src="${meta.asset}" alt="${meta.shortName} logo" class="club-summary-logo" />
        <div>
          <p>${meta.shortName}</p>
          <strong>${summary.wins ? `${summary.wins} lagseiere` : "Sterk historikk"}</strong>
        </div>
      </div>
      <div class="club-summary-stats">
        <div><span>Utøvere</span><strong>${formatNumber(summary.participants)}</strong></div>
        <div><span>Lag</span><strong>${formatNumber(summary.teams)}</strong></div>
        <div><span>Etapper</span><strong>${formatCompact(summary.results)}</strong></div>
        <div><span>Beste plass</span><strong>${escapeHtml(bestRank)}</strong></div>
      </div>
    </article>
  `;
}

function renderFilterPanel() {
  return `
    <section class="filter-shell" id="filter-panel">
      <div class="filter-title">
        <p class="eyebrow">Filter</p>
        <strong>Spiss utsnittet</strong>
      </div>
      <div class="filter-grid">
        <label>
          <span>År</span>
          <select id="year-filter" name="year">
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
          <select id="organization-filter" name="club">
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
          <select id="class-filter" name="class">
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
          <input
            id="search-filter"
            name="search"
            type="search"
            value="${escapeHtml(state.search)}"
            placeholder="Søk på lag, utøver eller etappe…"
            autocomplete="off"
          />
        </label>
      </div>
    </section>
  `;
}

function renderHonoursSection(activeGroup) {
  if (!activeGroup) {
    return "";
  }

  return `
    <section class="content-card section-card" id="hederslister">
      <div class="section-header">
        <div>
          <p class="eyebrow">Etappe for etappe</p>
          <h2>Hederliste per etappe</h2>
        </div>
        <div class="section-header-meta">
          <span>${escapeHtml(activeGroup.subtitle)}</span>
          <label class="compact-select">
            <span class="sr-only">Antall resultater</span>
            <select id="honours-display-filter" name="show">
              <option value="top5" ${state.honoursDisplay === "top5" ? "selected" : ""}>Topp 5</option>
              <option value="top10" ${state.honoursDisplay === "top10" ? "selected" : ""}>Topp 10</option>
            </select>
          </label>
        </div>
      </div>
      <div class="pill-row" role="tablist" aria-label="Klubb og klasse">
        ${state.data.stageHonours
          .map(
            (group) => `
              <button
                class="pill-button ${group.key === activeGroup.key ? "is-active" : ""}"
                type="button"
                data-tab="${group.key}"
                role="tab"
                aria-selected="${group.key === activeGroup.key ? "true" : "false"}"
              >
                ${escapeHtml(group.title)}
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="honours-grid">
        ${activeGroup.stages
          .map((stage) => {
            const stageKey = `${activeGroup.key}:${stage.stage_number}`;
            const isExpanded = Boolean(state.expandedHonours[stageKey]);
            const entries =
              state.honoursDisplay === "top10" || isExpanded
                ? stage.expanded_entries ?? stage.entries
                : stage.entries;
            return `
              <article class="stage-card">
                <div class="stage-card-header">
                  <div>
                    <p class="stage-kicker">Etappe ${String(stage.stage_number).padStart(2, "0")}</p>
                    <h3>${escapeHtml(stage.stage_label)}</h3>
                  </div>
                  ${
                    stage.distance_m
                      ? `<span class="distance-pill">${escapeHtml(formatDistanceMeters(stage.distance_m))}</span>`
                      : ""
                  }
                </div>
                ${
                  stage.record
                    ? `
                      <div class="record-panel">
                        <span>Etapperekord</span>
                        <strong>${escapeHtml(stage.record.record_text)}</strong>
                        <small>${escapeHtml(stage.record.record_holder)} · ${escapeHtml(
                          stage.record.record_club,
                        )} ${escapeHtml(stage.record.record_year)}</small>
                      </div>
                    `
                    : ""
                }
                <div class="table-wrap">
                  <table class="mini-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Navn</th>
                        <th>Tid</th>
                        <th>%</th>
                        <th>År</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${entries
                        .map(
                          (entry) => `
                            <tr>
                              <td>${entry.rank}</td>
                              <td>
                                <strong>${escapeHtml(entry.person_name)}</strong>
                                <span>${escapeHtml(entry.team_name)}</span>
                              </td>
                              <td>${escapeHtml(entry.split_text ?? "-")}</td>
                              <td>${escapeHtml(entry.percent_of_record ? `${entry.percent_of_record}%` : "-")}</td>
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
                      <button
                        class="text-link"
                        type="button"
                        data-stage-toggle="${stageKey}"
                        aria-expanded="${isExpanded ? "true" : "false"}"
                      >
                        ${isExpanded ? "Vis mindre" : "Vis topp 10"}
                      </button>
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

function renderParticipationSection(personStats, fastestSplits, classBreakdown) {
  const maxClassValue = Math.max(...classBreakdown.map((row) => row.results), 1);

  return `
    <section class="stats-grid" id="statistikk">
      <article class="content-card section-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">Personer</p>
            <h2>Mest deltakelse</h2>
          </div>
          <span>${formatNumber(personStats.length)} treff i gjeldende filter</span>
        </div>
        <div class="leaderboard-list">
          ${personStats
            .slice(0, 8)
            .map(
              (row, index) => `
                <article class="leader-card">
                  <span class="leader-rank">${index + 1}</span>
                  <div class="leader-copy">
                    <strong>${escapeHtml(row.canonical_name)}</strong>
                    <p>${escapeHtml(row.organizations.join(" / "))}</p>
                  </div>
                  <div class="leader-values">
                    <strong>${formatNumber(row.appearances)}</strong>
                    <span>starter</span>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </article>

      <article class="content-card section-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">Tempo</p>
            <h2>Raskeste splittider</h2>
          </div>
          <span>Direkte fra resultatene</span>
        </div>
        <div class="spotlight-list">
          ${fastestSplits
            .map(
              (row) => `
                <article class="spotlight-card">
                  <div>
                    <strong>${escapeHtml(row.person_name)}</strong>
                    <p>${escapeHtml(row.stage_label)} · ${escapeHtml(row.team_name)}</p>
                  </div>
                  <div class="spotlight-value">
                    <strong>${escapeHtml(row.split_text ?? "-")}</strong>
                    <span>${escapeHtml(row.year)}</span>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </article>

      <article class="content-card section-card section-span">
        <div class="section-header">
          <div>
            <p class="eyebrow">Klasser</p>
            <h2>Fordeling i utvalget</h2>
          </div>
          <span>Basert på gjeldende filter</span>
        </div>
        <div class="class-breakdown">
          ${classBreakdown
            .slice(0, 8)
            .map((row) => {
              const width = Math.max(8, (row.results / maxClassValue) * 100);
              return `
                <div class="class-row">
                  <div>
                    <strong>${escapeHtml(row.label)}</strong>
                    <span>${formatNumber(row.people)} personer</span>
                  </div>
                  <div class="class-bar"><span style="width:${width}%"></span></div>
                  <b>${formatNumber(row.results)}</b>
                </div>
              `;
            })
            .join("")}
        </div>
      </article>
    </section>
  `;
}

function renderTeamsSection(filteredTeams, clubSummaries, seasonHighlights) {
  return `
    <section class="teams-layout" id="klubber">
      <div class="teams-main content-card section-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">Lag</p>
            <h2>Lag i utvalget</h2>
          </div>
          <span>${formatNumber(filteredTeams.length)} lag</span>
        </div>
        <div class="team-grid">
          ${filteredTeams
            .slice(0, 12)
            .map((team) => {
              const meta = CLUB_META[team.organization_code];
              return `
                <article class="team-card ${meta?.accent ?? ""}">
                  ${
                    meta
                      ? `<img src="${meta.asset}" alt="${meta.shortName} logo" class="team-logo" />`
                      : ""
                  }
                  <div class="team-card-copy">
                    <span>${escapeHtml(team.year)} · ${escapeHtml(team.class_label)}</span>
                    <strong>${escapeHtml(team.team_name)}</strong>
                    <p>${escapeHtml(team.organization_name)}</p>
                  </div>
                  <div class="team-card-stats">
                    <div><span>Total</span><strong>${escapeHtml(team.total_time_text ?? "-")}</strong></div>
                    <div><span>Plass</span><strong>${escapeHtml(team.team_rank ?? "-")}</strong></div>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      </div>

      <aside class="teams-rail">
        <section class="content-card section-card compact-stack">
          <div class="section-header">
            <div>
              <p class="eyebrow">Klubber</p>
              <h2>Klubbsammendrag</h2>
            </div>
          </div>
          ${clubSummaries.map((summary) => renderClubSummaryCard(summary)).join("")}
        </section>

        <section class="content-card section-card compact-stack">
          <div class="section-header">
            <div>
              <p class="eyebrow">Sesonger</p>
              <h2>År i utvalget</h2>
            </div>
          </div>
          <div class="season-list">
            ${seasonHighlights
              .slice(0, 4)
              .map(
                (item) => `
                  <article class="season-card">
                    <strong>${escapeHtml(item.year)}</strong>
                    <span>${formatNumber(item.results)} etapper</span>
                    <span>${formatNumber(item.teams)} lag</span>
                    <span>${formatNumber(item.participants)} personer</span>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>
      </aside>
    </section>
  `;
}

function attachEvents() {
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

function render() {
  if (!state.data) {
    app.innerHTML = `<p class="loading-state">Laster data…</p>`;
    return;
  }

  syncStateToUrl();

  const { filteredResults, filteredTeams, personStats } = filterData();
  const activeGroup = getFilteredStageGroup();
  const clubSummaries = buildClubSummaries(filteredResults, filteredTeams);
  const seasonHighlights = buildSeasonHighlights(filteredResults, filteredTeams);
  const fastestSplits = buildFastestSplits(filteredResults);
  const classBreakdown = buildClassBreakdown(filteredResults);

  app.innerHTML = `
    <div class="page-shell">
      <div class="page-backdrop" aria-hidden="true"></div>
      ${renderHeader()}
      <main id="main-content">
        ${renderHero(filteredResults, filteredTeams)}
        <section class="club-summary-row">
          ${clubSummaries.map((summary) => renderClubSummaryCard(summary)).join("")}
        </section>
        ${renderFilterPanel()}
        ${renderHonoursSection(activeGroup)}
        ${renderParticipationSection(personStats, fastestSplits, classBreakdown)}
        ${renderTeamsSection(filteredTeams, clubSummaries, seasonHighlights)}
      </main>
    </div>
  `;

  attachEvents();
}

async function bootstrap() {
  readStateFromUrl();
  app.innerHTML = `<p class="loading-state">Laster data…</p>`;

  const dataUrl = new URL("../public/data/site-data.json", window.location.href);
  dataUrl.searchParams.set("v", DATA_VERSION);

  const response = await fetch(dataUrl.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Kunne ikke hente datafilen (${response.status}).`);
  }

  state.data = await response.json();
  render();
}

bootstrap().catch((error) => {
  console.error(error);
  app.innerHTML = `
    <div class="loading-state error-state">
      Kunne ikke laste datafilen. Last siden på nytt. Hvis feilen fortsetter, er det sannsynligvis
      en cache-feil.
    </div>
  `;
});
