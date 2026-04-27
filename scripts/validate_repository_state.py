from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
NORWEGIAN_TRANSLITERATION = str.maketrans(
    {
        "Æ": "AE",
        "Ø": "O",
        "Å": "A",
        "æ": "ae",
        "ø": "o",
        "å": "a",
    }
)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_site_data(payload: dict) -> dict:
    clone = dict(payload)
    clone["generatedAt"] = None
    return clone


def normalize_text(value: str) -> str:
    folded = str(value).translate(NORWEGIAN_TRANSLITERATION)
    stripped = "".join(
        ch for ch in unicodedata.normalize("NFKD", folded) if not unicodedata.combining(ch)
    )
    stripped = stripped.lower().strip()
    stripped = re.sub(r"[^a-z0-9 ]+", " ", stripped)
    return re.sub(r"\s+", " ", stripped).strip()


def edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            current.append(
                min(
                    current[j - 1] + 1,
                    previous[j] + 1,
                    previous[j - 1] + (ca != cb),
                )
            )
        previous = current
    return previous[-1]


def assert_condition(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def find_people(payload: dict, query: str) -> list[dict]:
    normalized_query = normalize_text(query)
    query_tokens = normalized_query.split()
    matches = []
    for person in payload.get("people", []):
        search_names = person.get("search_names") or [person.get("canonical_name", "")]
        normalized_names = [normalize_text(name) for name in search_names]
        search_tokens = set(person.get("search_tokens") or [])
        if any(normalized_query in name for name in normalized_names) or all(
            token in search_tokens for token in query_tokens
        ):
            matches.append(person)
    return matches


def has_fuzzy_person(payload: dict, query: str, expected_name: str) -> bool:
    query_tokens = normalize_text(query).split()
    for person in payload.get("people", []):
        if person.get("canonical_name") != expected_name:
            continue
        candidate_tokens = set()
        for name in person.get("search_names") or [person.get("canonical_name", "")]:
            candidate_tokens.update(normalize_text(name).split())
        return all(
            any(
                token == candidate
                or (
                    min(len(token), len(candidate)) >= 4
                    and edit_distance(token, candidate) <= 1
                )
                for candidate in candidate_tokens
            )
            for token in query_tokens
        )
    return False


def validate_site_data() -> None:
    current_public = read_json(ROOT / "public" / "data" / "site-data.json")
    current_docs = read_json(ROOT / "docs" / "public" / "data" / "site-data.json")

    assert_condition(
        normalize_site_data(current_public) == normalize_site_data(current_docs),
        "public/data/site-data.json and docs/public/data/site-data.json are not in sync.",
    )

    people = current_public.get("people", [])
    results = current_public.get("results", [])
    people_by_id = {person.get("person_id"): person for person in people}
    profile_slugs = [person.get("profile_slug") for person in people]
    profile_paths = [person.get("profile_path") for person in people]

    assert_condition(people, "site-data.json must export people.")
    assert_condition(all(people_by_id), "Every person must have person_id.")
    assert_condition(len(people_by_id) == len(people), "person_id values must be unique.")
    assert_condition(len(set(profile_slugs)) == len(profile_slugs), "Person profile slugs must be unique.")
    assert_condition(len(set(profile_paths)) == len(profile_paths), "Person profile URLs must be unique.")

    for result in results:
        person_id = result.get("person_id")
        assert_condition(person_id, f"Result {result.get('id')} is missing person_id.")
        assert_condition(
            person_id in people_by_id,
            f"Result {result.get('id')} references unknown person_id {person_id}.",
        )

    for group in current_public.get("stageHonours", []):
        for stage in group.get("stages", []):
            for entry in [*stage.get("entries", []), *stage.get("expanded_entries", [])]:
                person_id = entry.get("person_id")
                assert_condition(person_id in people_by_id, "Stage honour entry references unknown person_id.")

    assert_condition(
        any(person.get("canonical_name") == "Matias Brekkå" for person in find_people(current_public, "matias")),
        "Search contract failed: q=matias must find Matias Brekkå.",
    )
    assert_condition(
        any(person.get("canonical_name") == "Matias Brekkå" for person in find_people(current_public, "brekka")),
        "Search contract failed: brekka must find Brekkå.",
    )
    assert_condition(
        any("hakon" in " ".join(person.get("search_names", [])) for person in find_people(current_public, "hakon")),
        "Search contract failed: hakon must find Håkon/Hakon names.",
    )
    assert_condition(
        has_fuzzy_person(current_public, "matias", "Mathias Moen"),
        "Search contract failed: matias must have Mathias Moen as a fuzzy-capable suggestion.",
    )

    for person in people:
        profile_slug = person.get("profile_slug")
        assert_condition(
            (ROOT / "docs" / "person" / profile_slug / "index.html").exists(),
            f"Missing generated GitHub Pages profile for {profile_slug}.",
        )

    app_js = (ROOT / "v2" / "app.js").read_text(encoding="utf-8")
    assert_condition("renderSearchPanel" in app_js, "V2 app must render an explicit search result panel.")
    assert_condition("renderPersonLink" in app_js, "V2 app must render person names as profile links.")


def validate_no_public_downloads() -> None:
    assert_condition(
        not (ROOT / "public" / "downloads").exists(),
        "public/downloads must not exist.",
    )
    assert_condition(
        not (ROOT / "docs" / "downloads").exists(),
        "docs/downloads must not exist.",
    )


def main() -> int:
    validate_no_public_downloads()
    validate_site_data()
    print("Repository state validation passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
