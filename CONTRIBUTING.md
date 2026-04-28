# Contributing

## Before You Start

- This project is non-commercial. All contributions must be compatible with the project license.

## Development Setup

**Prerequisites:** Node.js 20+, Rust (stable), Anaconda (`Normal_Usage` env for Python scripts).

```bash
# Frontend dev server
cd app
npm install
npm run tauri dev

# Data pipeline (activate conda env first)
conda activate Normal_Usage
python app/scripts/build_pet_data.py
python app/scripts/extract_type_matrix.py
```

## Workflow

1. Open an issue before starting non-trivial work.
2. Branch from `main`; use descriptive branch names (e.g. `feat/stab-bonus`, `fix/cache-miss`).
3. Keep changes surgical — touch only what the task requires.
4. Run `npm run build` inside `app/` and confirm it compiles before submitting a PR.

## AI-Assisted Development

This project uses [Claude Code](https://claude.ai/code) as a development assistant.
Contributions that used AI assistance are welcome; please note it in the PR description.
All AI-generated code is subject to the same review standards as hand-written code.

## Naming Conventions

Avoid version suffixes (`_v2`, `_improved`, `_fixed`). Names should carry descriptive meaning
aligned with the algorithm or concept they implement (e.g. `greedyTeam`, `teamSwitch`,
`buildComboCache`).

## Code Style

- TypeScript: match existing file conventions; no speculative abstractions.
- Python: follow Google-style docstrings (see `CLAUDE.md`).
- Comments only when the *why* is non-obvious.

## Reporting Issues

Use GitHub Issues. Include: app version (from `tauri.conf.json`), OS, and steps to reproduce.
