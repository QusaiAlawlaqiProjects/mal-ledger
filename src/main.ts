import { Ledger } from "./ledger.js";
import type { Account } from "./types.js";

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

console.log("\nDay 2 — Authorization:");

console.log(
    "Ledger balance:",
    ledger.getBalance("ACC-001", 2),
);

console.log(
    "Active holds:",
    ledger.getActiveHolds("ACC-001"),
);

console.log(
    "Available balance:",
    ledger.getAvailableBalance("ACC-001", 2),
);

console.log(
    "Auth-A:",
    ledger.getAuthorization("Auth-A"),
);
