"""Generate reference results for the TypeScript simulator using PennyLane.

Writes packages/core/test/fixtures/reference.json: a list of circuits (in the
@qcc/core Circuit format) with the exact probabilities PennyLane computes for
them. The core test suite checks that its simulator reproduces these.

    pip install -r requirements.txt
    python generate_fixtures.py
"""

import json
import math
import random
from pathlib import Path

import pennylane as qml

OUT = Path(__file__).resolve().parents[2] / "packages/core/test/fixtures/reference.json"

GATES = {
    "H": (qml.Hadamard, 0, 1, 0),
    "X": (qml.PauliX, 0, 1, 0),
    "Y": (qml.PauliY, 0, 1, 0),
    "Z": (qml.PauliZ, 0, 1, 0),
    "S": (qml.S, 0, 1, 0),
    "T": (qml.T, 0, 1, 0),
    "RX": (qml.RX, 0, 1, 1),
    "RY": (qml.RY, 0, 1, 1),
    "RZ": (qml.RZ, 0, 1, 1),
    "CNOT": (qml.CNOT, 1, 1, 0),
    "CY": (qml.CY, 1, 1, 0),
    "CZ": (qml.CZ, 1, 1, 0),
    "CRX": (qml.CRX, 1, 1, 1),
    "CRY": (qml.CRY, 1, 1, 1),
    "CRZ": (qml.CRZ, 1, 1, 1),
    "SWAP": (qml.SWAP, 0, 2, 0),
    "CCX": (qml.Toffoli, 2, 1, 0),
    "CSWAP": (qml.CSWAP, 1, 2, 0),
}


def op(gate, controls=(), targets=(), params=(), basis=None, store=None, cond=None):
    """`store` is the classical bit a measurement writes; `cond` is (bit, value) for a classically controlled gate."""
    d = {"gate": gate, "controls": list(controls), "targets": list(targets), "params": list(params)}
    if basis:
        d["basis"] = basis
    if store is not None:
        d["classicalTarget"] = store
    if cond is not None:
        d["condition"] = {"bit": cond[0], "value": cond[1]}
    return d


HANDWRITTEN = [
    ("bell", 2, [op("H", targets=[0]), op("CNOT", [0], [1])]),
    ("ghz", 3, [op("H", targets=[0]), op("CNOT", [0], [1]), op("CNOT", [1], [2])]),
    ("control below target", 2, [op("X", targets=[1]), op("CNOT", [1], [0])]),
    ("rotations", 1, [op("RX", targets=[0], params=["pi/3"]), op("RZ", targets=[0], params=["0.7"]), op("RY", targets=[0], params=["-1.2"])]),
    ("x basis readout", 2, [op("H", targets=[0]), op("MEASURE", targets=[0], basis="X")]),
    ("y basis readout", 1, [op("RX", targets=[0], params=["-pi/2"]), op("MEASURE", targets=[0], basis="Y")]),
    ("partial measurement", 3, [op("H", targets=[0]), op("CNOT", [0], [2]), op("RY", targets=[1], params=["0.4"]), op("MEASURE", targets=[2])]),
    ("toffoli", 3, [op("X", targets=[0]), op("X", targets=[2]), op("CCX", [0, 2], [1])]),
    ("fredkin", 3, [op("X", targets=[1]), op("H", targets=[0]), op("CSWAP", [0], [1, 2])]),
    ("swap far wires", 4, [op("X", targets=[0]), op("RY", targets=[3], params=["0.3"]), op("SWAP", targets=[3, 0])]),
    ("controlled rotations", 2, [op("H", targets=[0]), op("CRX", [0], [1], ["1.1"]), op("CRY", [1], [0], ["0.5"]), op("CRZ", [0], [1], ["2.2"]), op("H", targets=[1])]),
    ("phases", 2, [op("H", targets=[0]), op("H", targets=[1]), op("S", targets=[0]), op("T", targets=[1]), op("CZ", [0], [1]), op("CY", [1], [0]), op("H", targets=[0]), op("H", targets=[1])]),
]

DYNAMIC = [
    ("mid-circuit measurement dephases", 1, [op("H", targets=[0]), op("MEASURE", targets=[0]), op("H", targets=[0])]),
    ("conditional x", 2, [op("H", targets=[0]), op("MEASURE", targets=[0], store=0), op("X", targets=[1], cond=(0, 1))]),
    ("condition on zero", 2, [op("RY", targets=[0], params=["0.8"]), op("MEASURE", targets=[0], store=0), op("H", targets=[1], cond=(0, 0))]),
    ("active reset", 2, [op("RX", targets=[0], params=["1.3"]), op("CNOT", [0], [1]), op("MEASURE", targets=[0], store=0), op("X", targets=[0], cond=(0, 1))]),
    (
        "teleportation",
        3,
        [
            op("RY", targets=[0], params=["0.9"]),
            op("RZ", targets=[0], params=["0.4"]),
            op("H", targets=[1]),
            op("CNOT", [1], [2]),
            op("CNOT", [0], [1]),
            op("H", targets=[0]),
            op("MEASURE", targets=[0], store=0),
            op("MEASURE", targets=[1], store=1),
            op("X", targets=[2], cond=(1, 1)),
            op("Z", targets=[2], cond=(0, 1)),
            op("RZ", targets=[2], params=["-0.4"]),
            op("RY", targets=[2], params=["-0.9"]),
        ],
    ),
    ("mid-circuit x basis", 2, [op("RY", targets=[0], params=["0.6"]), op("MEASURE", targets=[0], basis="X", store=0), op("RX", targets=[1], params=["1.1"], cond=(0, 1)), op("T", targets=[0]), op("H", targets=[0])]),
    ("mid-circuit y basis", 2, [op("RX", targets=[0], params=["0.7"]), op("MEASURE", targets=[0], basis="Y", store=1), op("CRY", [0], [1], ["0.9"], cond=(1, 0)), op("MEASURE", targets=[0], basis="X")]),
    ("bit written twice", 2, [op("H", targets=[0]), op("MEASURE", targets=[0], store=0), op("X", targets=[1], cond=(0, 1)), op("H", targets=[0]), op("MEASURE", targets=[0], store=0), op("H", targets=[1], cond=(0, 1)), op("MEASURE", targets=[1])]),
    ("conditional multi-qubit gates", 3, [op("H", targets=[0]), op("MEASURE", targets=[0], store=0), op("H", targets=[1]), op("CSWAP", [1], [0, 2], cond=(0, 1)), op("CCX", [0, 1], [2], cond=(0, 0)), op("SWAP", targets=[0, 2], cond=(0, 1))]),
]


def random_case(rng, index):
    n = rng.randint(1, 5)
    names = [g for g, (_, c, t, _) in GATES.items() if c + t <= n]
    ops = []
    for _ in range(rng.randint(3, 12)):
        gate = rng.choice(names)
        _, nc, nt, np_ = GATES[gate]
        wires = rng.sample(range(n), nc + nt)
        params = [repr(round(rng.uniform(-math.pi, math.pi), 6)) for _ in range(np_)]
        ops.append(op(gate, wires[:nc], wires[nc:], params))
    for w in range(n):
        if rng.random() < 0.3:
            ops.append(op("MEASURE", targets=[w], basis=rng.choice("ZXY")))
    return (f"random {index}", n, ops)


def random_dynamic_case(rng, index):
    """Random gates with mid-circuit measurements; later gates may be conditioned on any bit written so far."""
    n = rng.randint(2, 4)
    names = [g for g, (_, c, t, _) in GATES.items() if c + t <= n]
    ops = []
    written = []
    for _ in range(rng.randint(6, 14)):
        if rng.random() < 0.25:
            bit = rng.randrange(3)
            store = bit if rng.random() < 0.8 else None
            ops.append(op("MEASURE", targets=[rng.randrange(n)], basis=rng.choice("ZZXY"), store=store))
            if store is not None and store not in written:
                written.append(store)
            continue
        gate = rng.choice(names)
        _, nc, nt, np_ = GATES[gate]
        wires = rng.sample(range(n), nc + nt)
        params = [repr(round(rng.uniform(-math.pi, math.pi), 6)) for _ in range(np_)]
        cond = (rng.choice(written), rng.randrange(2)) if written and rng.random() < 0.5 else None
        ops.append(op(gate, wires[:nc], wires[nc:], params, cond=cond))
    return (f"random dynamic {index}", n, ops)


def to_circuit(n, ops):
    return {
        "numQubits": n,
        "numColumns": len(ops),
        "qubitLabels": [f"|q_{{{i}}}\\rangle" for i in range(n)],
        "operations": [{"id": f"op{i}", "column": i, **o} for i, o in enumerate(ops)],
        "customGates": [],
    }


def rotate_into(basis, wire):
    if basis == "Y":
        qml.adjoint(qml.S)(wires=wire)
    if basis != "Z":
        qml.Hadamard(wires=wire)


def rotate_back(basis, wire):
    if basis != "Z":
        qml.Hadamard(wires=wire)
    if basis == "Y":
        qml.S(wires=wire)


def reference_probs(n, ops):
    # The result is read from the wires whose last operation is a measurement.
    bases = {}
    for o in ops:
        if o["gate"] == "MEASURE":
            bases[o["targets"][0]] = o.get("basis", "Z")
        else:
            for w in o["controls"] + o["targets"]:
                bases.pop(w, None)
    measured = sorted(bases) or list(range(n))
    # Static circuits keep their measurements for the end. In a dynamic circuit
    # every measurement is a projective qml.measure where it was placed.
    dynamic = any("condition" in o for o in ops) or sum(o["gate"] == "MEASURE" for o in ops) > len(bases)

    # Deferred measurement keeps the probabilities exact; it needs spare wires,
    # so the device of a dynamic circuit is left without a fixed wire count.
    device = qml.device("default.qubit") if dynamic else qml.device("default.qubit", wires=n)

    @qml.qnode(device, mcm_method="deferred" if dynamic else None)
    def circuit():
        bits = {}
        for o in ops:
            if o["gate"] == "MEASURE":
                if dynamic:
                    wire, basis = o["targets"][0], o.get("basis", "Z")
                    rotate_into(basis, wire)
                    bits[o.get("classicalTarget")] = qml.measure(wire)
                    rotate_back(basis, wire)
                continue
            fn = GATES[o["gate"]][0]
            params = [eval(p, {"pi": math.pi}) for p in o["params"]]
            if "condition" in o:
                fn = qml.cond(bits[o["condition"]["bit"]] == o["condition"]["value"], fn)
            fn(*params, wires=o["controls"] + o["targets"])
        for w, b in sorted(bases.items()):
            rotate_into(b, w)
        return qml.probs(wires=measured)

    probs = circuit()
    width = len(measured)
    return measured, {format(i, f"0{width}b"): float(p) for i, p in enumerate(probs)}


def main():
    rng = random.Random(20250920)
    cases = HANDWRITTEN + [random_case(rng, i) for i in range(40)]
    # A separate generator keeps the cases above stable when dynamic ones are added.
    dynamic_rng = random.Random(20260930)
    cases += DYNAMIC + [random_dynamic_case(dynamic_rng, i) for i in range(30)]
    fixtures = []
    for name, n, ops in cases:
        wires, probs = reference_probs(n, ops)
        fixtures.append({"name": name, "circuit": to_circuit(n, ops), "wires": wires, "probabilities": probs})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"pennylane": qml.__version__, "cases": fixtures}, indent=1) + "\n")
    print(f"Wrote {len(fixtures)} cases to {OUT}")


if __name__ == "__main__":
    main()
