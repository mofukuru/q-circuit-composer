import { parseMath } from '@qcc/core';

/** Renders a LaTeX math snippet with real sub/superscripts, e.g. `U_f` or `|q_{0}\rangle`. */
export default function MathText({ latex }: { latex: string }) {
  return (
    <>
      {parseMath(latex).map((r, i) =>
        r.shift === 'sub' ? <sub key={i}>{r.text}</sub> : r.shift === 'super' ? <sup key={i}>{r.text}</sup> : <span key={i}>{r.text}</span>,
      )}
    </>
  );
}
