---
status: Accepted
date: 2026-11-15
tags: [balances]
specs: [balances.md]
summary: 'The balances of a group are one folded row per person by net balance, its debts as sentences with a Settle up each.'
---

# ADR-0029: The balances of a group fold by each person's net balance

## Context

The balances of a group were one sentence per debt ("Bruno owes Ana €5.00") with a ghost Settle up after each, and under them a closed "Everyone's balance". With three people or more the sentences make a flat wall: nothing says at a glance who gets money back and who pays, and the long Settle up next to every line pushes the amounts around.

## Decision

- **One row per person** with a balance, as a `Disclosure`: their net balance in a short sentence ("You get back", "Bruno owes") and its `Amount` with the cues of [ADR-0028](0028-amounts-show-which-way-they-go.md), arrows included. The person's own row comes first and starts open; then who gets back the most, then who owes the most; the people with nothing to settle at the foot, in secondary text, with nothing to open.
- **Under a row**, the debts that make up that balance, each a short sentence of its own from the side of the person of the row ("Bruno owes you", "You owe Diego", "Carla owes Bruno"), with its amount and its cues, so the lines add up to the row. A debt shows under both of its people.
- **Settle up** is a ghost button with the `payments` icon alone, a square of `--size-touch` with its icon in the middle, named by the sentence of the debt for assistive technology. A debt has one on each of its lines, under whoever owes and under whoever is owed, and both open the same form with the debt filled in; their names differ by the sentence of the line. A line naming somebody who left has none, and neither does a closed group.
- **"Everyone's balance" goes**: the rows are the balance of everyone.
- Screen readers read each row as its sentence and amount, and each line as the full sentence of the debt.

## Consequences

- The balance in words above the sheet stays: it is the one line that says what the person is owed or owes before anything opens.
- The simplified view changes the lines under the rows, never the rows: the net balance of each person is the same in both.

## Alternatives considered

- A line per debt with its amount in a column, the payer and the payee as the anchor: easier than the sentences, but still flat with many people.
- Bars from a zero axis for each person: quick to read, but one more chart above the list that says the same.
- Grouping by whoever is owed, or by whoever pays: half of the people show only on the other side; a person's net balance is what the owner reads first.
