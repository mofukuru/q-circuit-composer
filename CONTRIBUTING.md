# Contributing

Thanks for your interest in q-circuit-composer! Issues and pull requests are welcome in English or Japanese.

## Reporting bugs and requesting features

Open an [issue](../../issues) and pick the bug report or feature request form. For bugs, a share link (the link button in the toolbar) or a saved JSON of the circuit helps a lot.

Security problems go through [private vulnerability reporting](SECURITY.md), not public issues.

Labels are defined in [`.github/labels.yml`](.github/labels.yml) and synced by a workflow; change them there rather than in the GitHub UI.

## Development setup

Requires Node.js 20.19+ or 22.12+ (see `.nvmrc`).

```bash
npm install
npm run dev
```

| Path | What lives there |
|---|---|
| `packages/core` | Circuit model, editing operations, simulator, code generators. Pure TypeScript with unit tests (Vitest). |
| `apps/web` | The React app. UI only: logic that can be tested without a browser belongs in `core`. |
| `tools/reference` | Python scripts that check `core` against PennyLane, Qiskit and Qulacs. |

## Before opening a pull request

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

If you change the simulator or a code generator, also run the reference checks described in [tools/reference/README.md](tools/reference/README.md). If you add a gate, add it to `generate_fixtures.py` and regenerate the fixtures.

## Pull requests

1. Fork the repository and create a branch from `main` (e.g. `feat/latex-png-export`, `fix/cnot-drag`).
2. Keep each PR focused on one change.
3. Make sure the checks above pass.
4. Describe what changed and why, and link the related issue (`Closes #123`).

Commit messages are free-form, but a short imperative summary line (e.g. `Add CSWAP gate to palette`) is appreciated.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
