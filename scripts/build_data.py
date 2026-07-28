#!/usr/bin/env python3
"""Build static data for the SSB Norwegian name explorer."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DATA_OUT = DOCS / "assets" / "names-data.json"

API_V0 = "https://data.ssb.no/api/v0/no/table"
API_V2 = "https://data.ssb.no/api/pxwebapi/v2/tables"
NAME_TABLE = "10467"
POPULATION_NAMES_TABLE = "10501"
BIRTHS_TABLE = "05803"
SEX_BIRTHS_TABLE = "09745"
SOURCE_CATALOG = {
    "ssb-10467": {
        "label": "Navn brukt på nyfødte",
        "publisher": "Statistisk sentralbyrå",
        "url": f"https://www.ssb.no/statbank/table/{NAME_TABLE}/",
        "license": "CC BY 4.0",
        "provides": ["norwayUse", "birthSeries"],
    },
    "ssb-10501": {
        "label": "Navnebærere i befolkningen",
        "publisher": "Statistisk sentralbyrå",
        "url": f"https://www.ssb.no/statbank/table/{POPULATION_NAMES_TABLE}/",
        "license": "CC BY 4.0",
        "provides": ["populationSeries"],
    },
}


def request_json(url: str, payload: dict | None = None) -> dict:
    data = None
    headers = {"User-Agent": "lobot-navnestatistikk/1.0"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if payload else "GET")
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} from {url}: {body[:500]}") from exc


def post_table(table_id: str, query: list[dict]) -> dict:
    return request_json(
        f"{API_V0}/{table_id}",
        {
            "query": query,
            "response": {"format": "JSON-stat2"},
        },
    )


def sorted_codes(category: dict) -> list[str]:
    index = category["index"]
    return [code for code, _ in sorted(index.items(), key=lambda item: item[1])]


def item_query(code: str, values: list[str]) -> dict:
    return {"code": code, "selection": {"filter": "item", "values": values}}


def all_query(code: str) -> dict:
    return {"code": code, "selection": {"filter": "all", "values": ["*"]}}


def value_at(values: list, shape: list[int], coords: tuple[int, ...]):
    flat = 0
    stride = 1
    for axis in range(len(shape) - 1, -1, -1):
        flat += coords[axis] * stride
        stride *= shape[axis]
    if flat >= len(values):
        return None
    return values[flat]


def clean_name_id(code: str) -> tuple[str, str]:
    if code.startswith("1"):
        return "jente", code[1:]
    if code.startswith("2"):
        return "gutt", code[1:]
    return "ukjent", code


def attach_catalog_metadata(record: dict) -> None:
    """Describe what is documented without coupling the UI to a source."""
    source_refs = ["ssb-10467"] if record.get("series") else []
    if record.get("populationSeries"):
        source_refs.append("ssb-10501")
    record["gender"] = record["sex"]
    record["coverage"] = {
        "identity": True,
        "norwayUse": bool(source_refs),
        "birthSeries": bool(record.get("series")),
        "populationSeries": bool(record.get("populationSeries")),
        "meaning": False,
        "origin": False,
        "pronunciation": False,
    }
    record["sourceRefs"] = source_refs
    record["factSources"] = {
        "identity": source_refs,
        "gender": source_refs,
        "norwayUse": source_refs,
        "birthSeries": ["ssb-10467"] if record.get("series") else [],
        "populationSeries": ["ssb-10501"] if record.get("populationSeries") else [],
    }


def validate_catalog(payload: dict) -> None:
    source_ids = set(payload["meta"]["sourceCatalog"])
    seen_ids = set()
    for record in payload["names"]:
        if not record.get("id") or record["id"] in seen_ids:
            raise ValueError(f"Invalid or duplicate name id: {record.get('id')!r}")
        seen_ids.add(record["id"])
        if not record.get("name") or record.get("gender") not in {"jente", "gutt"}:
            raise ValueError(f"Missing required identity fields for {record['id']}")
        coverage = record.get("coverage", {})
        if not coverage.get("identity"):
            raise ValueError(f"Identity coverage missing for {record['id']}")
        if coverage.get("birthSeries") != bool(record.get("series")):
            raise ValueError(f"Birth-series coverage mismatch for {record['id']}")
        if coverage.get("populationSeries") != bool(record.get("populationSeries")):
            raise ValueError(f"Population-series coverage mismatch for {record['id']}")
        if not set(record.get("sourceRefs", [])).issubset(source_ids):
            raise ValueError(f"Unknown source reference for {record['id']}")
        for refs in record.get("factSources", {}).values():
            if not set(refs).issubset(source_ids):
                raise ValueError(f"Unknown fact source reference for {record['id']}")


def build() -> dict:
    metadata = request_json(f"{API_V2}/{NAME_TABLE}/metadata?lang=no")
    population_metadata = request_json(f"{API_V2}/{POPULATION_NAMES_TABLE}/metadata?lang=no")
    name_data = post_table(
        NAME_TABLE,
        [
            all_query("Fornavn"),
            item_query("ContentsCode", ["PersonerProsent", "Personer"]),
            all_query("Tid"),
        ],
    )
    # Use the dimensions returned with the data response. SSB v0 data and v2
    # metadata can have slightly different category indexes.
    name_codes = sorted_codes(name_data["dimension"]["Fornavn"]["category"])
    year_codes = sorted_codes(name_data["dimension"]["Tid"]["category"])
    name_labels = name_data["dimension"]["Fornavn"]["category"]["label"]
    years = [int(y) for y in year_codes]
    values = name_data.get("value", [])
    shape = name_data["size"]
    content_codes = sorted_codes(name_data["dimension"]["ContentsCode"]["category"])
    share_index = content_codes.index("PersonerProsent")
    count_index = content_codes.index("Personer")

    births = post_table(
        BIRTHS_TABLE,
        [
            item_query("ContentsCode", ["Levendefodte"]),
            item_query("Tid", year_codes),
        ],
    )
    birth_values = births.get("value", [])
    total_births = [int(v) if v is not None else None for v in birth_values]

    sex_births_raw = post_table(
        SEX_BIRTHS_TABLE,
        [
            item_query("Kjonn", ["11", "10"]),
            item_query("ContentsCode", ["Levendefodte"]),
            all_query("Tid"),
        ],
    )
    sex_year_codes = sorted_codes(sex_births_raw["dimension"]["Tid"]["category"])
    sex_years = [int(y) for y in sex_year_codes]
    sex_shape = sex_births_raw["size"]
    sex_values = sex_births_raw.get("value", [])
    sex_births = {"jente": {}, "gutt": {}}
    for sex_index, sex in enumerate(("jente", "gutt")):
        for yi, year in enumerate(sex_years):
            val = value_at(sex_values, sex_shape, (sex_index, 0, yi))
            if val is not None:
                sex_births[sex][str(year)] = int(val)

    raw_records = []
    per_year_sex = defaultdict(list)
    for ni, code in enumerate(name_codes):
        sex, bare_id = clean_name_id(code)
        label = name_labels.get(code, bare_id).replace("_", " ")
        points = []
        for yi, year in enumerate(years):
            share_val = value_at(values, shape, (ni, share_index, yi))
            count_val = value_at(values, shape, (ni, count_index, yi))
            if share_val is None and count_val is None:
                continue
            count = int(count_val) if count_val is not None else None
            share = float(share_val) if share_val is not None else None
            points.append([yi, count, share])
            rank_value = count if count is not None else share
            if rank_value is not None:
                per_year_sex[(yi, sex)].append((ni, rank_value))
        raw_records.append(
            {
                "id": code,
                "key": bare_id,
                "name": label,
                "sex": sex,
                "points": points,
            }
        )

    ranks: dict[int, dict[int, int]] = defaultdict(dict)
    for (yi, sex), rows in per_year_sex.items():
        rows.sort(key=lambda item: (-item[1], raw_records[item[0]]["name"]))
        previous_count = None
        previous_rank = 0
        for pos, (ni, count) in enumerate(rows, start=1):
            rank = previous_rank if count == previous_count else pos
            ranks[ni][yi] = rank
            previous_count = count
            previous_rank = rank

    records = []
    for ni, record in enumerate(raw_records):
        series = []
        counts = []
        for yi, count, share in record["points"]:
            rank = ranks[ni].get(yi)
            series.append([yi, count, rank, share])
            if count is not None:
                counts.append((yi, count))
        total = sum(count for _, count in counts)
        peak_i, peak_count = max(counts, key=lambda item: (item[1], -item[0])) if counts else (record["points"][0][0], None)
        records.append(
            {
                "id": record["id"],
                "key": record["key"],
                "name": record["name"],
                "sex": record["sex"],
                "series": series,
                "total": total,
                "peakYear": years[peak_i],
                "peakCount": peak_count,
                "firstYear": years[counts[0][0]],
                "lastYear": years[counts[-1][0]],
                "firstDataYear": years[record["points"][0][0]],
                "lastDataYear": years[record["points"][-1][0]],
            }
        )

    population_year_codes = sorted_codes(population_metadata["dimension"]["Tid"]["category"])
    population_data = post_table(
        POPULATION_NAMES_TABLE,
        [
            all_query("Fornavn"),
            item_query("ContentsCode", ["Personer"]),
            item_query("Tid", population_year_codes),
        ],
    )
    population_codes = sorted_codes(population_data["dimension"]["Fornavn"]["category"])
    population_values = population_data.get("value", [])
    population_shape = population_data["size"]
    population_rows = []
    for ni, code in enumerate(population_codes):
        population_series = []
        for yi, year in enumerate(population_year_codes):
            value = value_at(population_values, population_shape, (ni, 0, yi))
            if value is not None:
                population_series.append([int(year), int(value)])
        if not population_series:
            continue
        population_rows.append(
            {
                "id": code,
                "sex": clean_name_id(code)[0],
                "populationSeries": population_series,
                "populationCount": population_series[-1][1]
                if population_series[-1][0] == int(population_year_codes[-1])
                else None,
            }
        )

    population_ranks = {}
    for sex in ("jente", "gutt"):
        rows = sorted(
            (row for row in population_rows if row["sex"] == sex and row["populationCount"] is not None),
            key=lambda row: (-row["populationCount"], row["id"]),
        )
        previous_count = None
        previous_rank = 0
        for position, row in enumerate(rows, start=1):
            rank = previous_rank if row["populationCount"] == previous_count else position
            population_ranks[row["id"]] = rank
            previous_count = row["populationCount"]
            previous_rank = rank

    # 10501 enriches only names already admitted through the birth-series
    # catalogue. It must never expand the catalogue by itself.
    records_by_id = {record["id"]: record for record in records}
    for row in population_rows:
        record = records_by_id.get(row["id"])
        if not record:
            continue
        record["populationSeries"] = row["populationSeries"]
        if row["populationCount"] is not None:
            record["populationCount"] = row["populationCount"]
            record["populationRank"] = population_ranks[row["id"]]

    for record in records:
        attach_catalog_metadata(record)
    records.sort(key=lambda r: (r["sex"], r["name"], r["id"]))
    payload = {
        "meta": {
            "schemaVersion": 2,
            "builtAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "source": "Statistisk sentralbyrå",
            "license": "CC BY 4.0",
            "sourceCatalog": SOURCE_CATALOG,
            "nameTable": NAME_TABLE,
            "populationNamesTable": POPULATION_NAMES_TABLE,
            "birthsTable": BIRTHS_TABLE,
            "sexBirthsTable": SEX_BIRTHS_TABLE,
            "nameTableUpdated": metadata.get("updated"),
            "populationNamesTableUpdated": population_metadata.get("updated"),
            "populationYear": int(population_year_codes[-1]),
            "populationHistoryNames": sum(1 for record in records if record.get("populationSeries")),
            "populationCurrentNames": sum(1 for record in records if record.get("populationCount") is not None),
            "notes": metadata.get("note", []),
        },
        "years": years,
        "totalBirths": total_births,
        "sexBirths": sex_births,
        "names": records,
    }
    validate_catalog(payload)
    return payload


def main() -> int:
    DOCS.joinpath("assets").mkdir(parents=True, exist_ok=True)
    data = build()
    DATA_OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {DATA_OUT} ({DATA_OUT.stat().st_size / 1024:.1f} KiB)")
    print(f"Names: {len(data['names'])}; years: {data['years'][0]}-{data['years'][-1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
