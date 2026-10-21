
import { describe, expect, it } from "vitest";
import { Ledger } from "../src/ledger.js";
import { splitAmount } from "../src/money.js";

describe("Currency precision", () => {
    it("splits BHD 10.000 into three exact instalments", () => {
        const amounts = splitAmount(10000n, 3);

        expect(amounts).toEqual([3334n, 3333n, 3333n]);

        let total = 0n;

        for (const amount of amounts) {
            total += amount;
        }

        expect(total).toBe(10000n);
    });

    it("posts all three instalments to ACC-002", () => {
        const ledger = new Ledger([
            {
                id: "ACC-002",
                currency: "BHD",
                openingBalance: 0n,
            },
        ]);

        const amounts = splitAmount(10000n, 3);

        for (let i = 0; i < amounts.length; i++) {
            const result = ledger.process({
                id: `E10-${i + 1}`,
                type: "CREDIT",
                accountId: "ACC-002",
                amount: amounts[i]!,
                bookedDay: 5,
                valueDate: 5,
            });

            expect(result.accepted).toBe(true);
        }

        expect(ledger.getBalance("ACC-002", 5)).toBe(10000n);
        expect(ledger.getEntries()).toHaveLength(3);
    });

    it("rejects invalid instalment counts", () => {
        expect(() => splitAmount(10000n, 0)).toThrow();
        expect(() => splitAmount(10000n, 2.5)).toThrow();
    });
});
