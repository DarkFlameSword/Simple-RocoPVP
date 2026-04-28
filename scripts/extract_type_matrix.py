"""Extract the 18x18 type matrix from 洛克王国.png by detecting grid lines.

Strategy:
  1. Find vertical grid lines (well-spaced, regular). Use their pitch as
     authoritative cell width.
  2. Use the same pitch for horizontal cells, but locate the top of the
     data grid by finding the first horizontal line whose Y is above
     a detected dense block (the data area).
  3. For each cell, sample its center patch and classify color.

Color classification:
  red-ish    -> 2     (super effective / 克制)
  green-ish  -> 0.5   (resist / 抵抗)
  white/light-> 1     (normal)
"""
from __future__ import annotations
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
IMG_PATH = ROOT / "洛克王国.png"
OUT_PATH = ROOT / "app" / "src-tauri" / "resources" / "config" / "type_matrix.json"
DEBUG_PATH = ROOT / "app" / "scripts" / "_debug_overlay.png"

TYPES = ["普通","草","水","火","电","翼","冰","机械","地面",
         "恶","龙","幽","武","光","毒","萌","虫","幻"]
N = 18


def classify_color(r: float, g: float, b: float) -> tuple[float, str]:
    """Simple-RocoPVP convention: GREEN = 2x (effective), RED = 0.5x (resist)."""
    # Saturated red -> resist
    if r > 170 and r > g + 30 and r > b + 30:
        return 0.5, "R"
    # Saturated green -> effective
    if g > 100 and g > r + 5 and g > b - 10 and r < 220:
        return 2.0, "G"
    # White / light gray -> normal
    if r > 220 and g > 220 and b > 220:
        return 1.0, "W"
    # Pink / orange -> resist
    if r > 200 and r > g + 15 and r > b + 15:
        return 0.5, "r"
    # Dim green -> effective
    if g > 130 and g > r - 15 and g > b + 15:
        return 2.0, "g"
    return 1.0, "?"


def detect_dark_lines(profile: np.ndarray, min_dist: int) -> list[int]:
    smooth = np.convolve(profile, np.ones(3) / 3, mode="same")
    thresh = max(np.percentile(smooth, 80), smooth.max() * 0.3)
    peaks = []
    for i in range(1, len(smooth) - 1):
        if smooth[i] > thresh and smooth[i] >= smooth[i-1] and smooth[i] >= smooth[i+1]:
            if not peaks or i - peaks[-1] >= min_dist:
                peaks.append(int(i))
            elif smooth[i] > smooth[peaks[-1]]:
                peaks[-1] = int(i)
    return peaks


def main() -> None:
    img = Image.open(IMG_PATH).convert("RGB")
    arr = np.asarray(img)
    H, W = arr.shape[:2]
    print(f"Image: {W}x{H}", file=sys.stderr)

    # Manually anchored bounds (verified by pixel-level inspection):
    #   Row-label column extends to x≈125 (it has colored backgrounds per type
    #   that fooled earlier color-only detection).
    #   Data area: x in [125, 1429]  (18 cells, pitch ≈ 72.4)
    #   Title + column-header band: y in [0, ~91]
    #   Data area:                   y in [91, H]  (18 cells, pitch ≈ 27)
    DATA_X0 = 125
    DATA_Y0 = 91
    v_sel = [round(DATA_X0 + i * (W - DATA_X0) / 18) for i in range(19)]
    h_sel = [round(DATA_Y0 + i * (H - DATA_Y0) / 18) for i in range(19)]
    print(f"v_sel: {v_sel}", file=sys.stderr)
    print(f"h_sel: {h_sel}", file=sys.stderr)
    print(f"H-sel: {h_sel}", file=sys.stderr)

    # Sample cells
    matrix = []
    tags = []
    for i in range(N):
        row = []
        trow = []
        for j in range(N):
            y0, y1 = h_sel[i], h_sel[i + 1]
            x0, x1 = v_sel[j], v_sel[j + 1]
            cy = (y0 + y1) // 2
            cx = (x0 + x1) // 2
            patch = arr[max(0, cy-5):cy+6, max(0, cx-5):cx+6]
            r = float(np.median(patch[..., 0]))
            g = float(np.median(patch[..., 1]))
            b = float(np.median(patch[..., 2]))
            mult, tag = classify_color(r, g, b)
            row.append(mult)
            trow.append(tag)
        matrix.append(row)
        tags.append(trow)

    # Draw debug overlay
    dbg = img.copy()
    drw = ImageDraw.Draw(dbg)
    for x in v_sel:
        drw.line([(x, 0), (x, H)], fill="blue", width=1)
    for y in h_sel:
        drw.line([(0, y), (W, y)], fill="blue", width=1)
    for i in range(N):
        for j in range(N):
            cy = (h_sel[i] + h_sel[i + 1]) // 2
            cx = (v_sel[j] + v_sel[j + 1]) // 2
            drw.rectangle([(cx-2, cy-2), (cx+2, cy+2)], outline="magenta")
    dbg.save(DEBUG_PATH)
    print(f"Debug overlay: {DEBUG_PATH}", file=sys.stderr)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": "2026-04-28-extracted",
        "schema_version": 1,
        "types": TYPES,
        "matrix": matrix,
        "_note": "Auto-extracted from 洛克王国.png. PLEASE VERIFY before relying on it.",
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                        encoding="utf-8")
    print(f"Wrote {OUT_PATH}", file=sys.stderr)

    # Pretty print
    print()
    print("    " + " ".join(f"{t[:2]:>3}" for t in TYPES))
    for i, row in enumerate(matrix):
        cells = []
        for v in row:
            if v == 2.0:
                cells.append("  2")
            elif v == 0.5:
                cells.append(" .5")
            else:
                cells.append("  1")
        print(f"{TYPES[i][:2]:>3} " + " ".join(cells))


if __name__ == "__main__":
    main()
