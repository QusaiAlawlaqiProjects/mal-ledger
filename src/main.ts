
import { Ledger } from "./ledger.js";
import type { Account } from "./types.js";
import { splitAmount } from "./money.js";

const accounts: Account[] = [
    {
        id: "ACC-001",
        currency: "AED",
        openingBalance: 0n,
    },
    {
        id: "ACC-002",
        currency: "BHD",
        openingBalance: 0n,
    },
];

const ledger = new Ledger(accounts);

ledger.process({
    id: "E1",
    type: "CREDIT",
    accountId: "ACC-001",
    amount: 120000n,
    bookedDay: 1,
    valueDate: 1,
});

ledger.process({
    id: "E2",
    type: "DEBIT",
    accountId: "ACC-001",
    amount: 95000n,
    bookedDay: 1,
    valueDate: 1,
});

ledger.process({
    id: "E3",
    type: "AUTHORIZATION",
    accountId: "ACC-001",
    authorizationId: "Auth-A",
    amount: 20000n,
    bookedDay: 2,
    valueDate: 2,
});

ledger.process({
    id: "E4",
    type: "CREDIT",
    accountId: "ACC-001",
    amount: 40000n,
    bookedDay: 3,
    valueDate: 3,
});

ledger.process({
    id: "E5",
    type: "SETTLEMENT",
    accountId: "ACC-001",
    authorizationId: "Auth-A",
    amount: 18500n,
    bookedDay: 4,
    valueDate: 4,
});

// E6 — Settlement with unknown authorization
ledger.process({
    id: "E6",
    type: "SETTLEMENT",
    accountId: "ACC-001",
    authorizationId: "Auth-Z",
    amount: 18000n,
    bookedDay: 4,
    valueDate: 4,
});

ledger.process({
    id: "E7",
    type: "DEBIT",
    accountId: "ACC-001",
    amount: 62000n,
    bookedDay: 5,
    valueDate: 2,
});

ledger.process({
    id: "E8",
    type: "AUTHORIZATION",
    accountId: "ACC-001",
    authorizationId: "Auth-B",
    amount: 9000n,
    bookedDay: 5,
    valueDate: 5,
});

// Assess overdraft fees after E7
ledger.reconcileOverdraftFees("ACC-001", 5);

ledger.process({
    id: "E9",
    type: "REVERSAL",
    accountId: "ACC-001",
    originalEventId: "E7",
    bookedDay: 6,
    valueDate: 2,
});

// Reconcile overdraft fees after the reversal
ledger.reconcileOverdraftFees("ACC-001", 6);

// E10 — BHD 10.000 in three instalments
const instalments = splitAmount(10000n, 3);

for (let i = 0; i < instalments.length; i++) {
    ledger.process({
        id: `E10-${i + 1}`,
        type: "CREDIT",
        accountId: "ACC-002",
        amount: instalments[i]!,
        bookedDay: 5,
        valueDate: 5,
    });
}

// Final interest results
console.log("\n--- Daily Interest ---");

for (const accountId of ["ACC-001", "ACC-002"] as const) {
    const dailyInterest = ledger.calculateInterest(accountId);

    console.log(`\n${accountId}`);

    for (const day of dailyInterest) {
        console.log(
            `Day ${day.day}: Closing balance = ${day.closingBalance}, interest numerator = ${day.interestNumerator}`,
        );
    }

    const capitalized = ledger.capitalizeInterest(accountId);

    console.log("Capitalized interest:", capitalized);
    console.log(
        "Final balance:",
        ledger.getBalance(accountId, 6),
    );
}
