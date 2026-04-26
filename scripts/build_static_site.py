from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT / ".build-static-site"
DOCS_DIR = ROOT / "docs"
PRESERVE_DIR = ROOT / ".build-preserve-docs"
PRESERVED_DOCS_SUBTREES = ("testlop",)


def copy_if_exists(source: Path, target: Path) -> None:
    if source.is_dir():
        shutil.copytree(source, target, dirs_exist_ok=True)
    elif source.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def preserve_docs_subtrees() -> dict[str, Path]:
    if PRESERVE_DIR.exists():
        shutil.rmtree(PRESERVE_DIR)

    preserved: dict[str, Path] = {}
    for subtree in PRESERVED_DOCS_SUBTREES:
        source = DOCS_DIR / subtree
        if source.exists():
            target = PRESERVE_DIR / subtree
            shutil.copytree(source, target)
            preserved[subtree] = target
    return preserved


def restore_docs_subtrees(preserved: dict[str, Path]) -> None:
    for subtree, source in preserved.items():
        target = DOCS_DIR / subtree
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(source, target)

    if PRESERVE_DIR.exists():
        shutil.rmtree(PRESERVE_DIR)


def main() -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True)

    copy_if_exists(ROOT / "index.html", DIST_DIR / "index.html")
    copy_if_exists(ROOT / ".nojekyll", DIST_DIR / ".nojekyll")
    copy_if_exists(ROOT / "styles.css", DIST_DIR / "styles.css")
    copy_if_exists(ROOT / "app.js", DIST_DIR / "app.js")
    copy_if_exists(ROOT / "legacy", DIST_DIR / "legacy")
    copy_if_exists(ROOT / "v2", DIST_DIR / "v2")
    copy_if_exists(ROOT / "public", DIST_DIR / "public")

    preserved_docs = preserve_docs_subtrees()

    if DOCS_DIR.exists():
        shutil.rmtree(DOCS_DIR)
    shutil.copytree(DIST_DIR, DOCS_DIR, dirs_exist_ok=True)
    restore_docs_subtrees(preserved_docs)

    print(f"Built static site in {DIST_DIR} and mirrored it to {DOCS_DIR}.")


if __name__ == "__main__":
    main()
