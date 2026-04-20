# HKSstatsSKV&OSIF

Statistikkprosjekt for Holmenkollstafetten med data fra arbeidsboken `HKS-resultater 2022 – d.d..xlsx`.

Prosjektet gjør tre ting:

1. Leser årsarkene for 2022-2025 og lagrer alle etapper og lag i en SQLite-database.
2. Lager en review-fil for navnematching slik at sammenslåing av personer alltid må godkjennes manuelt.
3. Bygger en offentlig statisk nettside som kan publiseres på GitHub Pages uten Node-avhengigheter.

## Innhold

- `scripts/build_data.py`
  Leser Excel-filen, bygger `data/hksstats.sqlite`, oppdaterer `data/name_match_review.csv`, og genererer JSON for nettsiden.
- `scripts/build_static_site.py`
  Pakker den statiske nettsiden til `dist/` og speiler den til `docs/`.
- `data/hksstats.sqlite`
  Databasen som nettsiden bygges fra.
- `data/name_match_review.csv`
  Arbeidsfil for manuell godkjenning av navnematching.
- `index.html`, `app.js`, `styles.css`
  Den publiserte statiske nettsiden.

## Navnematching

Hvert rånavn fra Excel blir først registrert som egen person. Deretter genererer skriptet forsiktige forslag til mulige sammenslåinger.

Arbeidsflyt:

1. Kjør `python scripts/build_data.py`.
2. Åpne `data/name_match_review.csv`.
3. Sett `decision` til `approve` eller `reject`.
4. Kjør `python scripts/build_data.py` på nytt.

Ved `approve` blir aliaset koblet til valgt kanonisk navn i databasen. Ved `reject` blir forslaget liggende som avvist og slås ikke sammen.

## Lokal utvikling

Krav:

- Python 3.12+

Installer og kjør:

```bash
python -m pip install -r requirements.txt
python scripts/build_data.py
python scripts/build_static_site.py
```

Ny databygning:

```bash
python scripts/build_data.py
```

Produksjonsbygg:

```bash
python scripts/build_static_site.py
```

## Publisering

Repoet er lagt opp for GitHub Pages fra `main/docs`.

Når innholdet oppdateres:

1. Kjør `python scripts/build_data.py`.
2. Kjør `python scripts/build_static_site.py`.
3. Kontroller at `public/data/site-data.json` og `docs/` er oppdatert.
4. Commit endringene samlet.
5. Opprett helst en PR til `main` og vent til `Validate`-workflowen er grønn.

Da publiserer GitHub Pages innholdet som ligger i `docs/`.

## Standard fremover

- Kilde endres i repo-roten og i `scripts/`, ikke direkte i `docs/`.
- `docs/` skal alltid være et bygget speil av den publiserte versjonen.
- Arbeidsfiler som SQLite-database og navnematch-review skal ikke publiseres offentlig.
- `Validate`-workflowen er standard kvalitetssperre for nye endringer.

Se også `CONTRIBUTING.md` og `SECURITY.md`.

## Datamodell

SQLite-databasen inneholder egne tabeller for:

- `organizations`
- `team_classes`
- `events`
- `people`
- `person_aliases`
- `teams`
- `stages`
- `results`

Dette gjør det enkelt å bygge videre med flere lag og flere arrangementer senere, uten å låse seg til dagens Excel-oppsett.
