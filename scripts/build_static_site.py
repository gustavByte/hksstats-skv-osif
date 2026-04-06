from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT / "dist"


def copy_if_exists(source: Path, target: Path) -> None:
    if source.is_dir():
        shutil.copytree(source, target, dirs_exist_ok=True)
    elif source.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def main() -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True)

    copy_if_exists(ROOT / "index.html", DIST_DIR / "index.html")
    copy_if_exists(ROOT / "styles.css", DIST_DIR / "styles.css")
    copy_if_exists(ROOT / "app.js", DIST_DIR / "app.js")
    copy_if_exists(ROOT / "public" / "data", DIST_DIR / "public" / "data")
    copy_if_exists(ROOT / "public" / "downloads", DIST_DIR / "downloads")

    print(f"Built static site in {DIST_DIR}.")


if __name__ == "__main__":
    main()
