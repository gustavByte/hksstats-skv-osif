# Contributing

Dette repoet publiserer en statisk GitHub Pages-side fra `main/docs`.

## Standard arbeidsflyt

Dette er standarden fremover:

1. Gjør endringer i kildefilene i repo-roten eller i `scripts/`.
2. Kjør:
   - `python scripts/build_data.py`
   - `python scripts/build_static_site.py`
3. Kontroller at genererte filer er oppdatert:
   - `public/data/site-data.json`
   - `docs/`
4. Commit endringene samlet.
5. Opprett helst en PR mot `main`.
6. Vent til `Validate`-workflowen er grønn før merge.

## Kilde og genererte filer

- `index.html`, `app.js`, `styles.css` er kildefiler.
- `public/data/site-data.json` er generert data for nettsiden.
- `docs/` er publiseringsmappen for GitHub Pages og skal være et speil av gjeldende bygg.

Man skal ikke redigere `docs/` manuelt som primærkilde. Endringer skal gjøres i kildefilene og bygges inn i `docs/`.

## Ikke publiser arbeidsfiler

Disse filene skal være lokale arbeidsfiler, ikke offentlige artefakter:

- `data/hksstats.sqlite`
- `data/name_match_review.csv`

De brukes i bygging og kvalitetssikring, men skal ikke kopieres til `public/` eller `docs/`.

## Sikkerhet og kvalitet

- Bruk `escapeHtml` for dynamiske tekstverdier i frontend.
- Ikke legg inn nye eksterne scripts uten at CSP vurderes samtidig.
- Ikke svekk `Content-Security-Policy` uten en konkret teknisk grunn.
- Hvis du endrer byggflyten, oppdater også `README.md`, `CONTRIBUTING.md` og relevante workflows.
