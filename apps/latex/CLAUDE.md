# 仕様書: qcircuit2latex (Visual Quantum Circuit to LaTeX Generator)

## 1\. プロジェクト概要

  * **プロジェクト名:** qcircuit2latex
  * **目的:** ブラウザ上でドラッグ＆ドロップを用いて量子回路を直感的に構築し、論文やレポートで使用可能なLaTeXコード（および画像）を即座に生成する。
  * **ターゲット:** 量子コンピューティングの研究者、学生、エンジニア。

## 2\. 推奨テックスタック (The Vibe Stack)

開発速度とモダンなUXを両立する構成です。

  * **Frontend:** Next.js (App Router) + TypeScript
      * *理由:* デプロイが容易(Vercel)、コンポーネント指向。
  * **Styling:** Tailwind CSS + shadcn/ui
      * *理由:* 見た目の構築を高速化。モダンでクリーンなUI。
  * **State Management:** Zustand
      * *理由:* Reduxよりシンプルで、Vibe codingのスピード感を損なわない。
  * **Drag & Drop:** `@dnd-kit/core`
      * *理由:* モダンで軽量、カスタマイズ性が高い。
  * **LaTeX Logic:** 文字列操作による生成 (Custom Logic)
  * **画像生成:** `html-to-image` (簡易版) または MathJax/KaTeX (プレビュー用)
      * *注:* 本格的なLaTeXコンパイル（pdflatexなど）をサーバーサイドで行うのは重いため、MVP（Minimum Viable Product）では「LaTeXコードの生成」と「Canvas上の見た目の画像化」を優先します。

-----

## 3\. データ構造 (The Heart)

ここが決まれば、あとはUIを作るだけです。グリッドベースで管理するのが最も簡単です。

### Circuit State (JSON Schema)

```typescript
type GateType = 'H' | 'X' | 'Y' | 'Z' | 'CNOT' | 'SWAP' | 'MEASURE' | 'Rx' | 'Ry' | 'Rz';

interface Gate {
  id: string;
  type: GateType;
  targetQubit: number; // どのワイヤーにあるか
  controlQubit?: number; // CNOTなどの場合の制御ビット
  param?: string; // 回転ゲートの角度など (例: "\\theta")
}

interface CircuitStep {
  index: number; // タイムステップ (横軸)
  gates: Gate[]; // そのステップに存在するゲート
}

// アプリ全体の状態
interface CircuitState {
  qubits: number; // 量子ビット数 (例: 3)
  steps: number;  // ステップ数 (例: 10)
  circuit: CircuitStep[]; // 回路情報
}
```

-----

## 4\. UI/UX デザイン仕様

### A. 画面レイアウト

画面は大きく3つのセクションに分けます。

1.  **サイドバー (Gate Palette):**
      * 使用可能なゲート一覧（H, X, Z, CNOT, etc.）が表示されている。
      * ここからドラッグを開始する。
      *
[Image of quantum logic gate symbols]

2.  **メインエリア (Circuit Canvas):**

      * 横線（量子ビットワイヤー）と縦線（タイムステップ）のグリッド。
      * ドロップエリアになっており、ゲートを配置可能。
      * 配置済みのゲートをドラッグして移動、またはゴミ箱アイコンへドロップして削除。

3.  **ボトムパネル (Export & Preview):**

      * **Live LaTeX Preview:** 回路を変更するとリアルタイムでコードが更新される。
      * **Copy Button:** クリックでクリップボードにコピー。
      * **Format Toggle:** `quantikz` (推奨) / `Q-circuit` の切り替え。

### B. ユーザーインタラクション

  * **配置:** パレットからゲートをドラッグし、ワイヤー上の特定の位置にドロップ。
  * **マルチ量子ビットゲート (CNOTなど):**
      * 配置後、UI上で「Control」と「Target」の接続を調整できるハンドルを表示するか、プロパティモーダルで設定。
  * **パラメータ入力:** 回転ゲート（Rxなど）をダブルクリックすると、角度 $\theta$ などを入力できるポップアップを表示。

-----

## 5\. LaTeX 生成ロジック (Conversion Logic)

今の標準である `quantikz` パッケージ向けの変換ロジックを優先します。

**変換アルゴリズムのイメージ:**

1.  量子ビット（行）ごとにループを回す。
2.  各ステップ（列）を見て、ゲートがあるか判定する。
3.  ゲートがあれば対応するTexコマンド（例: `\gate{H}`）を出力。なければワイヤー（`\qw`）を出力。
4.  行の最後で改行（`\\`）を入れる。

**出力例 (quantikz):**

```latex
\begin{quantikz}
& \gate{H} & \ctrl{1} & \qw \\
& \qw      & \targ{}  & \qw
\end{quantikz}
```

-----

## 6\. 実装ステップ (Vibe Coding Flow)

AIアシスタントに以下の順序でプロンプトを投げるとスムーズです。

1.  **Step 1: Scaffold & Grid**
      * 「Next.jsとTailwindを使って、左側にサイドバー、右側にメインエリアがあるレイアウトを作って。メインエリアには量子回路のような5本の横線（ワイヤー）を描画して。」
2.  **Step 2: Drag & Drop Implementation**
      * 「`dnd-kit`を使って、サイドバーにある四角いアイコン（ゲート）をメインエリアのワイヤー上にドロップできるようにして。ドロップされたらそこにアイコンが残るようにして。」
3.  **Step 3: State Management**
      * 「ドロップされたゲートの情報をZustandのストアで管理したい。グリッド座標(qubit index, step index)とゲートタイプを保存するロジックを追加して。」
4.  **Step 4: LaTeX Generator**
      * 「Zustandのストアにある回路データをもとに、`quantikz` 形式のLaTeX文字列を生成する関数 `generateLatex()` を書いて。生成されたテキストを画面下部に表示して。」
5.  **Step 5: Multi-Qubit Gates (Challenge)**
      * 「CNOTゲートの実装をしたい。制御ビットと標的ビットを指定できるようにして、LaTeX生成時に `\ctrl{}` と `\targ{}` が正しい相対位置で出力されるようにして。」

-----

## 7\. 拡張機能アイデア (Future Work)

  * **画像としての保存:** `html-to-image` を使用して、CanvasエリアのスクリーンショットをPNGとしてダウンロード。
  * **Qiskit/Cirq Export:** LaTeXだけでなく、Pythonコードとしてエクスポート。
