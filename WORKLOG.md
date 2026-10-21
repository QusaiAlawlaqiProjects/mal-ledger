# Worklog

## Before Development

I received the assessment while working two long shifts at Barakah, which limited the time I had available to start coding.

| Date | Time (UAE) | Activity |
|---|---|---|
| 20/10/2026 | 06:00–20:00 | 14-hour work shift at Barakah |
| 20/10/2026 | 20:00–23:00 | Dinner, some initial reading about banking ledgers, and watching a few YouTube videos to understand the concepts |
| 21/10/2026 | 06:00–18:00 | 12-hour work shift at Barakah |
| 21/10/2026 | 18:00–21:00 | Travelling from Barakah to Abu Dhabi and discussing the system design with ChatGPT on my phone |
| 21/10/2026 | 21:30 | Started setting up GitHub and preparing the development environment |

Most of my implementation work started on the evening of 21 October. I focused on building the ledger step by step, testing each feature before moving to the next, and documenting the decisions and issues I encountered.

## Development Log

### 21/10/2026 — 9:43 PM
**Project Setup**

- Completed the initial project setup.

### 21/10/2026 — 10:03 PM
**Credit and Debit**

- Implemented the append-only credit and debit ledger.

### 21/10/2026 — 10:17 PM
**Authorizations**

- Extended event types to support authorizations.
- Implemented authorization approval and decline decisions.
- Added active hold tracking.
- Introduced available balance calculations.
- Added tests for sufficient funds, insufficient funds, and overlapping holds.

### 21/10/2026 — 10:42 PM
**Settlement and Rejected Events**

- E4: Added AED 400 credit using existing functionality; Day 3 balance reached AED 650.
- E5: Implemented settlement processing, debited AED 185, and released the AED 200 authorization hold.
- E6: Added rejection handling for unknown authorizations without affecting balances.
- Introduced `ProcessingResult` and updated tests to validate accepted and rejected events.

### 21/10/2026 — 10:48 PM
**Backdated Debit**

- E7: Quickly tested the backdated debit and confirmed the existing ledger already supports value-dated transactions without any code changes.

### 21/10/2026 — 10:52 PM
**Declined Authorization**

- E8: Verified that the existing authorization logic correctly declines Auth-B due to insufficient funds, without requiring any code changes.

### 21/10/2026 — 11:02 PM
**Reversals**

- E9: Implemented append-only reversals using compensating entries, preserving the original transaction and restoring value-dated balances without changing previous authorization decisions.

### 21/10/2026 — 11:16 PM
**Overdraft Fees**

- Added AED 25 daily fee assessment.
- Implemented append-only refunds after E9.
- Updated replay output to show balances before and after reconciliation.

### 21/10/2026 — 11:21 PM
**BHD Installments**

- E10: Implemented exact BHD installment splitting using integer minor units, distributing the rounding remainder while preserving the original total of BHD 10.000.

### 21/10/2026 — 11:38 PM
**Interest and Reconciliation**

- Implemented overdraft fee assessment and append-only refunds for reversed transactions.
- Added historical balance reconciliation and duplicate fee prevention.
- Implemented BHD installment splitting with accurate rounding using `bigint`.
- Added daily interest calculation (0.04%) and Day 6 capitalization.
- Added unit tests and updated the E1–E10 replay.
- Verified final balances: AED 466.02 and BHD 10.008.

### 21/10/2026 — 11:45 PM
**Cascading Overdraft Fee Fix**

- Added a regression test for cascading overdraft fees.
- Fixed daily reconciliation to include previously assessed fees.
- Preserved append-only fee adjustments and idempotent reconciliation.

### 21/10/2026 — 11:50 PM
**Integration Testing**

- Added complete E1–E10 integration test covering all transaction types.
- Verified authorization decisions, rejected settlement, backdated reversal, and overdraft reconciliation.
- Validated currency precision, interest capitalization, and final account balances.
- Confirmed all 30 tests pass across 9 test files.

### 22/10/2026 — 12:01 AM
**Documentation and Final Review**

- Completed `README.md`, `NUMBERS.md`, `AMBIGUITIES.md`, and `REJECTED.md`.
- Documented the calculations, assumptions, and reasons for rejecting incorrect acceptance criteria.
- Revised `AMBIGUITIES.md` and `REJECTED.md` to explain the decisions more clearly.
- Prepared the Architecture & Trade-offs PDF for Assessment 2.
- Confirmed the full E1–E10 replay passes all 30 tests across 9 test files.