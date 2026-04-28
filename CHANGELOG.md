# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Greedy team recommender with marginal-gain selection (§5.4.1)
- Team scoring: attack coverage A(P), safe-switch D_switch, weakness penalty D_weak
- Per-combo move-type set (moveTypeSet) for strike-surface-aware scoring
- Type matrix precomputation with O(1) per-lookup combo cache
- Battle event recording and time-decayed enemy weight stats
- Community team import with popularity weighting
- Settings page: epoch window, score lambdas, redundancy threshold
- Pet data pipeline: `scripts/build_pet_data.py` generates `pets.json` and `combo_index.json`
- Type matrix extractor: `scripts/extract_type_matrix.py`
- Tauri desktop app scaffold (Windows, macOS)
