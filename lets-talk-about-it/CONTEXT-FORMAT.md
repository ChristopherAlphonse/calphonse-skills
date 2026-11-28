# CONTEXT.md Format

## Structure

```md
# {Context Name}

{1-2 sentences: what it is and why it exists.}

## Language

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account

## Relationships

- An **Order** produces one or more **Invoices**
- An **Invoice** belongs to exactly one **Customer**

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, create the **Invoice** immediately?"
> **Domain expert:** "No: an **Invoice** is generated only after **Fulfillment** is confirmed."

## Flagged ambiguities

- "account" meant both **Customer** and **User**: resolved as distinct concepts.
```

## Rules

- **Opinionated:** when multiple words name one concept, pick the best; list the others as aliases to avoid.
- **Flag conflicts** in "Flagged ambiguities" with a clear resolution.
- **Tight definitions:** one sentence max. Define what the term IS, not what it does.
- **Show relationships:** bold term names; express cardinality where obvious.
- **Project-specific terms only.** Exclude general programming concepts: timeouts, error types, utility patterns. Ask: unique to this context, or general? Only the former belongs.
- **Group terms under subheadings** when natural clusters emerge; flat list fine for one cohesive area.
- **Example dialogue:** dev + domain expert, terms interacting naturally, boundaries between related concepts.

## Single vs multi-context repos

- **Single context (most repos):** one root `CONTEXT.md`.
- **Multiple contexts:** root `CONTEXT-MAP.md` lists contexts, locations, relationships:

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md): receives and tracks orders
- [Billing](./src/billing/CONTEXT.md): generates invoices, processes payments
- [Fulfillment](./src/fulfillment/CONTEXT.md): warehouse picking and shipping

## Relationships

- **Ordering → Fulfillment**: `OrderPlaced`; Fulfillment starts picking
- **Fulfillment → Billing**: `ShipmentDispatched`; Billing generates invoices
- **Ordering ↔ Billing**: shared `CustomerId`, `Money` types
```

Inference:

- `CONTEXT-MAP.md` exists → read it for contexts.
- Only root `CONTEXT.md` exists → single context.
- Neither exists → create root `CONTEXT.md` lazily when first term resolved.
- Multiple contexts → infer which one the topic relates to; ask if unclear.
