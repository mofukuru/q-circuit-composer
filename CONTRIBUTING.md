# Contributing

Thanks for your interest in q-circuit-composer! Issues and pull requests are welcome in English or Japanese.

## Reporting bugs and requesting features

Open an [issue](../../issues). For bugs, include the app (Composer or qcircuit2latex), steps to reproduce, what you expected, and what happened. A screenshot or the circuit you built helps a lot.

## Development setup

See the [Quick start](README.md#quick-start) in the README. Each app is independent and has its own dependencies:

| App | Directory | Checks to run before a PR |
|---|---|---|
| Composer frontend | `apps/composer/frontend` | `npx tsc --noEmit` and `npm run build` |
| Composer backend | `apps/composer/backend` | start the server and try `POST /execute` |
| qcircuit2latex | `apps/latex` | `npm run lint` and `npm run build` |

## Pull requests

1. Fork the repository and create a branch from `main` (e.g. `feat/latex-export-png`, `fix/cnot-drag`).
2. Keep each PR focused on one change.
3. Make sure the checks above pass.
4. Describe what changed and why, and link the related issue (`Closes #123`).

Commit messages are free-form, but a short imperative summary line (e.g. `Add CSWAP gate to palette`) is appreciated.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
