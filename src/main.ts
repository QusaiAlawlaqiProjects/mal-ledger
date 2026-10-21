import { Ledger } from "./ledger.js";
import type { Account, Day } from "./types.js";

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


console.log("\n--- Day 5: Overdraft Fee Assessment ---");

console.log(
    "Balance before fees:",
    ledger.getBalance("ACC-001", 5),
);

ledger.reconcileOverdraftFees("ACC-001", 5);

for (const entry of ledger.getEntries()) {
    if (entry.type === "OVERDRAFT_FEE") {
        console.log(
            `Day ${entry.valueDate}: AED ${Number(-entry.amount) / 100} fee`,
        );
    }
}

console.log(
    "Balance after fees:",
    ledger.getBalance("ACC-001", 5),
);


const e9 = ledger.process({
    id: "E9",
    type: "REVERSAL",
    accountId: "ACC-001",
    originalEventId: "E7",
    bookedDay: 6,
    valueDate: 2,
});

console.log("\n--- Day 6: Overdraft Fee Reconciliation ---");

console.log(
    "Balance before refunds:",
    ledger.getBalance("ACC-001", 6),
);

ledger.reconcileOverdraftFees("ACC-001", 6);

for (const entry of ledger.getEntries()) {
    if (entry.type === "FEE_REFUND") {
        console.log(
            `Day ${entry.valueDate}: AED ${Number(entry.amount) / 100} refunded`,
        );
    }
}

console.log(
    "Final balance:",
    ledger.getBalance("ACC-001", 6),
);

console.log(
    "Auth-B status:",
    ledger.getAuthorization("Auth-B")?.status,
);