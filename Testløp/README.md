# HKS testløp

Statisk Astro-side for HKS testløp. `Resultater` i `data/Testlop_HKS.xlsx` er eneste hovedkilde; personer, topplister, rekorder, statistikk, avvik og sammenligning bygges derfra.

## Lokal utvikling

```bash
python -m pip install -r requirements.txt
npm install
npm run dev
```

Produksjonsbygg:

```bash
npm run build
```

`npm run build` kjører først:

```bash
python scripts/export-data.py
python scripts/validate-data.py
```

Deretter bygger Astro statiske sider til `dist/`.

## Dataflyt

```text
data/Testlop_HKS.xlsx
  -> scripts/export-data.py
  -> src/data/*.json
  -> Astro-sider i src/pages
  -> dist/
```

Genererte datafiler:

- `results.json`
- `people.json`
- `leaderboards.json`
- `records.json`
- `matrices.json`
- `stats.json`
- `quality.json`

## Validering

`scripts/validate-data.py` stopper bygg ved harde databrudd som duplikat `resultat_id`, manglende `person_id`, ugyldig kjønn/distanse eller gyldige resultater uten tid.

Manuelle navnepar rapporteres som advarsler som standard:

```bash
python scripts/validate-data.py
```

For å gjøre åpne navnepar til byggfeil:

```bash
python scripts/validate-data.py --strict-names
```

## GitHub Pages

Workflowen i `.github/workflows/deploy.yml` bygger data og Astro-side før publisering med GitHub Pages Actions.

Hvis denne mappen brukes som egen repo-rot, fungerer workflowen direkte. Hvis den beholdes som undermappe i et større repo, må workflowen ligge i repo-roten og bruke `working-directory: Testløp`.
