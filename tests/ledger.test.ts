
import { describe, expect, it } from "vitest";
import { Ledger } from "../src/ledger.js";

function createLedger() {
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

        expect(ledger.getBalance("ACC-001", 1))
            .toBe(25000n);

        expect(ledger.getEntries()).toHaveLength(2);
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

        expect(() => ledger.process(event))
            .toThrow("Duplicate event ID");

        expect(ledger.getEntries()).toHaveLength(1);
    });

    it("rejects non-positive amounts", () => {
        const ledger = createLedger();

        expect(() =>
            ledger.process({
                id: "E1",
                type: "CREDIT",
                accountId: "ACC-001",
                amount: 0n,
                bookedDay: 1,
                valueDate: 1,
            }),
        ).toThrow("Amount must be positive");

        expect(ledger.getEntries()).toHaveLength(0);
    });

    it("keeps financial entries append-only", () => {
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

        expect(ledger.getEntries()[0]!.amount)
            .toBe(120000n);
    });
});
