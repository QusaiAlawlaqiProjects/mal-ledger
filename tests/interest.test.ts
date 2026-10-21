
import { describe, expect, it } from "vitest";
import { Ledger } from "../src/ledger.js";

describe("Daily interest", () => {
    it("accrues interest for positive balances only", () => {
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
            amount: 100000n,
            bookedDay: 1,
            valueDate: 1,
        });

        const daily = ledger.calculateInterest("ACC-001");

        expect(daily).toHaveLength(6);

        // AED 1,000 for six days:
        // 100000 minor units * 4 / 10000 * 6 = 240 minor units.
        expect(ledger.capitalizeInterest("ACC-001")).toBe(240n);

        expect(ledger.getBalance("ACC-001", 6)).toBe(100240n);
    });

    it("does not accrue interest on negative balances", () => {
        const ledger = new Ledger([
            {
                id: "ACC-001",
                currency: "AED",
                openingBalance: 0n,
            },
        ]);

        ledger.process({
            id: "E1",
            type: "DEBIT",
            accountId: "ACC-001",
            amount: 10000n,
            bookedDay: 1,
            valueDate: 1,
        });

        const daily = ledger.calculateInterest("ACC-001");

        for (const day of daily) {
            expect(day.interestNumerator).toBe(0n);
        }

        expect(ledger.capitalizeInterest("ACC-001")).toBe(0n);
    });

    it("prevents duplicate capitalization", () => {
        const ledger = new Ledger([
            {
                id: "ACC-001",
                currency: "AED",
                openingBalance: 100000n,
            },
        ]);

        ledger.capitalizeInterest("ACC-001");

        expect(() => ledger.capitalizeInterest("ACC-001"))
            .toThrow("Interest already capitalized");
    });

    it("preserves fractional daily interest until capitalization", () => {
        const ledger = new Ledger([
            {
                id: "ACC-002",
                currency: "BHD",
                openingBalance: 1000n,
            },
        ]);

        // BHD 1.000 earns 0.4 minor units per day.
        // Six days = 2.4 minor units, rounded to 2.
        expect(ledger.capitalizeInterest("ACC-002")).toBe(2n);

        expect(ledger.getBalance("ACC-002", 6)).toBe(1002n);
    });
});
