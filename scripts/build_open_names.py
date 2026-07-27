#!/usr/bin/env python3
"""Build a curated open-data name catalogue without Norwegian history."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import urllib.request
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SSB_DATA = ROOT / "docs" / "assets" / "names-data.json"
OUTPUT = ROOT / "docs" / "assets" / "open-names.json"
SOURCE_URL = "https://archive.ics.uci.edu/static/public/591/data.csv"
SOURCE_PAGE = "https://archive.ics.uci.edu/dataset/591/gender+by+name"
SOURCE_DOI = "10.24432/C55G7X"
MIN_SOURCE_COUNT = 2_500
MIN_GENDER_SHARE = 0.90
BLOCKLIST = {
    "baby",
    "child",
    "female",
    "infant",
    "male",
    "none",
    "null",
    "test",
    "unknown",
    "unnamed",
}


def search_key(value: str) -> str:
    return value.strip().casefold()


def valid_name(value: str) -> bool:
    return (
        2 <= len(value) <= 24
        and value.casefold() not in BLOCKLIST
        and value[0].isalpha()
        and value[-1].isalpha()
        and all(character.isalpha() or character in "-'" for character in value)
        and "--" not in value
        and "''" not in value
    )


def read_source(path: Path | None) -> str:
    if path:
        return path.read_text(encoding="utf-8-sig")
    request = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": "lobot-navnestatistikk/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read().decode("utf-8-sig")


def source_rows(csv_text: str) -> list[dict]:
    # Group case-only variants before calculating the dominant gender.
    grouped: dict[str, dict] = defaultdict(
        lambda: {"display": "", "display_count": 0, "female": 0, "male": 0}
    )
    for row in csv.DictReader(io.StringIO(csv_text)):
        name = row["Name"].strip()
        if not valid_name(name):
            continue
        count = int(row["Count"])
        entry = grouped[search_key(name)]
        if count > entry["display_count"]:
            entry["display"] = name
            entry["display_count"] = count
        entry["female" if row["Gender"] == "F" else "male"] += count
    return list(grouped.values())


def build(csv_text: str) -> dict:
    ssb = json.loads(SSB_DATA.read_text(encoding="utf-8"))
    existing = {(search_key(item["name"]), item["sex"]) for item in ssb["names"]}
    records = []
    for row in source_rows(csv_text):
        female = row["female"]
        male = row["male"]
        total = female + male
        dominant = max(female, male)
        gender_share = dominant / total
        sex = "jente" if female > male else "gutt"
        name = row["display"]
        if (
            total < MIN_SOURCE_COUNT
            or gender_share < MIN_GENDER_SHARE
            or (search_key(name), sex) in existing
        ):
            continue
        digest = hashlib.sha1(f"{sex}:{search_key(name)}".encode("utf-8")).hexdigest()[:12]
        records.append(
            {
                "id": f"UCI-{digest}",
                "key": search_key(name),
                "name": name,
                "sex": sex,
                "series": [],
                "total": 0,
                "peakYear": None,
                "peakCount": None,
                "firstYear": None,
                "lastYear": None,
                "firstDataYear": None,
                "lastDataYear": None,
                "dataKind": "international-open",
                "sourceCount": total,
                "genderShare": round(gender_share, 4),
            }
        )
    records.sort(key=lambda item: (item["sex"], item["name"].casefold(), item["id"]))
    return {
        "meta": {
            "builtAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "source": "UCI Machine Learning Repository: Gender by Name",
            "sourceUrl": SOURCE_PAGE,
            "dataUrl": SOURCE_URL,
            "doi": SOURCE_DOI,
            "license": "CC BY 4.0",
            "sourceAuthorities": [
                "US Social Security Administration",
                "Office for National Statistics (England and Wales)",
                "British Columbia",
                "Australian Attorney-General's Department",
            ],
            "selection": {
                "minimumSourceCount": MIN_SOURCE_COUNT,
                "minimumDominantGenderShare": MIN_GENDER_SHARE,
                "note": "Counts are only used for source filtering and are not Norwegian prevalence.",
            },
        },
        "names": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, help="Optional local copy of UCI data.csv")
    args = parser.parse_args()
    data = build(read_source(args.input))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024:.1f} KiB)")
    print(f"Additional names: {len(data['names'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
