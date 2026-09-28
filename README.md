# q-circuit-composer

Build quantum circuits in your browser, simulate them, and export code or LaTeX. Everything runs client-side, with no server or account.

[日本語](#日本語)

## Features

- **Visual editor**: drag gates onto a grid, rewire controls and targets by dragging, undo/redo
- **In-browser simulation**: exact probabilities, sampled counts, or per-wire ⟨Z⟩, up to 16 qubits
- **Code export** for PennyLane, Qiskit, Qulacs and OpenQASM 2.0
- **LaTeX export** with [quantikz](https://ctan.org/pkg/quantikz), including symbolic angles (`\theta/2`), custom gates and qubit labels
- **Share links** and JSON save/load
- English and Japanese UI, light and dark themes

### Gates

| Kind | Gates |
|---|---|
| Single-qubit | H, X, Y, Z, S, T, RX, RY, RZ |
| Multi-qubit | CNOT, CY, CZ, CRX, CRY, CRZ, SWAP, Toffoli (CCX), Fredkin (CSWAP) |
| Measurement | Readout in the Z, X or Y basis |
| Custom | Labelled boxes over one or more wires (LaTeX only) |

Angles accept expressions such as `pi/2`, `-3pi/4` or `0.25`. Symbols like `\theta` are kept in LaTeX and declared as variables in the Python outputs; simulation needs numeric angles.

Measurements set the readout basis of their wire and are applied at the end of the circuit. Mid-circuit measurement is not supported yet.

## Repository layout

```
apps/web/          # the web app: Vite + React + TypeScript + Tailwind CSS
packages/core/     # circuit model, simulator and code generators (no UI dependencies)
tools/reference/   # Python scripts that check core against PennyLane, Qiskit and Qulacs
```

## Development

Requires Node.js 20 or later.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # core unit tests, including the PennyLane reference cases
npm run typecheck
npm run lint
npm run build      # static site in apps/web/dist
```

The simulator is checked against results computed with PennyLane, and the generated code is executed with the real frameworks. See [tools/reference](tools/reference/README.md).

## Contributing

Issues and pull requests are welcome in English or Japanese. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © mofukuru

LaTeX output uses the [quantikz](https://ctan.org/pkg/quantikz) package from your own TeX distribution; it is not bundled with this project.

---

## 日本語

量子回路をブラウザ上で組み立てて、シミュレーションし、コードや LaTeX として出力できるツールです。すべてブラウザ内で動くので、サーバーやアカウントは不要です。

- **回路エディタ**：ゲートをグリッドにドラッグして配置します。制御点やターゲットをドラッグすると配線を変えられます。元に戻す／やり直しに対応しています。
- **ブラウザ内シミュレーション**：厳密な確率、サンプリング結果、各量子ビットの ⟨Z⟩ を表示します（最大 16 量子ビット）。
- **コード出力**：PennyLane / Qiskit / Qulacs / OpenQASM 2.0
- **LaTeX 出力**：quantikz 形式。`\theta/2` のような記号の角度、カスタムゲート、量子ビットのラベルに対応しています。
- **共有リンク**と JSON での保存・読み込み。日本語・英語の表示、ライト・ダークテーマ。

開発環境の起動方法は上の Development を参照してください。Issue や Pull Request は日本語でも英語でも歓迎します。
