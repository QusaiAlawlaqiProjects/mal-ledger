# Ambiguities and Assumptions

These are the areas where I had to make a decision rather than follow an explicit rule. I've written down what I chose and why, so the results can be reproduced.

## 1. How many fees should E7 create?

E7 arrives on Day 5 but has a value date of Day 2. I treated the value date as the date that affects the daily balances, so I recalculated the affected days instead of looking only at Day 5. That leaves negative closing balances on Days 2, 4, and 5, which means three AED 25 fees.

## 2. What does reversing a backdated entry mean?

I didn't remove E7 when E9 arrived. I added a separate entry that offsets it, using the original value date. This means the latest value-dated balance reflects the reversal, while the booking history still shows that E7 existed before Day 6. I handled fee corrections the same way: with new entries, not edits.

## 3. Can one overdraft fee cause another?

Yes, on a later day. I initially had to be careful about this because a fee changes the balance carried forward. I now calculate the days in order and include earlier fees when checking the next day's balance. I only assess one fee for a given account and day, based on that day's balance before its own fee.

## 4. When should interest be calculated?

I calculate interest after the event replay and fee corrections are complete. That gives one consistent set of daily balances for the six-day period. The assignment doesn't fully define how to handle interest that was already accrued before a late correction. In production, I would need an explicit adjustment policy instead of simply recalculating the period.

## 5. How should fractional interest be handled?

I kept the fractional amounts during the daily calculations and rounded only when interest was capitalized on Day 6. Rounding every day would throw away small amounts that can add up, especially for BHD.

## 6. How should E10 be represented?

The implementation processes one credit at a time, so I represented the three installments as E10-1, E10-2, and E10-3. Each has Day 5 as its booking and value date, even though E10 appears after E9 in the supplied processing order. I kept that order rather than rearranging the events by date.

## 7. Is a declined authorization a failed event?

I treated those as different things. E8 is processed successfully, but the authorization decision is `DECLINED`. It creates no hold and doesn't reduce the available balance. An invalid settlement such as E6, on the other hand, is rejected by the processor.

## 8. Does the AED 25 fee apply to BHD accounts?

I didn't assume that. The specified fee is in AED, and my fee reconciliation applies it to the AED account. A production version would need a currency-specific fee policy rather than reusing one amount for every currency.

## 9. What counts as completed interest capitalization?

For this assessment, I call capitalization once at the end of the replay. A positive amount creates an interest entry, and the implementation prevents posting that entry twice. One limitation is that a zero-interest result doesn't leave a completion marker. I would address that before supporting retries in production.

These decisions work for the assessment's fixed sequence. They aren't a substitute for agreed accounting rules, particularly around backdated corrections and period closing.
