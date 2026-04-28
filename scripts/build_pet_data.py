"""Process the official Simple-RocoPVP pet data into compact files
for our app. Source: data_init_project/rocom.aoe.top/public/data/.

Outputs (to app/src-tauri/resources/config/):
  pets.json          slim pet records (id, name, types, base_stats, move_types)
  combo_index.json   { comboId: { types, member_ids, move_types } }
  valid_duals.json   replace placeholder with real dual-type combos
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data_init_project" / "rocom.aoe.top" / "public" / "data"
OUT_DIR = ROOT / "app" / "src-tauri" / "resources" / "config"

# Official short zh names → our project's canonical names.
# Project uses official names except 地→地面.
TYPE_ALIAS = {
    "地": "地面",
}

# 18 canonical types in our project's order.
CANONICAL_TYPES = {
    "普通","草","水","火","电","翼","冰","机械","地面",
    "恶","龙","幽","武","光","毒","萌","虫","幻",
}


def normalize_type(zh: str | None) -> str | None:
    if zh is None:
        return None
    t = TYPE_ALIAS.get(zh, zh)
    return t if t in CANONICAL_TYPES else None


def combo_id(types: list[str]) -> str:
    if len(types) == 1:
        return f"s_{types[0]}"
    a, b = sorted(types)
    return f"d_{a}_{b}"


def main() -> None:
    pets_raw = json.loads((SRC / "Pets.json").read_text(encoding="utf-8"))
    print(f"Loaded {len(pets_raw)} pet records")

    pets_out: list[dict] = []
    skipped = {"unimplemented": 0, "unknown_type": 0, "leader_form": 0}

    for p in pets_raw:
        if not p.get("implemented"):
            skipped["unimplemented"] += 1
            continue
        if p.get("is_leader_form"):
            skipped["leader_form"] += 1
            continue

        main_zh = (p.get("main_type") or {}).get("localized", {}).get("zh")
        sub_zh = (p.get("sub_type") or {}).get("localized", {}).get("zh") if p.get("sub_type") else None
        main_t = normalize_type(main_zh)
        sub_t = normalize_type(sub_zh)
        if main_t is None:
            skipped["unknown_type"] += 1
            continue

        types = [main_t]
        if sub_t and sub_t != main_t:
            types.append(sub_t)

        # Aggregate move types from move_pool
        move_types: set[str] = set()
        for mv in p.get("move_pool") or []:
            mt_zh = (mv.get("move_type") or {}).get("localized", {}).get("zh")
            mt = normalize_type(mt_zh)
            if mt:
                move_types.add(mt)

        # Always include STAB types so scoring is never worse than current.
        for t in types:
            move_types.add(t)

        name_zh = ((p.get("localized") or {}).get("zh") or {}).get("name") or p.get("name", "?")

        pets_out.append({
            "id": p["id"],
            "name": name_zh,
            "types": types,
            "base_stats": {
                "hp": p.get("base_hp", 0),
                "phy_atk": p.get("base_phy_atk", 0),
                "mag_atk": p.get("base_mag_atk", 0),
                "phy_def": p.get("base_phy_def", 0),
                "mag_def": p.get("base_mag_def", 0),
                "spd": p.get("base_spd", 0),
            },
            "move_types": sorted(move_types),
            "preferred_attack_style": p.get("preferred_attack_style", "Both"),
        })

    # Index by combo
    combos: dict[str, dict] = {}
    for pet in pets_out:
        cid = combo_id(pet["types"])
        if cid not in combos:
            combos[cid] = {
                "id": cid,
                "types": pet["types"],
                "member_ids": [],
                "move_types": set(),
            }
        combos[cid]["member_ids"].append(pet["id"])
        combos[cid]["move_types"].update(pet["move_types"])

    # Convert sets to sorted lists for JSON
    combo_index = {}
    for cid, c in combos.items():
        combo_index[cid] = {
            "id": c["id"],
            "types": c["types"],
            "member_ids": sorted(c["member_ids"]),
            "move_types": sorted(c["move_types"]),
        }

    # Build valid_duals.json from observed dual-type combos
    valid_duals = {
        "version": f"{__import__('datetime').date.today().isoformat()}-rocom",
        "schema_version": 1,
        "_note": "Auto-derived from data_init_project/rocom.aoe.top Pets.json. Each entry corresponds to a dual-type combo observed among implemented pets.",
        "valid_duals": [],
    }
    for cid, c in sorted(combo_index.items()):
        if len(c["types"]) != 2:
            continue
        valid_duals["valid_duals"].append({
            "id": cid,
            "types": c["types"],
            "introduced_at": None,
            "deprecated_at": None,
            "notes": f"含 {len(c['member_ids'])} 只精灵",
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "pets.json").write_text(
        json.dumps({"version": valid_duals["version"], "pets": pets_out},
                   ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    (OUT_DIR / "combo_index.json").write_text(
        json.dumps({"version": valid_duals["version"], "combos": combo_index},
                   ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    (OUT_DIR / "valid_duals.json").write_text(
        json.dumps(valid_duals, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    n_single = sum(1 for c in combo_index.values() if len(c["types"]) == 1)
    n_dual = sum(1 for c in combo_index.values() if len(c["types"]) == 2)
    print(f"Pets kept: {len(pets_out)}, skipped: {skipped}")
    print(f"Combos: {n_single} single + {n_dual} dual = {len(combo_index)}")
    print(f"Wrote: pets.json, combo_index.json, valid_duals.json -> {OUT_DIR}")


if __name__ == "__main__":
    main()
