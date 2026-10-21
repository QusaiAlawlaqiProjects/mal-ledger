
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

describe("Overdraft fees", () => {
    it("tracks historical balances before and after E7 and E9", () => {
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

        ledger.process({
            id: "E7",
            type: "DEBIT",
            accountId: "ACC-001",
            amount: 62000n,
            bookedDay: 5,
            valueDate: 2,
        });

        ledger.process({
            id: "E9",
            type: "REVERSAL",
            accountId: "ACC-001",
            originalEventId: "E7",
            bookedDay: 6,
            valueDate: 2,
        });

        expect(ledger.getBalanceAsOf("ACC-001", 2, 4))
            .toBe(25000n);

        expect(ledger.getBalanceAsOf("ACC-001", 2, 5))
            .toBe(-37000n);

        expect(ledger.getBalanceAsOf("ACC-001", 2, 6))
            .toBe(25000n);
    });

    it("assesses and refunds overdraft fees after E7 and E9", () => {
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

        const e6 = ledger.process({
            id: "E6",
            type: "SETTLEMENT",
            accountId: "ACC-001",
            authorizationId: "Auth-Z",
            amount: 18000n,
            bookedDay: 4,
            valueDate: 4,
        });

        expect(e6.accepted).toBe(false);

        const e7 = ledger.process({
            id: "E7",
            type: "DEBIT",
            accountId: "ACC-001",
            amount: 62000n,
            bookedDay: 5,
            valueDate: 2,
        });

        expect(e7.accepted).toBe(true);

        const e8 = ledger.process({
            id: "E8",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-B",
            amount: 9000n,
            bookedDay: 5,
            valueDate: 5,
        });

        expect(e8.accepted).toBe(true);
        expect(ledger.getAuthorization("Auth-B")?.status)
            .toBe("DECLINED");

        ledger.reconcileOverdraftFees("ACC-001", 5);

        const fees = ledger.getEntries().filter(
            (entry) => entry.type === "OVERDRAFT_FEE",
        );

        expect(fees).toHaveLength(3);
        expect(fees.map((entry) => entry.valueDate))
            .toEqual([2, 4, 5]);

        expect(ledger.getBalance("ACC-001", 5))
            .toBe(-23000n);

        // Reconciliation must not duplicate fees.
        ledger.reconcileOverdraftFees("ACC-001", 5);

        expect(ledger.getEntries()).toHaveLength(8);

        const e9 = ledger.process({
            id: "E9",
            type: "REVERSAL",
            accountId: "ACC-001",
            originalEventId: "E7",
            bookedDay: 6,
            valueDate: 2,
        });

        expect(e9.accepted).toBe(true);

        ledger.reconcileOverdraftFees("ACC-001", 6);

        const refunds = ledger.getEntries().filter(
            (entry) => entry.type === "FEE_REFUND",
        );

        expect(refunds).toHaveLength(3);
        expect(refunds.map((entry) => entry.valueDate))
            .toEqual([2, 4, 5]);

        expect(ledger.getBalance("ACC-001", 6))
            .toBe(46500n);

        expect(ledger.getEntries()).toHaveLength(12);

        expect(ledger.getAuthorization("Auth-B")?.status)
            .toBe("DECLINED");
    });

    it("includes earlier fees when determining later overdrafts", () => {
        const ledger = createLedger();

        // Day 1: AED 10.00
        ledger.process({
            id: "T1",
            type: "CREDIT",
            accountId: "ACC-001",
            amount: 1000n,
            bookedDay: 1,
            valueDate: 1,
        });

        // Day 2: AED -5.00 before fees.
        ledger.process({
            id: "T2",
            type: "DEBIT",
            accountId: "ACC-001",
            amount: 1500n,
            bookedDay: 2,
            valueDate: 2,
        });

        // Day 3: AED +15.00 without fees,
        // but AED -10.00 after the Day 2 fee.
        ledger.process({
            id: "T3",
            type: "CREDIT",
            accountId: "ACC-001",
            amount: 2000n,
            bookedDay: 3,
            valueDate: 3,
        });

        ledger.reconcileOverdraftFees("ACC-001", 3);

        const fees = ledger.getEntries().filter(
            (entry) => entry.type === "OVERDRAFT_FEE",
        );

        // Day 2 and Day 3 both require fees.
        expect(fees).toHaveLength(2);

        expect(fees.map((entry) => entry.valueDate))
            .toEqual([2, 3]);

        expect(ledger.getBalance("ACC-001", 1))
            .toBe(1000n);

        expect(ledger.getBalance("ACC-001", 2))
            .toBe(-3000n);

        expect(ledger.getBalance("ACC-001", 3))
            .toBe(-3500n);

        // Running reconciliation again must be safe.
        ledger.reconcileOverdraftFees("ACC-001", 3);

        expect(ledger.getEntries()).toHaveLength(5);
    });
});
