
import { describe, expect, it } from "vitest";
import { Ledger } from "../src/ledger.js";

function createLedger(): Ledger {
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
        id: "E7",
        type: "DEBIT",
        accountId: "ACC-001",
        amount: 62000n,
        bookedDay: 5,
        valueDate: 2,
    });

    return ledger;
}

describe("Reversals", () => {
    it("reverses E7 without modifying the original entry", () => {
        const ledger = createLedger();

        expect(ledger.getBalance("ACC-001", 2)).toBe(-37000n);

        const result = ledger.process({
            id: "E9",
            type: "REVERSAL",
            accountId: "ACC-001",
            originalEventId: "E7",
            bookedDay: 6,
            valueDate: 2,
        });

        expect(result.accepted).toBe(true);
        expect(ledger.getBalance("ACC-001", 2)).toBe(25000n);

        const entries = ledger.getEntries();

        expect(entries).toHaveLength(4);
        expect(entries[2]?.amount).toBe(-62000n);
        expect(entries[3]?.amount).toBe(62000n);
        expect(entries[3]?.type).toBe("REVERSAL");
    });

    it("rejects reversal of an unknown transaction", () => {
        const ledger = createLedger();

        const result = ledger.process({
            id: "E9",
            type: "REVERSAL",
            accountId: "ACC-001",
            originalEventId: "E99",
            bookedDay: 6,
            valueDate: 2,
        });

        expect(result.accepted).toBe(false);
        expect(result.message).toContain("Original entry not found");
        expect(ledger.getEntries()).toHaveLength(3);
    });

    it("rejects reversing the same transaction twice", () => {
        const ledger = createLedger();

        ledger.process({
            id: "E9",
            type: "REVERSAL",
            accountId: "ACC-001",
            originalEventId: "E7",
            bookedDay: 6,
            valueDate: 2,
        });

        const result = ledger.process({
            id: "E9-again",
            type: "REVERSAL",
            accountId: "ACC-001",
            originalEventId: "E7",
            bookedDay: 6,
            valueDate: 2,
        });

        expect(result.accepted).toBe(false);
        expect(result.message).toContain("already reversed");
        expect(ledger.getEntries()).toHaveLength(4);
    });

    it("rejects a reversal with the wrong value date", () => {
        const ledger = createLedger();

        const result = ledger.process({
            id: "E9",
            type: "REVERSAL",
            accountId: "ACC-001",
            originalEventId: "E7",
            bookedDay: 6,
            valueDate: 6,
        });

        expect(result.accepted).toBe(false);
        expect(result.message).toContain("original value date");
        expect(ledger.getEntries()).toHaveLength(3);
    });
});
