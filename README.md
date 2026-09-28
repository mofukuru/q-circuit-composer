# q-circuit-composer

Browser-based tools for building quantum circuits visually.

[日本語](#日本語)

| App | What it does | Path |
|---|---|---|
| **Composer** | Drag-and-drop circuit editor with simulation and code generation for PennyLane, Qiskit, Qulacs and OpenQASM 2.0 | [`apps/composer`](apps/composer) |
| **qcircuit2latex** | Drag-and-drop circuit editor that exports [quantikz](https://ctan.org/pkg/quantikz) LaTeX code for papers and reports | [`apps/latex`](apps/latex) |

## Repository layout

```
apps/
├── composer/
│   ├── frontend/   # React + TypeScript (Create React App)
│   └── backend/    # FastAPI + PennyLane simulation API
└── latex/          # Next.js + Tailwind CSS + Zustand
```

## Quick start

Requirements: Node.js 20+ and Python 3.10+ (Composer backend only).

### Composer

```bash
# backend (http://localhost:8000)
cd apps/composer/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# frontend (http://localhost:3000), in another terminal
cd apps/composer/frontend
npm ci
npm start
```

### qcircuit2latex

```bash
cd apps/latex
npm ci
npm run dev   # http://localhost:3000
```

See each app's README for details.

## Roadmap

- Publish both apps on GitHub Pages
- In-browser simulator for Composer, so it runs without a Python server
- CI for lint, type checking, build and tests

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © mofukuru

The LaTeX output uses the [quantikz](https://ctan.org/pkg/quantikz) package, which you install in your own TeX distribution; it is not bundled with this project.

---

## 日本語

量子回路をブラウザ上で視覚的に組み立てるためのツール群です。

- **Composer**（`apps/composer`）: ドラッグ＆ドロップで回路を作成し、シミュレーション結果の表示と PennyLane / Qiskit / Qulacs / OpenQASM 2.0 のコード生成を行います。
- **qcircuit2latex**（`apps/latex`）: ドラッグ＆ドロップで作成した回路を、論文・レポート向けの quantikz 形式 LaTeX コードとして出力します。

起動方法は上記の Quick start を参照してください。Issue や Pull Request は日本語でも英語でも歓迎します。
