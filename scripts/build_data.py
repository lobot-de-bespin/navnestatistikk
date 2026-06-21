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
BIRTHS_TABLE = "05803"
SEX_BIRTHS_TABLE = "09745"


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


def build() -> dict:
    metadata = request_json(f"{API_V2}/{NAME_TABLE}/metadata?lang=no")
    name_codes = sorted_codes(metadata["dimension"]["Fornavn"]["category"])
    year_codes = sorted_codes(metadata["dimension"]["Tid"]["category"])
    name_labels = metadata["dimension"]["Fornavn"]["category"]["label"]
    years = [int(y) for y in year_codes]

    name_data = post_table(
        NAME_TABLE,
        [
            all_query("Fornavn"),
            item_query("ContentsCode", ["Personer"]),
            all_query("Tid"),
        ],
    )
    values = name_data.get("value", [])
    shape = name_data["size"]

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
            val = value_at(values, shape, (ni, 0, yi))
            if val is None:
                continue
            count = int(val)
            points.append([yi, count])
            per_year_sex[(yi, sex)].append((ni, count))
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
        for yi, count in record["points"]:
            rank = ranks[ni].get(yi)
            series.append([yi, count, rank])
            counts.append((yi, count))
        total = sum(count for _, count in counts)
        peak_i, peak_count = max(counts, key=lambda item: (item[1], -item[0]))
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
            }
        )

    records.sort(key=lambda r: (r["sex"], r["name"], r["id"]))
    return {
        "meta": {
            "builtAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "source": "Statistisk sentralbyrå",
            "license": "CC BY 4.0",
            "nameTable": NAME_TABLE,
            "birthsTable": BIRTHS_TABLE,
            "sexBirthsTable": SEX_BIRTHS_TABLE,
            "nameTableUpdated": metadata.get("updated"),
            "notes": metadata.get("note", []),
        },
        "years": years,
        "totalBirths": total_births,
        "sexBirths": sex_births,
        "names": records,
    }


def main() -> int:
    DOCS.joinpath("assets").mkdir(parents=True, exist_ok=True)
    data = build()
    DATA_OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {DATA_OUT} ({DATA_OUT.stat().st_size / 1024:.1f} KiB)")
    print(f"Names: {len(data['names'])}; years: {data['years'][0]}-{data['years'][-1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
