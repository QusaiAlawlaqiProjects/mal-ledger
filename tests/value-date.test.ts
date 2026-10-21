
import { describe, expect, it } from "vitest";
import { Ledger } from "../src/ledger.js";

describe("Value dates", () => {
    it("applies a backdated debit from its value date", () => {
        const ledger = new Ledger([
            {
                id: "ACC-001",
                currency: "AED",
                openingBalance: 0n,
            },
        ]);

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

        expect(ledger.getBalance("ACC-001", 2)).toBe(25000n);

        const result = ledger.process({
            id: "E7",
            type: "DEBIT",
            accountId: "ACC-001",
            amount: 62000n,
            bookedDay: 5,
            valueDate: 2,
        });

        expect(result.accepted).toBe(true);

        expect(ledger.getBalance("ACC-001", 1)).toBe(25000n);
        expect(ledger.getBalance("ACC-001", 2)).toBe(-37000n);
        expect(ledger.getBalance("ACC-001", 3)).toBe(3000n);
        expect(ledger.getBalance("ACC-001", 4)).toBe(-15500n);
        expect(ledger.getBalance("ACC-001", 5)).toBe(-15500n);

        expect(ledger.getEntries()).toHaveLength(5);
    });
});
