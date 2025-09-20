````markdown
# GEMINI.md: PennyLane Graphical Circuit Builder

## 🚀 Project Title: PennyLane Circuit Composer

---

### ## 1. Overview

This document outlines the project plan and technical architecture for creating a web-based, graphical user interface (GUI) for designing and simulating quantum circuits, using **PennyLane** as the backend computational engine. The application will provide an intuitive drag-and-drop interface, similar to Qiskit Composer, allowing users to build circuits visually and see the simulation results.

---

### ## 2. Core Architecture 🏛️

The application will be built on a modern client-server model, separating the user interface (frontend) from the computational logic (backend).



* **Frontend (Client):** A single-page application (SPA) running in the user's web browser. It will be responsible for rendering the circuit editor, handling user interactions (like dragging gates), and visualizing the final results. It will be completely agnostic about how the quantum computation is performed.
* **Backend (Server):** A Python-based API server. Its sole responsibility is to receive a description of a quantum circuit from the frontend, use PennyLane to construct and execute that circuit, and then return the measurement results to the frontend.

This separation ensures that the complex quantum calculations do not block the user interface and allows for independent development and scaling of each component.

---

### ## 3. Technology Stack 🛠️

#### 🎨 Frontend

| Category | Technology | Reason |
| :--- | :--- | :--- |
| **Language** | TypeScript | Adds static typing to JavaScript for better code quality and maintainability. |
| **Framework** | React | A powerful, component-based library ideal for building complex, interactive UIs. |
| **Drag & Drop** | `react-dnd` | A flexible library for implementing the core drag-and-drop functionality for gates. |
| **Graphics**| `react-konva` or SVG | For rendering the circuit canvas, qubit lines, and gates efficiently. |
| **Data Viz** | `d3.js` or `Chart.js` | To display simulation results (e.g., measurement probabilities) as bar charts. |

#### 🧠 Backend

| Category | Technology | Reason |
| :--- | :--- | :--- |
| **Language** | Python | The native language for PennyLane and the entire quantum ecosystem. |
| **Framework**| FastAPI | A modern, high-performance Python web framework for building APIs quickly. |
| **Quantum Engine**| **PennyLane** | The core of our project. It will be used to define and execute quantum circuits. |
| **Server** | Uvicorn | A fast ASGI server required to run FastAPI. |

---

### ## 4. Development Roadmap 🗺️

#### Phase 1: Foundation & UI Mockup
1.  **Project Setup:** Initialize a React/TypeScript project for the frontend and a FastAPI project for the backend.
2.  **Static UI:** Create the main UI components: a static canvas with qubit lines, a non-interactive palette of quantum gates (H, CNOT, Pauli-X, etc.), and a results display area.

#### Phase 2: Interactive Frontend
1.  **State Management:** Design a data structure (e.g., a JavaScript array of objects) to represent the quantum circuit's state in the frontend.
2.  **Implement Drag & Drop:** Use `react-dnd` to allow users to drag gates from the palette and drop them onto the qubit lines.
3.  **Dynamic State:** Update the circuit's state representation whenever a user adds, moves, or removes a gate.

#### Phase 3: Backend API with PennyLane
1.  **Create API Endpoint:** Define a POST endpoint (e.g., `/execute`) in FastAPI that accepts a JSON object describing the circuit.
2.  **Circuit Translation:** Write the Python logic to parse the incoming JSON and dynamically build a corresponding PennyLane quantum function (`QNode`).
3.  **PennyLane Execution:**
    * Define a PennyLane **device** (e.g., `default.qubit`).
    * Create a **QNode** that encapsulates the quantum function.
    * Execute the QNode and obtain the measurement probabilities or samples.
4.  **Return Results:** Send the computation results back as a JSON response.

#### Phase 4: Integration & Visualization
1.  **API Call:** Implement the function in the frontend to send the circuit's state to the backend API when the "Run" button is clicked.
2.  **Display Results:** Receive the results from the backend and use a charting library to visualize the measurement probabilities in the results area.

#### Phase 5: Advanced Features
1.  **Code Generation:** Display the PennyLane Python code corresponding to the user's graphical circuit.
2.  **Device Selection:** Add a dropdown to allow users to select different PennyLane devices (e.g., `default.mixed`, `lightning.qubit`).
3.  **Circuit Saving/Loading:** Implement functionality to save and load circuit designs using the browser's local storage.

---

### ## 5. API Design Example ↔️

A key part of the project is defining how the frontend and backend communicate.

**Frontend Request (POST to `/execute`)**
The frontend sends a structured description of the circuit.

```json
{
  "qubits": 2,
  "shots": 1024,
  "circuit": [
    { "gate": "Hadamard", "wires": [0] },
    { "gate": "CNOT", "wires": [0, 1] }
  ]
}
````

**Backend Response**
The backend responds with the measurement results.

```json
{
  "probabilities": {
    "00": 0.501,
    "01": 0.0,
    "10": 0.0,
    "11": 0.499
  }
}
```

-----

### \#\# 6. Key PennyLane Concepts

The backend logic will heavily rely on PennyLane's core concepts:

  * **Devices:** A device represents the quantum hardware or simulator that will execute the circuit. We will start with `qml.device("default.qubit", wires=N, shots=S)`.
  * **QNodes:** A QNode is a quantum function that can be run on a device. Our backend will dynamically construct the operations inside a QNode based on the JSON input from the frontend.

<!-- end list -->

```python
# Example of backend logic in FastAPI
import pennylane as qml

@app.post("/execute")
async def execute_circuit(request: CircuitRequest):
    # 1. Get number of wires and shots from request
    dev = qml.device("default.qubit", wires=request.qubits, shots=request.shots)

    @qml.qnode(dev)
    def dynamic_circuit():
        # 2. Loop through request.circuit and apply gates
        for op in request.circuit:
            if op.gate == "Hadamard":
                qml.Hadamard(wires=op.wires)
            elif op.gate == "CNOT":
                qml.CNOT(wires=op.wires)
        # 3. Define the measurement
        return qml.probs(wires=range(request.qubits))

    # 4. Execute and return results
    probabilities = dynamic_circuit()
    # ... format and return the response
```

```
```