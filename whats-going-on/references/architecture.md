# Architecture Document

Write to `.planning/system/architecture.md`. Build it from `.planning/system/lifecycle.md` when present (see [lifecycle.md](lifecycle.md)), otherwise from source.

### **Core Objective**

Analyze lifecycle documentation and repository structure to generate a high-level system architecture document. The goal is to provide a "bird's-eye view" that identifies major logic centers, dependencies, and core technologies for new engineers.

### **Guardrails**

- Derive architecture from lifecycle docs and source evidence, not guesses.
- Label uncertain ownership, boundaries, or data flow as assumptions.
- Keep the diagram to major actors only. Do not model every file or helper.
- Do not recommend refactors unless explicitly asked.

---

### **Mandated Output Structure**

#### **1. System Overview Diagram (Mermaid)**

- **Scale:** 5–10 major actors (heavy logic components).
- **Visuals:** Labeled arrows for data/control flow; subgroups for deployment boundaries (containers, VMs, external services).
- **Detail:** Annotate with primary technologies or protocols.

#### **2. Component Catalog**

A table detailing major actors:

| Component Name         | Technology/Framework | Primary Responsibility | Key Files (2-3)     | Heavy Logic Description      |
| ---------------------- | -------------------- | ---------------------- | ------------------- | ---------------------------- |
| _Example: API Gateway_ | _Node.js/Express_    | _Auth and Routing_     | _index.js, auth.js_ | _Token lifecycle/validation_ |

Technology/framework per component goes here; the full stack summary (languages, runtime, key dependencies, build/run commands) belongs in `onboard.md`, not here.

#### **3. Integration Points**

Define communication methods:

- **Protocol:** (e.g., HTTP, IPC, WebSocket).
- **Data Format:** (e.g., JSON, Protobuf).
- **Nature:** Synchronous vs. Asynchronous.

#### **4. Navigation Guide**

Explicit pointers for onboarding:

- **User Interactions:** Reference specific lifecycle docs.
- **Data Flow:** Identify the starting component.
- **Business Logic:** Identify the primary logic engine.

---

### **Selection Guidelines (Filtering)**

To maintain clarity and prioritize impact, follow these constraints:

- **Major Actors Only:** Include only components where significant logic resides. If its removal would require a major rewrite, include it.
- **Exclusions:** Omit simple pass-throughs, thin wrappers, utility libraries, pure UI components, and configuration-only files.
- **Prioritization:** Limit to a maximum of **10 major components**.
