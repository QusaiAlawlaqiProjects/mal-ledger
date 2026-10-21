# Rejected Events and Expectations

I separated two cases here: events the ledger actually rejects, and expectations in the assessment that I chose not to implement because they conflict with the balances or the append-only approach.

## Events and authorization decisions

**E6 — Settlement against Auth-Z**

I rejected this event because Auth-Z doesn't exist. Posting a settlement without a matching approved authorization would bypass the authorization check. No settlement entry is created.

**E8 — Authorization for AED 90**

I recorded a `DECLINED` decision rather than rejecting the event itself. By this point, the available balance is insufficient. The request was valid enough to process, but it shouldn't create a hold or reserve any money.

## Expectations I disagreed with

### E7 should create only one overdraft fee

I don't think one fee is correct. E7 is booked late but valued on Day 2, so it changes more than one daily closing balance. After recalculating the affected days and accounting for earlier fees, Days 2, 4, and 5 qualify. I therefore post three fees, not one.

### E8 should be approved

That would allow a hold without enough available funds. I kept the authorization decision as `DECLINED`, with no active hold.

### E9 should make it look like E7 never happened

The latest value-dated balance can be corrected, but the history shouldn't disappear. E7 was known and processed on Day 5, and E9 reversed it on Day 6. Both entries remain, along with the fees and their refunds. This is important for explaining what the system knew at each point in time.

### All three BHD installments should be 3.334

Three installments of BHD 3.334 add up to BHD 10.002, not BHD 10.000. I used **3.334 + 3.333 + 3.333 = 10.000**. The first installment receives the extra minor unit.

### Fractional daily interest should be discarded

I didn't truncate interest each day because that loses value. I kept the fractional precision during the six days and rounded the total once at capitalization.

## Intentionally failing acceptance test

This example captures the BHD installment contradiction directly:

```ts
import { expect, it } from "vitest";
import { splitAmount } from "../src/money.js";

it.fails("expects all three BHD installments to be 3.334", () => {
    expect(splitAmount(10000n, 3)).toEqual([
        3334n,
        3334n,
        3334n,
    ]);
});
```

The expectation is deliberately wrong: it asks for 10,002 minor units when the original credit is only 10,000. I used `it.fails` to show that this assertion is expected to fail, without turning the normal test suite red. This example is documented here; it isn't a separate executable test file in the repository.

I preferred to reject these expectations explicitly rather than change the ledger to produce numbers I couldn't justify.
