---
name: fishbone-diagram
description: Generate a short explanation and Mermaid fishbone-style diagram for identifying causes of a problem or performance issue. Use when the user asks for a fishbone diagram, cause-and-effect diagram, root cause diagram, or Ishikawa-style diagram.
---

# Fishbone Diagrams

Fishbone diagrams are another tool for helping a practice identify factors that are causing obstacles or affecting performance. They are also called cause-and-effect diagrams. Practices then use this information to generate and prioritize ideas for improvement.

## Five steps to creating a fishbone diagram

1. **Create a problem statement** and write it at the "head" of the fish. This is the "effect."
2. **Define the categories** of possible causes and write them at the end of each rib. Practices can create their own or use already existing category sets like this healthcare one: people, materials, methods, measurement, environmental factors, and policies and procedures.
3. **Brainstorm "causes" under each category.**
   - Ask "Why does this happen?" to stimulate brainstorming.
   - Draw lines off of each rib and write down "causes."
   - Place causes in more than one category if appropriate.
   - Ask practice to brainstorm possible causes for each category.
4. **Use the "5 Whys" process** to analyze the most important causes further. Add additional "bones" to the fish to record these.
5. **Use the causes to generate change ideas to test.** Ask the practice:
   - "What ideas do you have to address this?"
   - "Which idea do you want to try first?"

**Tip:** If you are using a white board or flip chart, take a picture of the diagram with your phone and email it to the team for them to review.

## Diagram

```mermaid
flowchart LR
    Problem["Problem / Effect"]

    Step1["1. Define Problem"] --> Problem
    Step2["2. Identify Categories"] --> Problem
    Step3["3. Brainstorm Causes"] --> Problem
    Step4["4. Analyze Root Causes"] --> Problem
    Step5["5. Prioritize Actions"] --> Problem

    Cause1["Clearly state the issue"] --> Step1
    Cause2["Use common categories"] --> Step2
    Cause3["Gather team input"] --> Step3
    Cause4["Ask why repeatedly"] --> Step4
    Cause5["Assign corrective actions"] --> Step5

    classDef problem fill:#111827,stroke:#000000,color:#ffffff
    classDef define fill:#bfdbfe,stroke:#1d4ed8,color:#111827
    classDef categories fill:#bbf7d0,stroke:#15803d,color:#111827
    classDef brainstorm fill:#fde68a,stroke:#b45309,color:#111827
    classDef rootcause fill:#fecaca,stroke:#b91c1c,color:#111827
    classDef action fill:#ddd6fe,stroke:#6d28d9,color:#111827

    class Problem problem
    class Step1,Cause1 define
    class Step2,Cause2 categories
    class Step3,Cause3 brainstorm
    class Step4,Cause4 rootcause
    class Step5,Cause5 action

    linkStyle default stroke:#374151,stroke-width:2px
```
