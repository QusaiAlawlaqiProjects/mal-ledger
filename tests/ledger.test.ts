
import { describe, expect, it } from "vitest";
import { Ledger } from "../src/ledger.js";

function createLedger(): Ledger {
    return new Ledger([
        {
            id: "ACC-001",
            currency: "AED",
            openingBalance: 0n,
        },
    ]);
}

describe("Basic ledger", () => {
    it("calculates the balance from credits and debits", () => {
        const ledger = createLedger();

        const e1 = ledger.process({
            id: "E1",
            type: "CREDIT",
            accountId: "ACC-001",
            amount: 120000n,
            bookedDay: 1,
            valueDate: 1,
        });

        const e2 = ledger.process({
            id: "E2",
            type: "DEBIT",
            accountId: "ACC-001",
            amount: 95000n,
            bookedDay: 1,
            valueDate: 1,
        });

        expect(e1.accepted).toBe(true);
        expect(e2.accepted).toBe(true);

        expect(ledger.getBalance("ACC-001", 1)).toBe(25000n);
        expect(ledger.getEntries()).toHaveLength(2);
        expect(ledger.getEvents()).toHaveLength(2);
    });

    it("rejects duplicate event IDs", () => {
        const ledger = createLedger();

        const event = {
            id: "E1",
            type: "CREDIT" as const,
            accountId: "ACC-001" as const,
            amount: 120000n,
            bookedDay: 1 as const,
            valueDate: 1 as const,
        };

        ledger.process(event);

        const result = ledger.process(event);

        expect(result.accepted).toBe(false);
        expect(result.message).toContain("Duplicate event ID");

        expect(ledger.getEntries()).toHaveLength(1);
        expect(ledger.getEvents()).toHaveLength(1);
        expect(ledger.getBalance("ACC-001", 1)).toBe(120000n);
    });

    it("rejects non-positive amounts", () => {
        const ledger = createLedger();

        const result = ledger.process({
            id: "E1",
            type: "CREDIT",
            accountId: "ACC-001",
            amount: 0n,
            bookedDay: 1,
            valueDate: 1,
        });

        expect(result.accepted).toBe(false);
        expect(result.message).toContain("Amount must be positive");

        expect(ledger.getEntries()).toHaveLength(0);
        expect(ledger.getEvents()).toHaveLength(0);
    });

    it("rejects unknown accounts", () => {
        const ledger = createLedger();

        const result = ledger.process({
            id: "E1",
            type: "CREDIT",
            accountId: "ACC-002",
            amount: 10000n,
            bookedDay: 1,
            valueDate: 1,
        });

        expect(result.accepted).toBe(false);
        expect(result.message).toContain("Unknown account");

        expect(ledger.getEntries()).toHaveLength(0);
        expect(ledger.getEvents()).toHaveLength(0);
    });

    it("protects recorded entries from external modification", () => {
        const ledger = createLedger();

        ledger.process({
            id: "E1",
            type: "CREDIT",
            accountId: "ACC-001",
            amount: 120000n,
            bookedDay: 1,
            valueDate: 1,
        });

        const entries = ledger.getEntries();
        entries[0]!.amount = 1n;

        expect(ledger.getEntries()[0]!.amount).toBe(120000n);
        expect(ledger.getBalance("ACC-001", 1)).toBe(120000n);
    });
});
