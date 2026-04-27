from __future__ import annotations

import json
import shutil
from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT / ".build-static-site"
DOCS_DIR = ROOT / "docs"
PRESERVE_DIR = ROOT / ".build-preserve-docs"
PRESERVED_DOCS_SUBTREES = ("testlop",)
SITE_DATA_PATH = ROOT / "public" / "data" / "site-data.json"


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

def render_app_shell(prefix: str, title: str, description: str) -> str:
    safe_title = escape(title, quote=True)
    safe_description = escape(description, quote=True)
    return f"""<!doctype html>
<html lang="no">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
    />
    <meta name="referrer" content="no-referrer" />
    <meta name="description" content="{safe_description}" />
    <meta name="theme-color" content="#f6f0e6" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link
      rel="preload"
      as="image"
      href="{prefix}public/assets/v2/hero-group-photo-2400.webp"
      imagesrcset="{prefix}public/assets/v2/hero-group-photo-1600.webp 1600w, {prefix}public/assets/v2/hero-group-photo-2400.webp 2400w, {prefix}public/assets/v2/hero-group-photo-3200.webp 3200w"
      imagesizes="(max-width: 720px) calc(100vw - 24px), (max-width: 1180px) calc(100vw - 40px), 44vw"
      type="image/webp"
      fetchpriority="high"
    />
    <link rel="stylesheet" href="{prefix}v2/styles.css" />
    <title>{safe_title}</title>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Hopp til innhold</a>
    <div id="app"></div>
    <script type="module" src="{prefix}v2/app.js"></script>
  </body>
</html>
"""


def generate_route_shells(dist_dir: Path) -> None:
    if not SITE_DATA_PATH.exists():
        return

    site_data = json.loads(SITE_DATA_PATH.read_text(encoding="utf-8"))
    for person in site_data.get("people", []):
        profile_slug = person.get("profile_slug")
        if not profile_slug:
            continue
        target = dist_dir / "person" / profile_slug / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            render_app_shell(
                "../../",
                f'{person.get("canonical_name", "Person")} | HKSstats',
                "Personprofil med HKS-resultater, aliaser, klubbhistorikk og testløp-kobling.",
            ),
            encoding="utf-8",
        )

    quality_target = dist_dir / "avvik" / "index.html"
    quality_target.parent.mkdir(parents=True, exist_ok=True)
    quality_target.write_text(
        render_app_shell("../", "Avvik og navnekvalitet | HKSstats", "Avviksside for HKSstats."),
        encoding="utf-8",
    )


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
    generate_route_shells(DIST_DIR)

    preserved_docs = preserve_docs_subtrees()

    if DOCS_DIR.exists():
        shutil.rmtree(DOCS_DIR)
    shutil.copytree(DIST_DIR, DOCS_DIR, dirs_exist_ok=True)
    restore_docs_subtrees(preserved_docs)

    print(f"Built static site in {DIST_DIR} and mirrored it to {DOCS_DIR}.")


if __name__ == "__main__":
    main()
