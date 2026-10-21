# In-memory ledger — Assessment 1

A TypeScript, in-memory, append-only ledger replaying the supplied E1–E10 scenario over six logical days. It models credits, debits, authorization holds, settlement, value-dated reversals, overdraft fee reconciliation, BHD installment splitting, and interest capitalization.

## Run

```bash
npm install
npm run typecheck
npm test
npm run dev
```

The entry point is `src/main.ts`. Tests are under `tests/`, including `tests/replay.test.ts` for the full scenario. These commands assume the scripts configured in the submitted `package.json`.

## Design

- **Money:** `bigint` minor units throughout. AED uses 2 decimal places; BHD uses 3. No floating-point money arithmetic.
- **Ledger:** Accepted financial operations append signed entries; original entries are never edited or removed. A reversal appends an opposite-signed entry with the original value date.
- **Authorization:** An approved authorization reserves available funds but does not debit the posted ledger. Settlement posts the actual amount and releases the hold. Declined authorizations are recorded without financial impact.
- **Dates:** `bookedDay` records when the system received an operation; `valueDate` determines which daily balances it affects. `getBalanceAsOf` can restrict the booking-day cutoff.
- **Fees:** Reconciliation walks days chronologically, charging AED 25 once for a negative pre-fee daily balance. Prior days' fees affect later days. Changes caused by backdated events or reversals produce append-only fee adjustments/refunds.
- **Interest:** Daily 0.04% accrues only on positive value-dated closing balances. Fractional minor units are retained as integer numerators; one half-up rounding and capitalization occur at the end of Day 6.
- **Installments:** E10 is represented by three uniquely identified BHD credit entries totaling BHD 10.000.

## Results

| Account | Balance before interest | Capitalized interest | Final balance |
|---|---:|---:|---:|
| ACC-001 (AED) | 465.00 | 1.02 | **466.02** |
| ACC-002 (BHD) | 10.000 | 0.008 | **10.008** |

See `NUMBERS.md` for the reconciliation and calculations, `AMBIGUITIES.md` for interpretations, and `REJECTED.md` for rejected instructions and transactions.

## Scope and limitations

This is an in-memory assessment implementation, not a production banking system: there is no durable journal, database transaction boundary, concurrency control, external settlement integration, or restart recovery. Historical balances are recalculated from the current ledger view; backdated reversals can therefore change previously reported value-dated balances. Fee reconciliation is explicitly invoked by the replay. The fee amount is AED-specific; the current fee method does not implement currency-dependent fees for other accounts. Zero-interest capitalization returns zero without an entry or separate completed marker, so repeated zero-interest calls are not blocked. See `AMBIGUITIES.md`.
