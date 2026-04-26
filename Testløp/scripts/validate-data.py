from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "src" / "data"


def load_json(name: str) -> Any:
    path = DATA_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Mangler generert datafil: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--strict-names",
        action="store_true",
        help="Feil bygg hvis manuelle navnepar fortsatt peker til ulike person_id-er.",
    )
    args = parser.parse_args()

    results = load_json("results.json")
    quality = load_json("quality.json")

    errors: list[str] = []
    warnings: list[str] = []

    ids = [row.get("id") for row in results]
    duplicate_ids = sorted({result_id for result_id in ids if ids.count(result_id) > 1})
    if duplicate_ids:
        errors.append(f"resultat_id er ikke unik: {', '.join(duplicate_ids)}")

    for index, row in enumerate(results, start=1):
        label = row.get("id") or f"rad {index}"
        if not row.get("personId"):
            errors.append(f"{label}: person_id mangler")
        if not row.get("name"):
            errors.append(f"{label}: navn mangler")
        if row.get("gender") not in {"Kvinner", "Menn"}:
            errors.append(f"{label}: kjønn er ikke Kvinner eller Menn")
        if row.get("distance") not in {600, 1200}:
            errors.append(f"{label}: distanse er ikke 600 eller 1200")
        if row.get("validToplist") and row.get("timeSeconds") is None:
            errors.append(f"{label}: gyldig_toppliste har ikke gyldig tid")
        if row.get("validRecord") and row.get("timeSeconds") is None:
            errors.append(f"{label}: gyldig_rekord har ikke gyldig tid")
        if row.get("date") and not re.match(r"^\d{4}-\d{2}-\d{2}$", row["date"]):
            errors.append(f"{label}: dato er ikke ISO-format")
        if not row.get("date"):
            warnings.append(f"{label}: dato mangler")

    open_name_groups = [
        group
        for group in quality.get("manualNameReview", [])
        if group.get("needsReview")
    ]
    if open_name_groups:
        message = (
            f"{len(open_name_groups)} manuelle navnegrupper peker fortsatt til ulike person_id-er"
        )
        if args.strict_names:
            errors.append(message)
        else:
            warnings.append(message)

    for warning in warnings:
        print(f"WARNING: {warning}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(f"Validated {len(results)} results with {len(warnings)} warning(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
