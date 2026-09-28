# qcircuit2latex

Build a quantum circuit by drag and drop and get [quantikz](https://ctan.org/pkg/quantikz) LaTeX code for papers and reports.

## Features

- Drag gates from the palette onto a grid of qubit wires
- Gates: H, X, Y, Z, Rx, Ry, Rz, CNOT, CCNOT (Toffoli), SWAP, CSWAP (Fredkin), measurement, and custom labelled gates
- Editable qubit labels
- Live LaTeX preview with copy to clipboard

## Using the output

Add the package to your document preamble and paste the generated code:

```latex
\usepackage{quantikz}
```

## Development

```bash
npm ci
npm run dev     # http://localhost:3000
npm run lint
npm run build
```

Built with Next.js (App Router), Tailwind CSS, shadcn/ui, Zustand and dnd-kit.
