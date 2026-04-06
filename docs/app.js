const app = document.querySelector("#app");

const state = {
  selectedYear: "all",
  selectedOrganization: "all",
  selectedClass: "all",
  search: "",
  data: null,
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

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

  const leaderboard = [...filteredResults]
    .sort((a, b) => {
      const aSeconds = a.split_seconds ?? Number.POSITIVE_INFINITY;
      const bSeconds = b.split_seconds ?? Number.POSITIVE_INFINITY;
      if (aSeconds !== bSeconds) return aSeconds - bSeconds;
      return (a.category_rank ?? Number.POSITIVE_INFINITY) - (b.category_rank ?? Number.POSITIVE_INFINITY);
    })
    .slice(0, 12);

  const pendingReview = state.data.nameReview.filter((row) => {
    const decision = String(row.decision ?? "").trim().toLowerCase();
    if (["approve", "approved", "reject", "rejected"].includes(decision)) {
      return false;
    }
    return matchesSearch(
      `${row.raw_name} ${row.suggested_canonical_name} ${row.reason}`,
      searchValue,
    );
  });

  return {
    filteredResults,
    filteredTeams,
    leaderboard,
    personStats: buildPersonStats(filteredResults),
    pendingReview,
  };
}

function render() {
  if (!state.data) {
    app.innerHTML = "<p>Laster data …</p>";
    return;
  }

  const { filteredTeams, leaderboard, personStats, pendingReview } = filterData();

  app.innerHTML = `
    <div class="page-shell">
      <div class="page-glow page-glow-left"></div>
      <div class="page-glow page-glow-right"></div>

      <header class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Holmenkollstafetten</p>
          <h1>HKSstatsSKV&amp;OSIF</h1>
          <p class="hero-lead">
            Ett datagrunnlag for SK Vidar og OSI Friidrett, bygget fra Excel-arket
            "HKS-resultater 2022 – d.d." og klargjort for statistikk, personhistorikk og kontrollert navnematching.
          </p>
        </div>
        <div class="hero-grid">
          ${state.data.overview.kpis
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
            <a class="download-link" href="./downloads/hksstats.sqlite">Last ned SQLite</a>
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

        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Personer</p>
              <h2>Mest deltakelse</h2>
            </div>
            <span class="muted">${personStats.length} treff i gjeldende filter</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Navn</th><th>Etapper</th><th>År</th><th>Klasser</th><th>Beste kat.</th></tr>
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

        <section class="panel panel-wide">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Etappeprestasjoner</p>
              <h2>Raskeste i gjeldende filter</h2>
            </div>
            <span class="muted">Sortert på splittid</span>
          </div>
          <div class="leaderboard-grid">
            ${leaderboard
              .map(
                (row, index) => `
                  <article class="leader-card">
                    <span class="leader-rank">${String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>${escapeHtml(row.person_name)}</strong>
                      <p>${escapeHtml(row.stage_label)} · ${row.year} · ${escapeHtml(row.team_name)}</p>
                    </div>
                    <div class="leader-values">
                      <span>${escapeHtml(row.split_text ?? "-")}</span>
                      <small>Cat ${escapeHtml(row.category_rank ?? "-")}</small>
                    </div>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>

        <section class="panel panel-wide">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Navnematching</p>
              <h2>Forslag som krever godkjenning</h2>
            </div>
            <a class="download-link" href="./downloads/name_match_review.csv">Last ned review-CSV</a>
          </div>
          <p class="panel-copy">
            Ingen navn slås sammen automatisk. Filen <code>data/name_match_review.csv</code> er arbeidslisten:
            sett <code>decision</code> til <code>approve</code> eller <code>reject</code>, kjør bygg på nytt,
            og databasen oppdateres deretter.
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Rått navn</th><th>Foreslått kanonisk navn</th><th>Score</th><th>Begrunnelse</th></tr>
              </thead>
              <tbody>
                ${pendingReview
                  .slice(0, 24)
                  .map(
                    (row) => `
                      <tr>
                        <td>${escapeHtml(row.raw_name)}</td>
                        <td>${escapeHtml(row.suggested_canonical_name)}</td>
                        <td>${escapeHtml(row.confidence || "-")}</td>
                        <td>${escapeHtml(row.reason)}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>
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
  document.querySelector("#search-filter")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });
}

async function bootstrap() {
  app.innerHTML = "<p>Laster data …</p>";
  const response = await fetch("./public/data/site-data.json");
  state.data = await response.json();
  render();
}

bootstrap().catch((error) => {
  console.error(error);
  app.innerHTML = "<p>Kunne ikke laste site-data.json.</p>";
});
