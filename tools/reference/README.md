# Reference checks

Python scripts that check `@qcc/core` against real quantum frameworks. They are not part of the web app.

| Script | What it does |
|---|---|
| `generate_fixtures.py` | Runs hand-written and random circuits in PennyLane and writes the exact probabilities to `packages/core/test/fixtures/reference.json`. The core tests compare the TypeScript simulator with this file. |
| `verify_codegen.py` | Executes the PennyLane, Qiskit, OpenQASM and Qulacs code that `@qcc/core` generates for every fixture and checks that it gives the same probabilities. |

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# regenerate the fixtures (commit the result)
python generate_fixtures.py

# check generated code
(cd ../../packages/core && QCC_EXPORT=/tmp/generated.json npx vitest run test/codegen.test.ts)
python verify_codegen.py /tmp/generated.json
```
