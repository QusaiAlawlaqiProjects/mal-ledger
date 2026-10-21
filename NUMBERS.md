# Numbers and reconciliation

All internal values are integer **minor units** (`bigint`): AED 1.00 = `100n`; BHD 1.000 = `1000n`.

## ACC-001 — AED

| Event | Booked | Value | Financial effect | Notes |
|---|---:|---:|---:|---|
| E1 | 1 | 1 | +1,200.00 | Credit |
| E2 | 1 | 1 | -950.00 | Debit |
| E3 | 2 | 2 | 0.00 | Auth-A holds 200.00; initially approved |
| E4 | 3 | 3 | +400.00 | Credit |
| E5 | 4 | 4 | -185.00 | Auth-A settlement; releases 200.00 hold |
| E6 | 4 | 4 | 0.00 | Unknown Auth-Z; rejected |
| E7 | 5 | 2 | -620.00 | Backdated debit |
| E8 | 5 | 5 | 0.00 | Auth-B 90.00 declined |
| E9 | 6 | 2 | +620.00 | Append-only reversal of E7 |

After E7, the recomputed daily balance is negative on value days 2, 4, and 5, producing **three AED 25 fees**, or AED 75 total. Reconciliation after E9 appends three offsetting refunds, totaling AED 75. Original fee and E7 entries remain in the journal.

**Final value-dated closing balances after E9 and fee reconciliation, before interest:**

| Day | Closing AED | Daily interest AED (exact) |
|---|---:|---:|
| 1 | 250.00 | 0.1000 |
| 2 | 250.00 | 0.1000 |
| 3 | 650.00 | 0.2600 |
| 4 | 465.00 | 0.1860 |
| 5 | 465.00 | 0.1860 |
| 6 | 465.00 | 0.1860 |

Daily exact interest totals **AED 1.0180**, rounded once at capitalization to **AED 1.02**. Final balance: **AED 466.02** (`46602n`). The interest is calculated on the retrospectively reconciled daily balances, not historical snapshots as originally known each day.

## ACC-002 — BHD

E10 is one logical credit of **BHD 10.000**, posted as three credit entries:

| Entry | BHD | Minor units |
|---|---:|---:|
| E10-1 | 3.334 | 3334 |
| E10-2 | 3.333 | 3333 |
| E10-3 | 3.333 | 3333 |
| **Total** | **10.000** | **10000** |

Day 1–4 balances are zero. Days 5 and 6 each close at BHD 10.000, accruing BHD 0.004 per day. Capitalized interest = **BHD 0.008** (`8n`). Final balance: **BHD 10.008** (`10008n`).

## Checks

The complete replay is exercised by `tests/replay.test.ts`. The user-observed run reported **30 passing tests across 9 files**. The intentional contradictory acceptance example, if included separately, must not silently turn the default test suite red.
