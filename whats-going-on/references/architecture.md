# Architecture Document

Write to `.planning/system/architecture.md`. Build it from `.planning/system/lifecycle.md` when present (see [lifecycle.md](lifecycle.md)), otherwise from source.

### **Core Objective**

Turn lifecycle docs and repo structure into a high-level architecture document: a "bird's-eye view" of major logic centers, dependencies, and core technologies for new engineers.

### **Guardrails**

- Derive architecture from lifecycle docs and source evidence, not guesses.
- Label uncertain ownership, boundaries, or data flow as assumptions.
- Diagram major actors only. Not every file or helper.
- No refactor recommendations unless asked.

---

### **Mandated Output Structure**

#### **1. System Overview Diagram (Mermaid)**

- **Scale:** 5–10 major actors (heavy logic components).
- **Visuals:** Labeled arrows for data/control flow; subgroups for deployment boundaries (containers, VMs, external services).
- **Detail:** Annotate with primary technologies or protocols.

#### **2. Component Catalog**

A table of major actors:

| Component Name         | Technology/Framework | Primary Responsibility | Key Files (2-3)     | Heavy Logic Description      |
| ---------------------- | -------------------- | ---------------------- | ------------------- | ---------------------------- |
| _Example: API Gateway_ | _Node.js/Express_    | _Auth and Routing_     | _index.js, auth.js_ | _Token lifecycle/validation_ |

Per-component technology goes here. The full stack summary (languages, runtime, key dependencies, build/run commands) belongs in `onboard.md`.

#### **3. Integration Points**

- **Protocol:** (e.g., HTTP, IPC, WebSocket).
- **Data Format:** (e.g., JSON, Protobuf).
- **Nature:** Synchronous vs. Asynchronous.

#### **4. Navigation Guide**

- **User Interactions:** Reference specific lifecycle docs.
- **Data Flow:** Identify the starting component.
- **Business Logic:** Identify the primary logic engine.

---

### **Selection Guidelines (Filtering)**

- **Major Actors Only:** Include only components where significant logic lives. If removing it would force a major rewrite, include it.
- **Exclusions:** Omit simple pass-throughs, thin wrappers, utility libraries, pure UI components, config-only files.
- **Prioritization:** Maximum **10 major components**.
