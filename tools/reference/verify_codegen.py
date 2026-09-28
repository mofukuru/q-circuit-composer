"""Run the code that @qcc/core generates and compare it with the reference results.

    QCC_EXPORT=/tmp/generated.json npx vitest run test/codegen.test.ts   # in packages/core
    python verify_codegen.py /tmp/generated.json

PennyLane and Qulacs outputs are exact and must match to 1e-9. Qiskit output
is sampled, so it is checked with a tolerance, and the QASM is loaded through
Qiskit. Frameworks that are not installed are skipped.
"""

import contextlib
import importlib.util
import io
import json
import sys


def run(code):
    namespace = {}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(compile(code, "<generated>", "exec"), namespace)
    return namespace


def close(expected, actual, tol):
    keys = set(expected) | set(actual)
    return all(abs(expected.get(k, 0.0) - actual.get(k, 0.0)) <= tol for k in keys)


def pennylane_probs(case):
    probs = run(case["pennylane"])["circuit"]()
    width = len(case["wires"])
    return {format(i, f"0{width}b"): float(p) for i, p in enumerate(probs)}


def qulacs_probs(case):
    return {k: float(v) for k, v in run(case["qulacs"])["probs"].items()}


def qiskit_probs(case):
    ns = run(case["qiskit"])
    counts = ns["counts"]
    total = sum(counts.values())
    return {bits[::-1]: n / total for bits, n in counts.items()}


def qasm_probs(case):
    from qiskit import qasm2
    from qiskit.quantum_info import Statevector

    qc = qasm2.loads(case["qasm"]).remove_final_measurements(inplace=False)
    # Qiskit puts qargs[0] rightmost, so reversed wires read left to right in wire order.
    probs = Statevector(qc).probabilities_dict(qargs=case["wires"][::-1])
    return {bits: float(p) for bits, p in probs.items()}


CHECKS = [
    ("pennylane", "pennylane", pennylane_probs, 1e-9),
    ("qulacs", "qulacs", qulacs_probs, 1e-9),
    ("qiskit", "qiskit_aer", qiskit_probs, 0.02),
    ("qasm", "qiskit", qasm_probs, 1e-9),
]


def main(path):
    cases = json.load(open(path))
    failures = 0
    for label, module, fn, tol in CHECKS:
        if importlib.util.find_spec(module) is None:
            print(f"skip {label}: {module} is not installed")
            continue
        bad = [c["name"] for c in cases if not close(c["probabilities"], fn(c), tol)]
        failures += len(bad)
        print(f"{label}: {len(cases) - len(bad)}/{len(cases)} match" + (f"  FAILED: {bad}" if bad else ""))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main(sys.argv[1])
