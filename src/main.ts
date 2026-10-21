import { Ledger } from "./ledger.js";
import type { Account, Day } from "./types.js";
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
// E6 — Day 4 settlement with unknown authorization
ledger.process({
    id: "E6",
    type: "SETTLEMENT",
    accountId: "ACC-001",
    authorizationId: "Auth-Z",
    amount: 18000n,
    bookedDay: 4,
    valueDate: 4,
});

const e7 = ledger.process({
    id: "E7",
    type: "DEBIT",
    accountId: "ACC-001",
    amount: 62000n,
    bookedDay: 5,
    valueDate: 2,
});

const e8 = ledger.process({
    id: "E8",
    type: "AUTHORIZATION",
    accountId: "ACC-001",
    authorizationId: "Auth-B",
    amount: 9000n,
    bookedDay: 5,
    valueDate: 5,
});

const e9 = ledger.process({
    id: "E9",
    type: "REVERSAL",
    accountId: "ACC-001",
    originalEventId: "E7",
    bookedDay: 6,
    valueDate: 2,
});

console.log("\n--- E10: BHD Instalments ---");

const instalments = splitAmount(10000n, 3);

for (let i = 0; i < instalments.length; i++) {
    const result = ledger.process({
        id: `E10-${i + 1}`,
        type: "CREDIT",
        accountId: "ACC-002",
        amount: instalments[i]!,
        bookedDay: 5,
        valueDate: 5,
    });

    console.log(
        `Instalment ${i + 1}:`,
        instalments[i],
        result,
    );
}

console.log(
    "ACC-002 balance:",
    ledger.getBalance("ACC-002", 6),
);