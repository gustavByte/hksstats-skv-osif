const app = document.querySelector("#app");

const DATA_VERSION = "2026-04-24-v2-team-archive-division-filter";
const REPOSITORY_URL = "https://github.com/gustavByte/hksstats-skv-osif";
const ASSET_ROOT_URL = new URL("../public/assets/v2/", import.meta.url);
const DATA_URL = new URL("../public/data/site-data.json", import.meta.url);
const LEGACY_URL = new URL("../legacy/", import.meta.url).toString();
const TESTLOP_URL = new URL("../testlop/", import.meta.url).toString();
const DEFAULT_STATE = {
  selectedYear: "all",
  selectedOrganization: "all",
  selectedClass: "all",
  selectedDivision: "all",
  honoursTab: "skv-men",
  honoursDisplay: "top5",
  search: "",
  teamClub: "all",
  teamGroup: "all",
  teamDivision: "all",
  teamPlacement: "all",
  teamYear: "all",
  teamView: "archive",
  filtersOpen: false,
  expandedHonours: {},
  expandedTeams: {},
  data: null,
};

const state = {
  ...DEFAULT_STATE,
};

let navObserver = null;

const numberFormatter = new Intl.NumberFormat("nb-NO");
const compactNumberFormatter = new Intl.NumberFormat("nb-NO", { notation: "compact" });
const percentFormatter = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 });
const generatedAtFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
});

const CLUB_META = {
  SKV: {
    shortName: "SK Vidar",
    label: "Vidar",
    asset: assetUrl("sk-vidar-logo.png"),
    accent: "accent-vidar",
  },
  OSIF: {
    shortName: "OSI Friidrett",
    label: "OSI",
    asset: assetUrl("osi-logo.png"),
    accent: "accent-osi",
  },
};

const TEAM_GROUP_META = {
  elite: { label: "Elite", sort: 1, chipLabel: "Elite" },
  senior: { label: "Senior", sort: 2, chipLabel: "Senior" },
  student: { label: "Student", sort: 3, chipLabel: "Student" },
  veteran: { label: "Veteran", sort: 4, chipLabel: "Veteran" },
  superveteran: { label: "Superveteran", sort: 5, chipLabel: "Superveteran" },
  mixSKV: { label: "Mix SK Vidar", sort: 98, chipLabel: "Mix SK Vidar" },
  mixStud: { label: "Mix student", sort: 99, chipLabel: "Mix student" },
};

const TEAM_CLASS_GROUPS = {
  EliteSKV: "elite",
  SeniorSKV: "senior",
  StudOSI: "student",
  Veteran: "veteran",
  MiksSKV: "mixSKV",
  MiksOSI: "mixStud",
};

const DIVISION_META = {
  men: { label: "Menn", sort: 1 },
  women: { label: "Kvinner", sort: 2 },
  mixed: { label: "Mix", sort: 3 },
  unknown: { label: "Ukjent", sort: 4 },
};

const HONOUR_GROUP_FILTERS = {
  "skv-men": {
    organizationCode: "SKV",
    division: "men",
    classCodes: ["EliteSKV", "SeniorSKV", "Veteran"],
  },
  "skv-women": {
    organizationCode: "SKV",
    division: "women",
    classCodes: ["EliteSKV", "SeniorSKV", "Veteran"],
  },
  "osi-men": {
    organizationCode: "OSIF",
    division: "men",
    classCodes: ["StudOSI"],
  },
  "osi-women": {
    organizationCode: "OSIF",
    division: "women",
    classCodes: ["StudOSI"],
  },
};

const URL_STATE_KEYS = {
  year: "selectedYear",
  club: "selectedOrganization",
  class: "selectedClass",
  division: "selectedDivision",
  tab: "honoursTab",
  show: "honoursDisplay",
  q: "search",
  teamClub: "teamClub",
  teamGroup: "teamGroup",
  teamDivision: "teamDivision",
  teamPlacement: "teamPlacement",
  teamYear: "teamYear",
  teamView: "teamView",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function assetUrl(fileName) {
  return new URL(fileName, ASSET_ROOT_URL).toString();
}

function toDomId(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readStateFromUrl() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  state.selectedYear = params.get("year") || DEFAULT_STATE.selectedYear;
  state.selectedOrganization = params.get("club") || DEFAULT_STATE.selectedOrganization;
  state.selectedClass = params.get("class") || DEFAULT_STATE.selectedClass;
  state.selectedDivision = params.get("division") || DEFAULT_STATE.selectedDivision;
  state.honoursTab = params.get("tab") || DEFAULT_STATE.honoursTab;
  state.honoursDisplay = params.get("show") || DEFAULT_STATE.honoursDisplay;
  state.search = params.get("q") || DEFAULT_STATE.search;
  state.teamClub = params.get("teamClub") || DEFAULT_STATE.teamClub;
  state.teamGroup = params.get("teamGroup") || DEFAULT_STATE.teamGroup;
  state.teamDivision = params.get("teamDivision") || DEFAULT_STATE.teamDivision;
  state.teamPlacement = params.get("teamPlacement") || DEFAULT_STATE.teamPlacement;
  state.teamYear = params.get("teamYear") || DEFAULT_STATE.teamYear;
  state.teamView = params.get("teamView") || DEFAULT_STATE.teamView;
}

function normaliseState() {
  const years = new Set((state.data.metadata.years ?? []).map((year) => String(year)));
  const organizations = new Set((state.data.metadata.organizations ?? []).map((item) => item.code));
  const classes = new Set((state.data.metadata.classes ?? []).map((item) => item.code));
  const tabs = new Set((state.data.stageHonours ?? []).map((group) => group.key));
  const divisions = new Set(
    [...(state.data.results ?? []), ...(state.data.teams ?? [])]
      .map((item) => item.division)
      .filter((value) => value && value !== "unknown"),
  );
  const teamGroups = new Set(Object.keys(TEAM_GROUP_META));
  const teamDivisions = new Set(["men", "women", "mixed", "unknown"]);
  const teamPlacements = new Set(["all", "wins", "podiums", "best", "bestTime"]);
  const teamViews = new Set(["archive", "timeSeries"]);

  if (state.selectedYear !== "all" && !years.has(String(state.selectedYear))) {
    state.selectedYear = DEFAULT_STATE.selectedYear;
  }
  if (state.selectedOrganization !== "all" && !organizations.has(state.selectedOrganization)) {
    state.selectedOrganization = DEFAULT_STATE.selectedOrganization;
  }
  if (state.selectedClass !== "all" && !classes.has(state.selectedClass)) {
    state.selectedClass = DEFAULT_STATE.selectedClass;
  }
  if (state.selectedDivision !== "all" && !divisions.has(state.selectedDivision)) {
    state.selectedDivision = DEFAULT_STATE.selectedDivision;
  }
  if (!tabs.has(state.honoursTab)) {
    state.honoursTab = state.data.stageHonours?.[0]?.key ?? DEFAULT_STATE.honoursTab;
  }
  if (!["top5", "top10"].includes(state.honoursDisplay)) {
    state.honoursDisplay = DEFAULT_STATE.honoursDisplay;
  }
  if (state.teamClub !== "all" && !organizations.has(state.teamClub)) {
    state.teamClub = DEFAULT_STATE.teamClub;
  }
  if (state.teamGroup !== "all" && !teamGroups.has(state.teamGroup)) {
    state.teamGroup = DEFAULT_STATE.teamGroup;
  }
  if (state.teamDivision !== "all" && !teamDivisions.has(state.teamDivision)) {
    state.teamDivision = DEFAULT_STATE.teamDivision;
  }
  if (!teamPlacements.has(state.teamPlacement)) {
    state.teamPlacement = DEFAULT_STATE.teamPlacement;
  }
  if (state.teamYear !== "all" && !years.has(String(state.teamYear))) {
    state.teamYear = DEFAULT_STATE.teamYear;
  }
  if (!teamViews.has(state.teamView)) {
    state.teamView = DEFAULT_STATE.teamView;
  }
}

function syncStateToUrl() {
  const url = new URL(window.location.href);

  for (const [paramName, stateKey] of Object.entries(URL_STATE_KEYS)) {
    const value = stateKey === "search" ? state[stateKey].trim() : state[stateKey];
    const defaultValue = DEFAULT_STATE[stateKey];
    if (!value || value === defaultValue) {
      url.searchParams.delete(paramName);
    } else {
      url.searchParams.set(paramName, value);
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

function formatPercent(value) {
  return Number.isFinite(value) ? `${percentFormatter.format(value)} %` : "-";
}

function formatRank(value) {
  return Number.isFinite(value) ? `#${value}` : "-";
}

function formatDistanceMeters(value) {
  if (!Number.isFinite(value)) {
    return "";
  }
  return `${formatNumber(value)} m`;
}

function formatGeneratedAt(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return generatedAtFormatter.format(date);
}

function cleanStageName(label) {
  return String(label ?? "").replace(/^\d+\.\s*/, "");
}

function matchesSearch(haystack, needle) {
  return !needle || haystack.toLowerCase().includes(needle);
}

function getClubName(code) {
  if (code === "all") return "Alle klubber";
  return (
    state.data.metadata.organizations.find((organization) => organization.code === code)?.name ??
    CLUB_META[code]?.shortName ??
    code
  );
}

function getClassName(code) {
  if (code === "all") return "Alle klasser";
  return state.data.metadata.classes.find((item) => item.code === code)?.label ?? code;
}

function getTeamId(row) {
  return row?.team_id ?? row?.id ?? null;
}

function getTeamClassGroup(classCode) {
  return TEAM_CLASS_GROUPS[classCode] ?? (/super/i.test(String(classCode ?? "")) ? "superveteran" : "veteran");
}

function getTeamGroupLabel(group) {
  return TEAM_GROUP_META[group]?.label ?? group;
}

function getDivisionLabel(division) {
  return DIVISION_META[division]?.label ?? DIVISION_META.unknown.label;
}

function sortGroupKeys(a, b) {
  const aSort = TEAM_GROUP_META[a]?.sort ?? 50;
  const bSort = TEAM_GROUP_META[b]?.sort ?? 50;
  if (aSort !== bSort) return aSort - bSort;
  return String(a).localeCompare(String(b), "no");
}

function sortDivisionKeys(a, b) {
  const aSort = DIVISION_META[a]?.sort ?? DIVISION_META.unknown.sort;
  const bSort = DIVISION_META[b]?.sort ?? DIVISION_META.unknown.sort;
  if (aSort !== bSort) return aSort - bSort;
  return String(a).localeCompare(String(b), "no");
}

function formatTimeDelta(seconds) {
  if (!Number.isFinite(seconds)) {
    return "-";
  }
  const sign = seconds > 0 ? "+" : seconds < 0 ? "-" : "";
  const absoluteSeconds = Math.abs(seconds);
  const hours = Math.floor(absoluteSeconds / 3600);
  const minutes = Math.floor((absoluteSeconds % 3600) / 60);
  const remainingSeconds = absoluteSeconds % 60;
  const body = hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  return `${sign}${body}`;
}

function formatBestTime(value) {
  return value ? value : "—";
}

function formatStartsLabel(value) {
  return `${formatNumber(value)} lag`;
}

function formatArchiveHeading(teamItem) {
  if (teamItem.classGroup.startsWith("mix")) {
    return `${formatRank(teamItem.teamRank)} i ${teamItem.classGroupLabel}`;
  }
  return `${formatRank(teamItem.teamRank)} i ${teamItem.classGroupLabel} ${teamItem.divisionLabel.toLowerCase()}`;
}

function getOverviewValue(label) {
  return state.data.overview.kpis.find((item) => item.label === label)?.value ?? 0;
}

function getActiveFilters() {
  const activeFilters = [];

  if (state.selectedYear !== "all") {
    activeFilters.push({ key: "year", label: "År", value: state.selectedYear });
  }
  if (state.selectedOrganization !== "all") {
    activeFilters.push({
      key: "club",
      label: "Klubb",
      value: getClubName(state.selectedOrganization),
    });
  }
  if (state.selectedClass !== "all") {
    activeFilters.push({ key: "class", label: "Klasse", value: getClassName(state.selectedClass) });
  }
  if (state.selectedDivision !== "all") {
    activeFilters.push({
      key: "division",
      label: "Kjønn",
      value: getDivisionLabel(state.selectedDivision),
    });
  }
  if (state.search.trim()) {
    activeFilters.push({ key: "search", label: "Søk", value: state.search.trim() });
  }

  return activeFilters;
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
    const matchesDivision = state.selectedDivision === "all" || row.division === state.selectedDivision;
    const haystack = [
      row.person_name,
      row.raw_name,
      row.team_name,
      row.stage_label,
      row.class_label,
      row.organization_name,
    ].join(" ");
    return (
      matchesYear &&
      matchesOrganization &&
      matchesClass &&
      matchesDivision &&
      matchesSearch(haystack, searchValue)
    );
  });

  const resultTeamIds = new Set(filteredResults.map((row) => getTeamId(row)).filter(Boolean));

  const filteredTeams = state.data.teams.filter((row) => {
    const matchesYear = state.selectedYear === "all" || String(row.year) === state.selectedYear;
    const matchesOrganization =
      state.selectedOrganization === "all" || row.organization_code === state.selectedOrganization;
    const matchesClass = state.selectedClass === "all" || row.class_code === state.selectedClass;
    const matchesDivision = state.selectedDivision === "all" || row.division === state.selectedDivision;
    const haystack = [
      row.team_name,
      row.class_label,
      row.organization_name,
      getDivisionLabel(row.division),
      getTeamGroupLabel(getTeamClassGroup(row.class_code)),
    ].join(" ");
    const matchesTeam = matchesSearch(haystack, searchValue);
    return (
      matchesYear &&
      matchesOrganization &&
      matchesClass &&
      matchesDivision &&
      (!searchValue || matchesTeam || resultTeamIds.has(getTeamId(row)))
    );
  });

  return {
    filteredResults,
    filteredTeams,
    personStats: buildPersonStats(filteredResults),
  };
}

function getAvailableStageGroups() {
  const groups = state.data.stageHonours ?? [];
  const filteredGroups = groups.filter((group) => {
    const matchesOrganization =
      state.selectedOrganization === "all" || group.organization_code === state.selectedOrganization;
    const matchesDivision =
      state.selectedDivision === "all" || group.division === state.selectedDivision;
    return matchesOrganization && matchesDivision;
  });
  const hasScopedFilters =
    state.selectedOrganization !== "all" || state.selectedDivision !== "all";
  return hasScopedFilters ? filteredGroups : groups;
}

function getFilteredStageGroup(groups = getAvailableStageGroups()) {
  const activeGroup = groups.find((group) => group.key === state.honoursTab) ?? groups[0] ?? null;
  if (activeGroup && activeGroup.key !== state.honoursTab) {
    state.honoursTab = activeGroup.key;
  }
  return activeGroup;
}

function getHonourGroupFilter(group) {
  return (
    HONOUR_GROUP_FILTERS[group?.key] ?? {
      organizationCode: group?.organization_code,
      division: group?.division,
      classCodes: state.data.metadata.classes
        .filter((item) => item.organizationCode === group?.organization_code)
        .map((item) => item.code),
    }
  );
}

function sortHonourEntries(a, b) {
  if (a.split_seconds !== b.split_seconds) return a.split_seconds - b.split_seconds;
  const aCategoryRank = a.category_rank ?? Number.POSITIVE_INFINITY;
  const bCategoryRank = b.category_rank ?? Number.POSITIVE_INFINITY;
  if (aCategoryRank !== bCategoryRank) return aCategoryRank - bCategoryRank;
  const aOverallRank = a.oa_rank ?? Number.POSITIVE_INFINITY;
  const bOverallRank = b.oa_rank ?? Number.POSITIVE_INFINITY;
  if (aOverallRank !== bOverallRank) return aOverallRank - bOverallRank;
  return a.year - b.year;
}

function buildHonoursScopeLabel() {
  const parts = [state.selectedYear === "all" ? "Alle år" : state.selectedYear];
  if (state.selectedClass !== "all") {
    parts.push(getClassName(state.selectedClass));
  }
  if (state.selectedDivision !== "all") {
    parts.push(getDivisionLabel(state.selectedDivision));
  }
  if (state.search.trim()) {
    parts.push(`Søk: ${state.search.trim()}`);
  }
  return parts.join(" · ");
}

function getAvailableGlobalDivisions() {
  return [...new Set(state.data.results.map((row) => row.division).filter((value) => value && value !== "unknown"))]
    .sort(sortDivisionKeys);
}

function buildDynamicHonoursGroup(activeGroup, filteredResults) {
  if (!activeGroup) {
    return null;
  }

  const groupFilter = getHonourGroupFilter(activeGroup);
  const groupedByStage = new Map();

  for (const row of filteredResults) {
    if (!Number.isFinite(row.split_seconds)) continue;
    if (row.organization_code !== groupFilter.organizationCode) continue;
    if (row.division !== groupFilter.division) continue;
    if (!groupFilter.classCodes.includes(row.class_code)) continue;

    const stage = activeGroup.stages.find((item) => item.stage_number === row.stage_number);
    const recordSeconds = stage?.record?.record_seconds;
    const percentOfRecord = recordSeconds ? Math.round((recordSeconds / row.split_seconds) * 1000) / 10 : null;
    const entries = groupedByStage.get(row.stage_number) ?? [];
    entries.push({
      rank: 0,
      person_name: row.person_name,
      raw_name: row.raw_name,
      split_text: row.split_text,
      split_seconds: row.split_seconds,
      percent_of_record: percentOfRecord,
      class_code: row.class_code,
      class_label: row.class_label,
      team_name: row.team_name,
      year: row.year,
      oa_rank: row.oa_rank,
      category_rank: row.category_rank,
    });
    groupedByStage.set(row.stage_number, entries);
  }

  return {
    ...activeGroup,
    subtitle: `Rangert per etappe for ${activeGroup.title}. Viser ${buildHonoursScopeLabel()}.`,
    stages: activeGroup.stages.map((stage) => {
      const rankedEntries = (groupedByStage.get(stage.stage_number) ?? [])
        .slice()
        .sort(sortHonourEntries)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
      return {
        ...stage,
        default_limit: 5,
        expanded_limit: 10,
        has_expansion: rankedEntries.length > 5,
        entries: rankedEntries.slice(0, 5),
        expanded_entries: rankedEntries.slice(0, 10),
      };
    }),
  };
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

function buildResultsByTeamId(results) {
  const grouped = new Map();
  for (const row of results) {
    const teamId = getTeamId(row);
    if (!teamId) continue;
    const entries = grouped.get(teamId) ?? [];
    entries.push({
      ...row,
      stage_name: cleanStageName(row.stage_label),
      divisionLabel: getDivisionLabel(row.division),
    });
    grouped.set(teamId, entries);
  }

  for (const entries of grouped.values()) {
    entries.sort((a, b) => a.stage_number - b.stage_number);
  }

  return grouped;
}

function getTeamDivision(team, resultsByTeamId) {
  const classGroup = getTeamClassGroup(team.class_code);
  if (classGroup === "mixSKV" || classGroup === "mixStud") {
    return "mixed";
  }
  if (team.division && team.division !== "unknown") {
    return team.division;
  }

  const divisions = new Set(
    (resultsByTeamId.get(getTeamId(team)) ?? [])
      .map((entry) => entry.division)
      .filter((value) => value && value !== "mixed"),
  );
  if (divisions.size === 1) {
    return [...divisions][0];
  }
  return "unknown";
}

function getBestTeamByTotalTime(teams) {
  return teams
    .filter((team) => Number.isFinite(team.totalSeconds))
    .slice()
    .sort((a, b) => a.totalSeconds - b.totalSeconds || (a.teamRank ?? 999) - (b.teamRank ?? 999))[0] ?? null;
}

function buildTeamArchiveItems(filteredTeams, resultsByTeamId) {
  const items = filteredTeams.map((team) => {
    const teamId = getTeamId(team);
    const lineup = (resultsByTeamId.get(teamId) ?? []).map((entry) => ({
      stage_number: entry.stage_number,
      stage_label: entry.stage_label,
      stage_name: entry.stage_name,
      person_name: entry.person_name,
      split_text: entry.split_text,
      category_rank: entry.category_rank,
      oa_rank: entry.oa_rank,
    }));
    const classGroup = getTeamClassGroup(team.class_code);
    const division = getTeamDivision(team, resultsByTeamId);
    return {
      id: teamId,
      year: team.year,
      organizationCode: team.organization_code,
      organizationName: team.organization_name,
      classCode: team.class_code,
      classLabel: team.class_label,
      classGroup,
      classGroupLabel: getTeamGroupLabel(classGroup),
      division,
      divisionLabel: getDivisionLabel(division),
      teamName: team.team_name,
      totalTimeText: team.total_time_text,
      totalSeconds: Number.isFinite(team.total_seconds) ? team.total_seconds : null,
      teamRank: Number.isFinite(team.team_rank) ? team.team_rank : null,
      lineup,
      stageCount: lineup.length,
      participants: [...new Set(lineup.map((entry) => entry.person_name))],
      isWinner: team.team_rank === 1,
      isPodium: Number.isFinite(team.team_rank) && team.team_rank >= 1 && team.team_rank <= 3,
      isBestRankInGroup: false,
      isBestTimeInGroup: false,
    };
  });

  const grouped = new Map();
  for (const item of items) {
    const groupKey = `${item.organizationCode}|${item.classGroup}|${item.division}`;
    const entries = grouped.get(groupKey) ?? [];
    entries.push(item);
    grouped.set(groupKey, entries);
  }

  for (const entries of grouped.values()) {
    const bestRank = entries.reduce(
      (current, entry) => (Number.isFinite(entry.teamRank) ? Math.min(current, entry.teamRank) : current),
      Number.POSITIVE_INFINITY,
    );
    const bestTime = entries.reduce(
      (current, entry) => (Number.isFinite(entry.totalSeconds) ? Math.min(current, entry.totalSeconds) : current),
      Number.POSITIVE_INFINITY,
    );
    entries.forEach((entry) => {
      entry.isBestRankInGroup = Number.isFinite(entry.teamRank) && entry.teamRank === bestRank;
      entry.isBestTimeInGroup = Number.isFinite(entry.totalSeconds) && entry.totalSeconds === bestTime;
    });
  }

  return items.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    const aRank = a.teamRank ?? Number.POSITIVE_INFINITY;
    const bRank = b.teamRank ?? Number.POSITIVE_INFINITY;
    if (aRank !== bRank) return aRank - bRank;
    const aTime = a.totalSeconds ?? Number.POSITIVE_INFINITY;
    const bTime = b.totalSeconds ?? Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return a.teamName.localeCompare(b.teamName, "no");
  });
}

function buildTeamHonoursByClub(filteredTeams, resultsByTeamId) {
  const archiveItems = buildTeamArchiveItems(filteredTeams, resultsByTeamId);
  const clubCodes =
    state.selectedOrganization === "all" ? Object.keys(CLUB_META) : [state.selectedOrganization];

  return clubCodes
    .map((code) => {
      const items = archiveItems.filter((item) => item.organizationCode === code);
      const participants = new Set(items.flatMap((item) => item.participants));
      const groups = new Map();
      let totalWins = 0;
      let totalPodiums = 0;
      let bestRank = Number.POSITIVE_INFINITY;

      for (const item of items) {
        totalWins += item.isWinner ? 1 : 0;
        totalPodiums += item.isPodium ? 1 : 0;
        if (Number.isFinite(item.teamRank)) {
          bestRank = Math.min(bestRank, item.teamRank);
        }

        const rowKey = `${item.classGroup}|${item.division}`;
        const row = groups.get(rowKey) ?? {
          key: rowKey,
          classGroup: item.classGroup,
          classLabel: item.classGroupLabel,
          division: item.division,
          divisionLabel: item.divisionLabel,
          starts: 0,
          wins: 0,
          podiums: 0,
          bestRank: Number.POSITIVE_INFINITY,
          bestTotalSeconds: Number.POSITIVE_INFINITY,
          bestTotalText: null,
          teams: [],
        };
        row.starts += 1;
        row.wins += item.isWinner ? 1 : 0;
        row.podiums += item.isPodium ? 1 : 0;
        if (Number.isFinite(item.teamRank)) {
          row.bestRank = Math.min(row.bestRank, item.teamRank);
        }
        if (Number.isFinite(item.totalSeconds) && item.totalSeconds < row.bestTotalSeconds) {
          row.bestTotalSeconds = item.totalSeconds;
          row.bestTotalText = item.totalTimeText;
        }
        row.teams.push(item);
        groups.set(rowKey, row);
      }

      const rows = [...groups.values()]
        .map((row) => ({
          ...row,
          bestRank: row.bestRank === Number.POSITIVE_INFINITY ? null : row.bestRank,
          bestTotalSeconds:
            row.bestTotalSeconds === Number.POSITIVE_INFINITY ? null : row.bestTotalSeconds,
          winnerTeams: row.teams.filter((team) => team.isWinner),
          podiumTeams: row.teams.filter((team) => team.isPodium),
          bestRankTeams: row.teams.filter((team) => team.isBestRankInGroup),
          bestTimeTeams: row.teams.filter((team) => team.isBestTimeInGroup),
        }))
        .sort((a, b) => {
          const groupCompare = sortGroupKeys(a.classGroup, b.classGroup);
          if (groupCompare !== 0) return groupCompare;
          return sortDivisionKeys(a.division, b.division);
        });

      return {
        code,
        name: CLUB_META[code]?.shortName ?? code,
        participants: participants.size,
        teams: items.length,
        results: items.reduce((sum, item) => sum + item.stageCount, 0),
        totalWins,
        totalPodiums,
        bestRank: bestRank === Number.POSITIVE_INFINITY ? null : bestRank,
        groups: rows,
      };
    })
    .filter((summary) => summary.teams > 0);
}

function filterTeamArchive(items, archiveState) {
  return items.filter((item) => {
    const matchesClub = archiveState.teamClub === "all" || item.organizationCode === archiveState.teamClub;
    const matchesGroup = archiveState.teamGroup === "all" || item.classGroup === archiveState.teamGroup;
    const matchesDivision =
      archiveState.teamDivision === "all" || item.division === archiveState.teamDivision;
    const matchesYear = archiveState.teamYear === "all" || String(item.year) === String(archiveState.teamYear);
    const matchesPlacement =
      archiveState.teamPlacement === "all" ||
      (archiveState.teamPlacement === "wins" && item.isWinner) ||
      (archiveState.teamPlacement === "podiums" && item.isPodium) ||
      (archiveState.teamPlacement === "best" && item.isBestRankInGroup) ||
      (archiveState.teamPlacement === "bestTime" && item.isBestTimeInGroup);
    return matchesClub && matchesGroup && matchesDivision && matchesYear && matchesPlacement;
  });
}

function groupTeamsForTimeSeries(teams) {
  const grouped = new Map();
  for (const team of teams) {
    if (!Number.isFinite(team.totalSeconds)) continue;
    const key = `${team.organizationCode}|${team.classGroup}|${team.division}`;
    const entry = grouped.get(key) ?? {
      key,
      organizationCode: team.organizationCode,
      organizationName: team.organizationName,
      classGroup: team.classGroup,
      classLabel: team.classGroupLabel,
      division: team.division,
      divisionLabel: team.divisionLabel,
      teams: [],
    };
    entry.teams.push(team);
    grouped.set(key, entry);
  }
  return [...grouped.values()].sort((a, b) => {
    if (a.organizationCode !== b.organizationCode) {
      return a.organizationCode.localeCompare(b.organizationCode, "no");
    }
    const groupCompare = sortGroupKeys(a.classGroup, b.classGroup);
    if (groupCompare !== 0) return groupCompare;
    return sortDivisionKeys(a.division, b.division);
  });
}

function buildTeamTimeSeries(filteredTeams, resultsByTeamId) {
  const archiveItems = buildTeamArchiveItems(filteredTeams, resultsByTeamId);
  return groupTeamsForTimeSeries(archiveItems).map((series) => {
    const years = new Map();
    for (const team of series.teams) {
      const yearEntry = years.get(team.year) ?? { year: team.year, teams: [] };
      yearEntry.teams.push(team);
      years.set(team.year, yearEntry);
    }

    const yearRows = [...years.values()]
      .map((row) => {
        const bestTeam = getBestTeamByTotalTime(row.teams);
        return bestTeam
          ? {
              ...row,
              bestTeam,
              bestTotalSeconds: bestTeam.totalSeconds,
              bestTotalText: bestTeam.totalTimeText,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.year - b.year);

    const seriesBest = yearRows.reduce(
      (current, row) => Math.min(current, row.bestTotalSeconds),
      Number.POSITIVE_INFINITY,
    );

    let previousComparable = null;
    const enhancedYears = yearRows.map((row) => {
      const deltaFromSeriesBestSeconds =
        seriesBest === Number.POSITIVE_INFINITY ? null : row.bestTotalSeconds - seriesBest;
      const deltaFromPreviousComparableYearSeconds = previousComparable
        ? row.bestTotalSeconds - previousComparable.bestTotalSeconds
        : null;
      previousComparable = row;
      return {
        ...row,
        deltaFromSeriesBestSeconds,
        deltaFromPreviousComparableYearSeconds,
      };
    });

    return {
      ...series,
      years: enhancedYears,
      bestTeam: getBestTeamByTotalTime(series.teams),
    };
  });
}

function buildTeamFilterOptions(archiveItems) {
  return {
    clubs: [...new Set(archiveItems.map((item) => item.organizationCode))],
    groups: [...new Set(archiveItems.map((item) => item.classGroup))].sort(sortGroupKeys),
    divisions: [...new Set(archiveItems.map((item) => item.division))].sort(sortDivisionKeys),
    years: [...new Set(archiveItems.map((item) => item.year))].sort((a, b) => b - a),
  };
}

function renderSectionHeader({ eyebrow, title, id = "", meta = "", actions = "" }) {
  const titleId = id ? ` id="${escapeHtml(id)}"` : "";
  return `
    <div class="section-header">
      <div class="section-title">
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h2${titleId}>${escapeHtml(title)}</h2>
      </div>
      ${meta || actions ? `<div class="section-header-meta">${meta}${actions}</div>` : ""}
    </div>
  `;
}

function renderEmptyState(title, text) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

function renderHeader() {
  return `
    <header class="site-header">
      <div class="brand-lockup">
        <span class="brand-logos" aria-label="SK Vidar og OSI Friidrett">
          <a
            class="logo-plate"
            href="https://www.skvidar.no/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Gå til SK Vidar"
          >
            <img class="brand-logo brand-logo-vidar" src="${assetUrl("sk-vidar-logo.png")}" alt="SK Vidar logo" />
          </a>
          <a
            class="logo-plate logo-plate-round"
            href="https://friidrett.osi.no/next/p/28104/home"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Gå til OSI Friidrett"
          >
            <img class="brand-logo brand-logo-osi" src="${assetUrl("osi-logo.png")}" alt="OSI Friidrett logo" />
          </a>
        </span>
        <a class="brand-copy" href="#main-content" aria-label="Gå til HKSstats">
          <span class="eyebrow">Holmenkollstafetten</span>
          <strong>HKSstats SKV + OSI</strong>
        </a>
      </div>
      <div class="header-actions">
        <nav class="top-nav" aria-label="Hovednavigasjon">
          <a href="#hederslister" data-nav-link>Hederlister</a>
          <a href="#klubbmeritter" data-nav-link>Klubbmeritter</a>
          <a href="#lagarkiv" data-nav-link>Lagarkiv</a>
          <a href="#statistikk" data-nav-link>Deltakelse</a>
          <a href="${LEGACY_URL}">Klassisk</a>
        </nav>
        <a class="testlop-header-link" href="${TESTLOP_URL}" aria-label="Åpne HKS testløp">
          <span class="testlop-mark">HKS</span>
          <span>testløp</span>
        </a>
      </div>
    </header>
  `;
}

function renderHero(filteredResults, filteredTeams) {
  const participants = new Set(filteredResults.map((row) => row.person_name)).size;
  const years = buildSeasonHighlights(filteredResults, filteredTeams);
  const earliestYear = years.length ? years[years.length - 1].year : null;
  const latestYear = years.length ? years[0].year : null;
  const periodLabel =
    years.length > 1 ? `${earliestYear}-${latestYear}` : latestYear ?? "2022-2025";
  const totalStages = getOverviewValue("Etapper i databasen");
  const totalTeams = getOverviewValue("Lag importert");
  const totalPeople = getOverviewValue("Unike personer");
  const kpis = [
    { label: "Etapper", value: formatNumber(totalStages), note: "i databasen" },
    { label: "Lag", value: formatNumber(totalTeams), note: "importert" },
    { label: "Personer", value: formatNumber(totalPeople), note: "unike navn" },
    { label: "I filteret", value: formatNumber(filteredResults.length), note: "etappetider" },
  ];

  return `
    <section class="hero-panel" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow hero-eyebrow">Holmenkollstafetten</p>
        <h1 id="hero-title">Statistikk for SK Vidar og OSI</h1>
        <p class="hero-lead">
          Et raskt dashboard for beste etappetider, mest aktive løpere og laghistorikk fra
          Holmenkollstafetten.
        </p>
        <div class="hero-actions">
          <a class="cta-primary" href="#hederslister">Se hederlister</a>
          <a class="cta-secondary" href="#filter-panel">Filtrer data</a>
        </div>
        <dl class="hero-meta">
          <div>
            <dt>Periode</dt>
            <dd>${escapeHtml(periodLabel)}</dd>
          </div>
          <div>
            <dt>Utøvere i filteret</dt>
            <dd>${formatNumber(participants)}</dd>
          </div>
        </dl>
      </div>
      <div class="hero-kpis" aria-label="Nøkkeltall">
        ${kpis
          .map(
            (item) => `
              <article class="stat-tile">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.value)}</strong>
                <small>${escapeHtml(item.note)}</small>
              </article>
            `,
          )
          .join("")}
      </div>
      <figure class="hero-photo-card">
        <picture>
          <source
            type="image/webp"
            srcset="${assetUrl("hero-group-photo-1600.webp")} 1600w, ${assetUrl("hero-group-photo-2400.webp")} 2400w, ${assetUrl("hero-group-photo-3200.webp")} 3200w"
            sizes="(max-width: 720px) calc(100vw - 24px), (max-width: 1180px) calc(100vw - 40px), 44vw"
          />
          <img
            src="${assetUrl("hero-group-photo.jpg")}"
            alt="Løpere fra SK Vidar og OSI Friidrett samlet etter Holmenkollstafetten"
            class="hero-photo"
            width="5605"
            height="2911"
            fetchpriority="high"
            decoding="async"
          />
        </picture>
        <figcaption>SK Vidar og OSI Friidrett, 2025</figcaption>
      </figure>
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
          <p>${escapeHtml(meta.shortName)}</p>
          <strong>${summary.wins ? `${formatNumber(summary.wins)} lagseiere` : "Historikk i utvalget"}</strong>
        </div>
      </div>
      <dl class="club-summary-stats">
        <div><dt>Utøvere</dt><dd>${formatNumber(summary.participants)}</dd></div>
        <div><dt>Lag</dt><dd>${formatNumber(summary.teams)}</dd></div>
        <div><dt>Etapper</dt><dd>${formatCompact(summary.results)}</dd></div>
        <div><dt>Beste plass</dt><dd>${escapeHtml(bestRank)}</dd></div>
      </dl>
    </article>
  `;
}

function renderTeamBadge(label, variant = "neutral") {
  return `<span class="badge badge-${variant}">${escapeHtml(label)}</span>`;
}

function renderStatAction({ label, dataset = {}, disabled = false }) {
  const dataAttrs = Object.entries(dataset)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `data-${key}="${escapeHtml(value)}"`)
    .join(" ");

  if (disabled) {
    return `<span class="stat-action is-disabled">${escapeHtml(label)}</span>`;
  }

  return `<button class="stat-action" type="button" ${dataAttrs}>${escapeHtml(label)}</button>`;
}

function renderClubHonourRow(summary, row) {
  const commonDataset = {
    teamFocus: "true",
    teamClub: summary.code,
    teamGroup: row.classGroup,
    teamDivision: row.division,
  };

  return `
    <div class="club-honour-row">
      <button
        class="club-honour-row-anchor"
        type="button"
        data-team-focus="true"
        data-team-view="timeSeries"
        data-team-club="${escapeHtml(summary.code)}"
        data-team-group="${escapeHtml(row.classGroup)}"
        data-team-division="${escapeHtml(row.division)}"
      >
        <strong>${escapeHtml(row.classLabel)}</strong>
        ${renderTeamBadge(row.divisionLabel, row.division)}
      </button>
      <div class="club-honour-row-actions">
        ${renderStatAction({
          label: `${formatNumber(row.wins)} seire`,
          dataset: { ...commonDataset, teamPlacement: "wins", teamView: "archive" },
        })}
        ${renderStatAction({
          label: `${formatNumber(row.podiums)} pall`,
          dataset: { ...commonDataset, teamPlacement: "podiums", teamView: "archive" },
        })}
        ${renderStatAction({
          label: row.bestRank ? `Beste ${formatRank(row.bestRank)}` : "Beste -",
          dataset: { ...commonDataset, teamPlacement: "best", teamView: "archive" },
          disabled: !row.bestRank,
        })}
        ${renderStatAction({
          label: row.bestTotalText ? `Beste tid ${row.bestTotalText}` : "Beste tid -",
          dataset: { ...commonDataset, teamPlacement: "bestTime", teamView: "archive" },
          disabled: !row.bestTotalText,
        })}
      </div>
      <span class="club-honour-row-meta">${formatStartsLabel(row.starts)}</span>
    </div>
  `;
}

function renderClubHonourCard(summary) {
  const meta = CLUB_META[summary.code];
  return `
    <article class="club-honour-card ${meta.accent}">
      <div class="club-honour-header">
        <img src="${meta.asset}" alt="${meta.shortName} logo" class="club-summary-logo" />
        <div class="club-honour-copy">
          <p>${escapeHtml(meta.shortName)}</p>
          <h3>${escapeHtml(meta.shortName)}</h3>
          <strong>${formatNumber(summary.totalWins ?? 0)} seire · ${formatNumber(summary.totalPodiums ?? 0)} pallplasser</strong>
        </div>
      </div>
      <div class="club-honour-list">
        ${
          summary.groups?.length
            ? summary.groups.map((row) => renderClubHonourRow(summary, row)).join("")
            : renderEmptyState("Ingen lag i utvalget", "Endre filtrene for å se lagmeritter.")
        }
      </div>
      <div class="club-honour-footer">
        <p>${summary.bestRank ? `Beste plass ${formatRank(summary.bestRank)}` : "Beste plass -"}</p>
        <p>${formatNumber(summary.participants)} utøvere · ${formatNumber(summary.teams)} lag · ${formatNumber(summary.results)} etapper</p>
        <small>Pall = 1.-3. plass i klassen</small>
      </div>
    </article>
  `;
}

function renderTeamFilterChip({ label, isActive, dataset = {}, count = null }) {
  const dataAttrs = Object.entries(dataset)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `data-${key}="${escapeHtml(value)}"`)
    .join(" ");

  return `
    <button class="archive-chip ${isActive ? "is-active" : ""}" type="button" ${dataAttrs}>
      <span>${escapeHtml(label)}</span>
      ${count !== null ? `<b>${escapeHtml(formatNumber(count))}</b>` : ""}
    </button>
  `;
}

function renderTeamViewSwitch() {
  return `
    <div class="archive-view-switch" role="tablist" aria-label="Lagvisninger">
      ${renderTeamFilterChip({
        label: "Lagarkiv",
        isActive: state.teamView === "archive",
        dataset: { teamViewSwitch: "archive" },
      })}
      ${renderTeamFilterChip({
        label: "Utvikling i totaltid",
        isActive: state.teamView === "timeSeries",
        dataset: { teamViewSwitch: "timeSeries" },
      })}
    </div>
  `;
}

function renderArchiveFilterBar(archiveItems) {
  const options = buildTeamFilterOptions(archiveItems);
  return `
    <div class="archive-filter-bar">
      <div class="archive-filter-group">
        ${renderTeamFilterChip({
          label: "Alle lag",
          isActive: state.teamPlacement === "all",
          dataset: { teamFilterKey: "teamPlacement", teamFilterValue: "all" },
        })}
        ${renderTeamFilterChip({
          label: "Seiere",
          isActive: state.teamPlacement === "wins",
          dataset: { teamFilterKey: "teamPlacement", teamFilterValue: "wins" },
        })}
        ${renderTeamFilterChip({
          label: "Pallplasser",
          isActive: state.teamPlacement === "podiums",
          dataset: { teamFilterKey: "teamPlacement", teamFilterValue: "podiums" },
        })}
        ${renderTeamFilterChip({
          label: "Beste plass",
          isActive: state.teamPlacement === "best",
          dataset: { teamFilterKey: "teamPlacement", teamFilterValue: "best" },
        })}
        ${renderTeamFilterChip({
          label: "Beste tid",
          isActive: state.teamPlacement === "bestTime",
          dataset: { teamFilterKey: "teamPlacement", teamFilterValue: "bestTime" },
        })}
      </div>
      <div class="archive-filter-group">
        ${renderTeamFilterChip({
          label: "Alle grupper",
          isActive: state.teamGroup === "all",
          dataset: { teamFilterKey: "teamGroup", teamFilterValue: "all" },
        })}
        ${options.groups
          .map((group) =>
            renderTeamFilterChip({
              label: TEAM_GROUP_META[group]?.chipLabel ?? group,
              isActive: state.teamGroup === group,
              dataset: { teamFilterKey: "teamGroup", teamFilterValue: group },
            }),
          )
          .join("")}
      </div>
      <div class="archive-filter-group">
        ${renderTeamFilterChip({
          label: "Alle divisjoner",
          isActive: state.teamDivision === "all",
          dataset: { teamFilterKey: "teamDivision", teamFilterValue: "all" },
        })}
        ${options.divisions
          .map((division) =>
            renderTeamFilterChip({
              label: getDivisionLabel(division),
              isActive: state.teamDivision === division,
              dataset: { teamFilterKey: "teamDivision", teamFilterValue: division },
            }),
          )
          .join("")}
      </div>
      <div class="archive-filter-group">
        ${renderTeamFilterChip({
          label: "Alle klubber",
          isActive: state.teamClub === "all",
          dataset: { teamFilterKey: "teamClub", teamFilterValue: "all" },
        })}
        ${options.clubs
          .map((club) =>
            renderTeamFilterChip({
              label: getClubName(club),
              isActive: state.teamClub === club,
              dataset: { teamFilterKey: "teamClub", teamFilterValue: club },
            }),
          )
          .join("")}
      </div>
      <div class="archive-filter-group">
        ${renderTeamFilterChip({
          label: "Alle år",
          isActive: state.teamYear === "all",
          dataset: { teamFilterKey: "teamYear", teamFilterValue: "all" },
        })}
        ${options.years
          .map((year) =>
            renderTeamFilterChip({
              label: String(year),
              isActive: String(state.teamYear) === String(year),
              dataset: { teamFilterKey: "teamYear", teamFilterValue: String(year) },
            }),
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderTeamLineup(teamItem) {
  return `
    <div class="team-lineup-list">
      ${teamItem.lineup
        .map(
          (entry) => `
            <div class="team-lineup-row">
              <span class="team-lineup-stage">${escapeHtml(entry.stage_number)}. ${escapeHtml(entry.stage_name)}</span>
              <strong class="team-lineup-runner">${escapeHtml(entry.person_name)}</strong>
              <span class="team-lineup-time">${escapeHtml(entry.split_text ?? "-")}</span>
              <span class="team-lineup-rank">Klasse ${escapeHtml(formatRank(entry.category_rank))}</span>
              ${
                entry.oa_rank
                  ? `<span class="team-lineup-rank">O/A ${escapeHtml(formatRank(entry.oa_rank))}</span>`
                  : `<span class="team-lineup-rank team-lineup-rank-muted">O/A -</span>`
              }
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderTeamArchiveCard(teamItem) {
  const isExpanded = Boolean(state.expandedTeams[teamItem.id]);
  const detailsId = `team-lineup-${toDomId(teamItem.id)}`;
  return `
    <article class="archive-card ${CLUB_META[teamItem.organizationCode]?.accent ?? ""}">
      <div class="archive-card-header">
        <div class="archive-card-copy">
          <p class="archive-kicker">${escapeHtml(formatArchiveHeading(teamItem))}</p>
          <h3>${escapeHtml(teamItem.teamName)}</h3>
          <p class="archive-card-meta">Total tid: ${escapeHtml(teamItem.totalTimeText ?? "Total tid mangler")} · ${escapeHtml(teamItem.stageCount)} etapper</p>
        </div>
        <div class="archive-card-tags">
          ${renderTeamBadge(teamItem.classGroupLabel)}
          ${renderTeamBadge(teamItem.divisionLabel, teamItem.division)}
          ${teamItem.isWinner ? renderTeamBadge("Seier", "winner") : ""}
          ${teamItem.isPodium ? renderTeamBadge("Pall", "podium") : ""}
          ${teamItem.isBestTimeInGroup ? renderTeamBadge("Beste tid", "time") : ""}
        </div>
      </div>
      <button
        class="text-link archive-toggle"
        type="button"
        data-team-toggle="${escapeHtml(teamItem.id)}"
        aria-expanded="${isExpanded ? "true" : "false"}"
        aria-controls="${detailsId}"
      >
        ${isExpanded ? "Skjul laget" : "Vis laget"}
      </button>
      <div class="archive-card-details" id="${detailsId}" ${isExpanded ? "" : "hidden"}>
        ${renderTeamLineup(teamItem)}
      </div>
    </article>
  `;
}

function renderTeamArchive(items) {
  const filteredItems = filterTeamArchive(items, state);
  return `
    <section class="content-card section-card" id="lagarkiv" aria-labelledby="lagarkiv-title">
      ${renderSectionHeader({
        eyebrow: "Lagprestasjoner",
        title: "Lagarkiv",
        id: "lagarkiv-title",
        meta: `<span>${formatNumber(filteredItems.length)} lag i visningen</span>`,
      })}
      ${renderArchiveFilterBar(items)}
      <div class="archive-grid">
        ${
          filteredItems.length
            ? filteredItems.map((item) => renderTeamArchiveCard(item)).join("")
            : renderEmptyState("Ingen lag i dette utvalget", "Endre lagfiltrene eller globale filtre for å se laghistorikk.")
        }
      </div>
    </section>
  `;
}

function renderTeamTimeSeriesRow(row, seriesBestSeconds) {
  return `
    <article class="time-series-row">
      <div class="time-series-year">${escapeHtml(row.year)}</div>
      <div class="time-series-copy">
        <strong>${escapeHtml(row.bestTeam.teamName)}</strong>
        <p>${escapeHtml(row.bestTotalText ?? "Total tid mangler")} · ${escapeHtml(formatRank(row.bestTeam.teamRank))}</p>
      </div>
      <dl class="time-series-meta">
        <div>
          <dt>Mot beste</dt>
          <dd>${row.deltaFromSeriesBestSeconds === 0 ? "Beste" : escapeHtml(formatTimeDelta(row.deltaFromSeriesBestSeconds))}</dd>
        </div>
        <div>
          <dt>Mot forrige</dt>
          <dd>${row.deltaFromPreviousComparableYearSeconds === null ? "—" : escapeHtml(formatTimeDelta(row.deltaFromPreviousComparableYearSeconds))}</dd>
        </div>
        <div>
          <dt>Fart</dt>
          <dd>${escapeHtml(formatPercent((seriesBestSeconds / row.bestTotalSeconds) * 100))}</dd>
        </div>
      </dl>
    </article>
  `;
}

function renderTeamTimeSeries(seriesCollection) {
  const filteredSeries = seriesCollection
    .filter((series) => state.teamClub === "all" || series.organizationCode === state.teamClub)
    .filter((series) => state.teamGroup === "all" || series.classGroup === state.teamGroup)
    .filter((series) => state.teamDivision === "all" || series.division === state.teamDivision)
    .map((series) => ({
      ...series,
      years:
        state.teamYear === "all"
          ? series.years
          : series.years.filter((row) => String(row.year) === String(state.teamYear)),
    }))
    .filter((series) => series.years.length);

  return `
    <section class="content-card section-card" id="totaltid" aria-labelledby="totaltid-title">
      ${renderSectionHeader({
        eyebrow: "Totaltid",
        title: "Utvikling i totaltid",
        id: "totaltid-title",
        meta: "<span>Beste lag per år innen samme klubb, klassegruppe og divisjon</span>",
      })}
      <div class="time-series-grid">
        ${
          filteredSeries.length
            ? filteredSeries
                .map((series) => {
                  const seriesBestSeconds = series.bestTeam?.totalSeconds ?? Number.POSITIVE_INFINITY;
                  return `
                    <article class="time-series-card ${CLUB_META[series.organizationCode]?.accent ?? ""}">
                      <div class="time-series-card-header">
                        <div>
                          <p>${escapeHtml(series.organizationName)}</p>
                          <h3>${escapeHtml(series.classLabel)} · ${escapeHtml(series.divisionLabel)}</h3>
                        </div>
                        ${series.bestTeam ? `<strong>${escapeHtml(series.bestTeam.totalTimeText ?? "-")}</strong>` : ""}
                      </div>
                      <div class="time-series-list">
                        ${series.years.map((row) => renderTeamTimeSeriesRow(row, seriesBestSeconds)).join("")}
                      </div>
                    </article>
                  `;
                })
                .join("")
            : renderEmptyState("Ingen sammenlignbare totaltider", "Velg en klubb, gruppe eller divisjon som har totaltider på tvers av år.")
        }
      </div>
    </section>
  `;
}

function renderClubHonoursSection(clubSummaries) {
  return `
    <section class="content-card section-card" id="klubbmeritter" aria-labelledby="klubbmeritter-title">
      ${renderSectionHeader({
        eyebrow: "Lagprestasjoner",
        title: "Klubbmeritter",
        id: "klubbmeritter-title",
        meta: "<span>Pall = 1.-3. plass i klassen</span>",
      })}
      <div class="club-honour-grid">
        ${
          clubSummaries.length
            ? clubSummaries.map((summary) => renderClubHonourCard(summary)).join("")
            : renderEmptyState("Ingen klubbmeritter i utvalget", "Juster filtrene for Ã¥ hente frem laghistorikk.")
        }
      </div>
    </section>
  `;
}

function renderTeamHub(archiveItems, teamTimeSeries) {
  return `
    <section class="team-hub-stack" aria-label="Lagarkiv og totaltid">
      <div class="team-hub-toolbar content-card section-card">
        ${renderSectionHeader({
          eyebrow: "Navigasjon",
          title: "Lagvisning",
          meta: "<span>Bytt mellom lagkort og utvikling i totaltid</span>",
        })}
        ${renderTeamViewSwitch()}
      </div>
      ${renderTeamArchive(archiveItems)}
      ${renderTeamTimeSeries(teamTimeSeries)}
    </section>
  `;
}

function renderActiveFilterChips(activeFilters) {
  if (!activeFilters.length) {
    return `<span class="filter-chip filter-chip-neutral">Alle resultater</span>`;
  }

  return activeFilters
    .map(
      (filter) => `
        <button class="filter-chip" type="button" data-filter-remove="${escapeHtml(filter.key)}">
          <span>${escapeHtml(filter.label)}:</span>
          ${escapeHtml(filter.value)}
          <b aria-hidden="true">×</b>
          <span class="sr-only">Fjern ${escapeHtml(filter.label)}</span>
        </button>
      `,
    )
    .join("");
}

function renderFilterPanel(filteredResults, filteredTeams) {
  const activeFilters = getActiveFilters();
  const hasActiveFilters = activeFilters.length > 0;
  const divisionOptions = getAvailableGlobalDivisions();

  return `
    <section class="filter-shell ${state.filtersOpen ? "is-open" : ""}" id="filter-panel" aria-label="Filtrer resultater">
      <div class="filter-head">
        <div class="filter-title">
          <p class="eyebrow">Filter</p>
          <strong>${formatNumber(filteredResults.length)} etapper · ${formatNumber(filteredTeams.length)} lag</strong>
        </div>
        <div class="filter-actions">
          <button class="reset-button" type="button" data-reset-filters ${hasActiveFilters ? "" : "disabled"}>
            Nullstill filtre
          </button>
          <button
            class="filter-toggle"
            type="button"
            aria-expanded="${state.filtersOpen ? "true" : "false"}"
            aria-controls="filter-controls"
            data-filter-toggle
          >
            Filtre
          </button>
        </div>
      </div>
      <div class="active-filter-row" aria-label="Aktive filtre">
        ${renderActiveFilterChips(activeFilters)}
      </div>
      <div class="filter-controls" id="filter-controls">
        <div class="filter-grid">
          <label>
            <span>År</span>
            <select id="year-filter" name="year">
              <option value="all">Alle år</option>
              ${state.data.metadata.years
                .map(
                  (year) =>
                    `<option value="${escapeHtml(year)}" ${
                      String(year) === state.selectedYear ? "selected" : ""
                    }>${escapeHtml(year)}</option>`,
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
                    <option value="${escapeHtml(organization.code)}" ${
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
                    <option value="${escapeHtml(item.code)}" ${item.code === state.selectedClass ? "selected" : ""}>
                      ${escapeHtml(item.label)}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>
          <label>
            <span>Kjønn</span>
            <select id="division-filter" name="division">
              <option value="all">Alle kjønn</option>
              ${divisionOptions
                .map(
                  (division) => `
                    <option value="${escapeHtml(division)}" ${
                      division === state.selectedDivision ? "selected" : ""
                    }>
                      ${escapeHtml(getDivisionLabel(division))}
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
              placeholder="Lag, løper eller etappe"
              autocomplete="off"
            />
          </label>
        </div>
      </div>
    </section>
  `;
}

function renderRecordPanel(record) {
  if (!record) {
    return "";
  }

  return `
    <div class="record-panel">
      <span>Etapperekord</span>
      <strong>${escapeHtml(record.record_text)}</strong>
      <small>${escapeHtml(record.record_holder)} · ${escapeHtml(record.record_club)} ${escapeHtml(
        record.record_year,
      )}</small>
    </div>
  `;
}

function renderHonourEntryRow(entry) {
  return `
    <tr>
      <td class="rank-cell">${escapeHtml(entry.rank)}</td>
      <td class="name-cell">
        <strong>${escapeHtml(entry.person_name)}</strong>
        <span>${escapeHtml(entry.team_name)}</span>
      </td>
      <td class="time-cell">${escapeHtml(entry.split_text ?? "-")}</td>
      <td>${escapeHtml(entry.year)}</td>
      <td>${escapeHtml(formatPercent(entry.percent_of_record))}</td>
      <td>${escapeHtml(formatRank(entry.oa_rank))}</td>
      <td>${escapeHtml(formatRank(entry.category_rank))}</td>
    </tr>
  `;
}

function renderHonourEntryCard(entry) {
  return `
    <article class="result-card">
      <span class="result-rank">${escapeHtml(entry.rank)}</span>
      <div class="result-main">
        <strong>${escapeHtml(entry.person_name)}</strong>
        <span>${escapeHtml(entry.team_name)}</span>
      </div>
      <div class="result-time">
        <strong>${escapeHtml(entry.split_text ?? "-")}</strong>
        <span>${escapeHtml(entry.year)}</span>
      </div>
      <dl class="result-meta">
        <div><dt>%</dt><dd>${escapeHtml(formatPercent(entry.percent_of_record))}</dd></div>
        <div><dt>O/A</dt><dd>${escapeHtml(formatRank(entry.oa_rank))}</dd></div>
        <div><dt>Cat</dt><dd>${escapeHtml(formatRank(entry.category_rank))}</dd></div>
      </dl>
    </article>
  `;
}

function renderStageCard(activeGroup, stage) {
  const stageKey = `${activeGroup.key}:${stage.stage_number}`;
  const stageDomId = toDomId(stageKey);
  const isExpanded = Boolean(state.expandedHonours[stageKey]);
  const entries =
    state.honoursDisplay === "top10" || isExpanded
      ? stage.expanded_entries ?? stage.entries
      : stage.entries;
  const hasEntries = entries.length > 0;

  return `
    <article class="stage-card">
      <div class="stage-card-header">
        <div>
          <p class="stage-kicker">Etappe ${String(stage.stage_number).padStart(2, "0")}</p>
          <h3>${escapeHtml(cleanStageName(stage.stage_label))}</h3>
        </div>
        ${
          stage.distance_m
            ? `<span class="distance-pill">${escapeHtml(formatDistanceMeters(stage.distance_m))}</span>`
            : ""
        }
      </div>
      ${renderRecordPanel(stage.record)}
      ${hasEntries ? `
      <div class="table-wrap" id="stage-results-${stageDomId}">
        <table class="mini-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Navn og lag</th>
              <th>Tid</th>
              <th>År</th>
              <th>%</th>
              <th>O/A</th>
              <th>Cat</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map((entry) => renderHonourEntryRow(entry)).join("")}
          </tbody>
        </table>
      </div>
      <div class="result-card-list" aria-label="Toppresultater for ${escapeHtml(stage.stage_label)}">
        ${entries.map((entry) => renderHonourEntryCard(entry)).join("")}
      </div>
      ` : renderEmptyState("Ingen treff på denne etappen", "Endre år, klasse eller søk for å se flere resultater.")}
      ${
        hasEntries && stage.has_expansion && state.honoursDisplay !== "top10"
          ? `
            <button
              class="text-link"
              type="button"
              data-stage-toggle="${escapeHtml(stageKey)}"
              aria-expanded="${isExpanded ? "true" : "false"}"
              aria-controls="stage-results-${stageDomId}"
            >
              ${isExpanded ? "Vis færre" : "Vis topp 10"}
            </button>
          `
          : ""
      }
    </article>
  `;
}

function renderHonoursSection(activeGroup, honourGroups) {
  if (!activeGroup) {
    return "";
  }

  const displaySelect = `
    <label class="compact-select">
      <span class="sr-only">Antall resultater</span>
      <select id="honours-display-filter" name="show">
        <option value="top5" ${state.honoursDisplay === "top5" ? "selected" : ""}>Topp 5</option>
        <option value="top10" ${state.honoursDisplay === "top10" ? "selected" : ""}>Topp 10</option>
      </select>
    </label>
  `;

  return `
    <section class="content-card section-card" id="hederslister" aria-labelledby="hederslister-title">
      <div class="section-header">
        <div class="section-title">
          <p class="eyebrow">Etappe for etappe</p>
          <h2 id="hederslister-title">Hederliste per etappe</h2>
        </div>
        <div class="section-header-meta">
          <span>${escapeHtml(activeGroup.subtitle)}</span>
          ${displaySelect}
        </div>
      </div>
      <div class="pill-row" role="tablist" aria-label="Klubb og klasse">
        ${honourGroups
          .map(
            (group) => `
              <button
                class="pill-button ${group.key === activeGroup.key ? "is-active" : ""}"
                type="button"
                data-tab="${escapeHtml(group.key)}"
                role="tab"
                aria-selected="${group.key === activeGroup.key ? "true" : "false"}"
                aria-controls="honours-panel"
              >
                ${escapeHtml(group.title)}
              </button>
            `,
          )
          .join("")}
      </div>
      <dl class="metric-legend">
        <div><dt>%</dt><dd>fart mot offisiell etapperekord, der 100 % er rekordfart</dd></div>
        <div><dt>O/A</dt><dd>plassering totalt på etappen når feltet finnes</dd></div>
        <div><dt>Cat</dt><dd>plassering i klasse eller kategori</dd></div>
      </dl>
      <div class="honours-grid" id="honours-panel">
        ${activeGroup.stages.map((stage) => renderStageCard(activeGroup, stage)).join("")}
      </div>
    </section>
  `;
}

function renderParticipationSection(personStats, fastestSplits, classBreakdown) {
  const maxClassValue = Math.max(...classBreakdown.map((row) => row.results), 1);

  return `
    <section class="stats-grid" id="statistikk" aria-labelledby="statistikk-title">
      <article class="content-card section-card">
        ${renderSectionHeader({
          eyebrow: "Personer",
          title: "Mest deltakelse",
          id: "statistikk-title",
          meta: `<span>${formatNumber(personStats.length)} personer i filteret</span>`,
        })}
        <div class="leaderboard-list">
          ${
            personStats.length
              ? personStats
                  .slice(0, 8)
                  .map(
                    (row, index) => `
                      <article class="leader-card">
                        <span class="leader-rank">${index + 1}</span>
                        <div class="leader-copy">
                          <strong>${escapeHtml(row.canonical_name)}</strong>
                          <p>${escapeHtml(row.organizations.join(" / "))} · ${formatNumber(row.seasons)} sesonger</p>
                        </div>
                        <div class="leader-values">
                          <strong>${formatNumber(row.appearances)}</strong>
                          <span>starter</span>
                        </div>
                      </article>
                    `,
                  )
                  .join("")
              : renderEmptyState("Ingen personer i utvalget", "Utvid filteret eller nullstill søket for å se deltakelse.")
          }
        </div>
      </article>

      <article class="content-card section-card">
        ${renderSectionHeader({
          eyebrow: "Tempo",
          title: "Raskeste splittider",
          meta: "<span>Direkte fra resultatene</span>",
        })}
        <div class="spotlight-list">
          ${
            fastestSplits.length
              ? fastestSplits
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
                  .join("")
              : renderEmptyState("Ingen splittider", "Filteret gir ingen tider å rangere.")
          }
        </div>
      </article>

      <article class="content-card section-card section-span">
        ${renderSectionHeader({
          eyebrow: "Klasser",
          title: "Fordeling i utvalget",
          meta: "<span>Basert på gjeldende filter</span>",
        })}
        <div class="class-breakdown">
          ${
            classBreakdown.length
              ? classBreakdown
                  .slice(0, 8)
                  .map((row) => {
                    const width = Math.max(8, (row.results / maxClassValue) * 100);
                    return `
                      <div class="class-row">
                        <div class="class-label">
                          <strong>${escapeHtml(row.label)}</strong>
                          <span>${formatNumber(row.people)} personer</span>
                        </div>
                        <div class="class-bar" aria-hidden="true"><span style="width:${width}%"></span></div>
                        <b>${formatNumber(row.results)}</b>
                      </div>
                    `;
                  })
                  .join("")
              : renderEmptyState("Ingen klassefordeling", "Det finnes ingen etappetider for dette filteret.")
          }
        </div>
      </article>
    </section>
  `;
}

function renderTeamCard(team) {
  const meta = CLUB_META[team.organization_code];
  return `
    <article class="team-card ${meta?.accent ?? ""}">
      <div class="team-card-main">
        ${meta ? `<img src="${meta.asset}" alt="${meta.shortName} logo" class="team-logo" />` : ""}
        <div class="team-card-copy">
          <span>${escapeHtml(team.year)} · ${escapeHtml(team.class_label)}</span>
          <strong>${escapeHtml(team.team_name)}</strong>
          <p>${escapeHtml(team.organization_name)}</p>
        </div>
      </div>
      <dl class="team-card-stats">
        <div><dt>Total tid</dt><dd>${escapeHtml(team.total_time_text ?? "-")}</dd></div>
        <div><dt>Plass</dt><dd>${escapeHtml(formatRank(team.team_rank))}</dd></div>
      </dl>
    </article>
  `;
}

function renderSeasonHighlights(seasonHighlights) {
  if (!seasonHighlights.length) {
    return renderEmptyState("Ingen sesonger", "Filteret gir ingen sesongtreff.");
  }

  return `
    <div class="season-list">
      ${seasonHighlights
        .slice(0, 5)
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
  `;
}

function renderTeamsSection(filteredTeams, seasonHighlights) {
  return `
    <section class="teams-layout" id="klubber" aria-labelledby="klubber-title">
      <div class="teams-main content-card section-card">
        ${renderSectionHeader({
          eyebrow: "Lag",
          title: "Lag i utvalget",
          id: "klubber-title",
          meta: `<span>${formatNumber(filteredTeams.length)} lag</span>`,
        })}
        <div class="team-grid">
          ${
            filteredTeams.length
              ? filteredTeams.slice(0, 12).map((team) => renderTeamCard(team)).join("")
              : renderEmptyState("Ingen lag i utvalget", "Endre eller nullstill filtrene for å hente lag tilbake.")
          }
        </div>
      </div>

      <aside class="teams-rail" aria-label="Sesonger og data">
        <section class="content-card section-card compact-stack">
          ${renderSectionHeader({ eyebrow: "Sesonger", title: "År i utvalget" })}
          ${renderSeasonHighlights(seasonHighlights)}
        </section>

        <section class="content-card section-card compact-stack source-card">
          ${renderSectionHeader({ eyebrow: "Data", title: "Datagrunnlag" })}
          <p>
            Frontenden leser fra <code>public/data/site-data.json</code> og publiseres som statisk
            GitHub Pages-side.
          </p>
          <a class="inline-link" href="${REPOSITORY_URL}">Se repoet på GitHub</a>
        </section>
      </aside>
    </section>
  `;
}

function renderFooter() {
  const generatedAt = formatGeneratedAt(state.data.generatedAt);
  return `
    <footer class="site-footer">
      <p>Datakilde: HKS-resultater for SK Vidar og OSI Friidrett.</p>
      ${generatedAt ? `<p>Sist oppdatert: ${escapeHtml(generatedAt)}</p>` : ""}
      <nav aria-label="Footer">
        <a href="${REPOSITORY_URL}">GitHub</a>
        <a href="${LEGACY_URL}">Klassisk versjon</a>
      </nav>
    </footer>
  `;
}

function removeFilter(filterKey) {
  if (filterKey === "year") state.selectedYear = DEFAULT_STATE.selectedYear;
  if (filterKey === "club") state.selectedOrganization = DEFAULT_STATE.selectedOrganization;
  if (filterKey === "class") state.selectedClass = DEFAULT_STATE.selectedClass;
  if (filterKey === "division") state.selectedDivision = DEFAULT_STATE.selectedDivision;
  if (filterKey === "search") state.search = DEFAULT_STATE.search;
  state.filtersOpen = true;
  render();
}

function resetFilters() {
  state.selectedYear = DEFAULT_STATE.selectedYear;
  state.selectedOrganization = DEFAULT_STATE.selectedOrganization;
  state.selectedClass = DEFAULT_STATE.selectedClass;
  state.selectedDivision = DEFAULT_STATE.selectedDivision;
  state.search = DEFAULT_STATE.search;
  state.teamClub = DEFAULT_STATE.teamClub;
  state.teamGroup = DEFAULT_STATE.teamGroup;
  state.teamDivision = DEFAULT_STATE.teamDivision;
  state.teamPlacement = DEFAULT_STATE.teamPlacement;
  state.teamYear = DEFAULT_STATE.teamYear;
  state.teamView = DEFAULT_STATE.teamView;
  state.expandedTeams = {};
  state.expandedHonours = {};
  render();
}

function scrollToSection(sectionId) {
  requestAnimationFrame(() => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setTeamView(view) {
  state.teamView = view === "timeSeries" ? "timeSeries" : "archive";
}

function updateTeamFilter(filterKey, filterValue) {
  if (!["teamClub", "teamGroup", "teamDivision", "teamPlacement", "teamYear"].includes(filterKey)) {
    return;
  }
  const nextValue = filterValue ?? "all";
  state[filterKey] = state[filterKey] === nextValue && nextValue !== "all" ? "all" : nextValue;
}

function applyTeamFocus(dataset) {
  state.teamClub = dataset.teamClub || DEFAULT_STATE.teamClub;
  state.teamGroup = dataset.teamGroup || DEFAULT_STATE.teamGroup;
  state.teamDivision = dataset.teamDivision || DEFAULT_STATE.teamDivision;
  state.teamPlacement = dataset.teamPlacement || DEFAULT_STATE.teamPlacement;
  state.teamYear = dataset.teamYear || DEFAULT_STATE.teamYear;
  setTeamView(dataset.teamView || DEFAULT_STATE.teamView);
  render();
  scrollToSection(state.teamView === "timeSeries" ? "totaltid" : "lagarkiv");
}

function attachEvents() {
  document.querySelector("#year-filter")?.addEventListener("change", (event) => {
    state.selectedYear = event.target.value;
    state.filtersOpen = true;
    render();
  });
  document.querySelector("#organization-filter")?.addEventListener("change", (event) => {
    state.selectedOrganization = event.target.value;
    state.filtersOpen = true;
    render();
  });
  document.querySelector("#class-filter")?.addEventListener("change", (event) => {
    state.selectedClass = event.target.value;
    state.filtersOpen = true;
    render();
  });
  document.querySelector("#division-filter")?.addEventListener("change", (event) => {
    state.selectedDivision = event.target.value;
    state.filtersOpen = true;
    render();
  });
  document.querySelector("#honours-display-filter")?.addEventListener("change", (event) => {
    state.honoursDisplay = event.target.value;
    render();
  });
  document.querySelector("#search-filter")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    state.filtersOpen = true;
    render();
    document.querySelector("#search-filter")?.focus();
  });
  document.querySelector("[data-filter-toggle]")?.addEventListener("click", () => {
    state.filtersOpen = !state.filtersOpen;
    render();
  });
  document.querySelector("[data-reset-filters]")?.addEventListener("click", resetFilters);
  document.querySelectorAll("[data-filter-remove]").forEach((button) => {
    button.addEventListener("click", (event) => {
      removeFilter(event.currentTarget.dataset.filterRemove);
    });
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
  document.querySelectorAll("[data-team-focus]").forEach((button) => {
    button.addEventListener("click", (event) => {
      applyTeamFocus(event.currentTarget.dataset);
    });
  });
  document.querySelectorAll("[data-team-filter-key]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const { teamFilterKey, teamFilterValue } = event.currentTarget.dataset;
      updateTeamFilter(teamFilterKey, teamFilterValue);
      render();
      scrollToSection(state.teamView === "timeSeries" ? "totaltid" : "lagarkiv");
    });
  });
  document.querySelectorAll("[data-team-view-switch]").forEach((button) => {
    button.addEventListener("click", (event) => {
      setTeamView(event.currentTarget.dataset.teamViewSwitch);
      render();
      scrollToSection(state.teamView === "timeSeries" ? "totaltid" : "lagarkiv");
    });
  });
  document.querySelectorAll("[data-team-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const teamId = event.currentTarget.dataset.teamToggle;
      state.expandedTeams[teamId] = !state.expandedTeams[teamId];
      render();
      scrollToSection("lagarkiv");
    });
  });
}

function setupNavState() {
  const links = [...document.querySelectorAll("[data-nav-link]")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  function setActive(id) {
    links.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  setActive(window.location.hash.replace("#", "") || "hederslister");

  if (navObserver) {
    navObserver.disconnect();
  }
  if (!("IntersectionObserver" in window)) {
    return;
  }

  navObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) {
        setActive(visible.target.id);
      }
    },
    { rootMargin: "-24% 0px -58% 0px", threshold: [0.08, 0.2, 0.4] },
  );

  sections.forEach((section) => navObserver.observe(section));
}

function render() {
  if (!state.data) {
    app.innerHTML = `<p class="loading-state">Laster data...</p>`;
    return;
  }

  const { filteredResults, filteredTeams, personStats } = filterData();
  const honourGroups = getAvailableStageGroups();
  const activeGroup = getFilteredStageGroup(honourGroups);
  const honoursGroup = buildDynamicHonoursGroup(activeGroup, filteredResults);
  syncStateToUrl();
  const resultsByTeamId = buildResultsByTeamId(filteredResults);
  const clubSummaries = buildTeamHonoursByClub(filteredTeams, resultsByTeamId);
  const archiveItems = buildTeamArchiveItems(filteredTeams, resultsByTeamId);
  const teamTimeSeries = buildTeamTimeSeries(filteredTeams, resultsByTeamId);
  const fastestSplits = buildFastestSplits(filteredResults);
  const classBreakdown = buildClassBreakdown(filteredResults);

  app.innerHTML = `
    <div class="page-shell">
      <div class="page-backdrop" aria-hidden="true"></div>
      ${renderHeader()}
      <main id="main-content">
        ${renderHero(filteredResults, filteredTeams)}
        ${renderFilterPanel(filteredResults, filteredTeams)}
        ${renderHonoursSection(honoursGroup, honourGroups)}
        ${renderClubHonoursSection(clubSummaries)}
        ${renderTeamHub(archiveItems, teamTimeSeries)}
        ${renderParticipationSection(personStats, fastestSplits, classBreakdown)}
      </main>
      ${renderFooter()}
    </div>
  `;

  attachEvents();
  setupNavState();
}

async function bootstrap() {
  readStateFromUrl();
  app.innerHTML = `<p class="loading-state">Laster data...</p>`;

  const dataUrl = new URL(DATA_URL);
  dataUrl.searchParams.set("v", DATA_VERSION);

  const response = await fetch(dataUrl.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Kunne ikke hente datafilen (${response.status}).`);
  }

  state.data = await response.json();
  normaliseState();
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
