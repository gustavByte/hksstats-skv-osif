from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def read_head_file(path: str) -> str:
    result = subprocess.run(
        ["git", "show", f"HEAD:{path}"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return result.stdout


def normalize_site_data(payload: dict) -> dict:
    clone = dict(payload)
    clone["generatedAt"] = None
    return clone


def assert_condition(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def validate_site_data() -> None:
    current_public = read_json(ROOT / "public" / "data" / "site-data.json")
    current_docs = read_json(ROOT / "docs" / "public" / "data" / "site-data.json")
    head_public = json.loads(read_head_file("public/data/site-data.json"))
    head_docs = json.loads(read_head_file("docs/public/data/site-data.json"))

    assert_condition(
        normalize_site_data(current_public) == normalize_site_data(head_public),
        "public/data/site-data.json differs from committed version beyond generatedAt.",
    )
    assert_condition(
        normalize_site_data(current_docs) == normalize_site_data(head_docs),
        "docs/public/data/site-data.json differs from committed version beyond generatedAt.",
    )
    assert_condition(
        normalize_site_data(current_public) == normalize_site_data(current_docs),
        "public/data/site-data.json and docs/public/data/site-data.json are not in sync.",
    )


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
