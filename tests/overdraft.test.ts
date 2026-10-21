
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

        // E1 — Credit AED 1,200
        ledger.process({
            id: "E1",
            type: "CREDIT",
            accountId: "ACC-001",
            amount: 120000n,
            bookedDay: 1,
            valueDate: 1,
        });

        // E2 — Debit AED 950
        ledger.process({
            id: "E2",
            type: "DEBIT",
            accountId: "ACC-001",
            amount: 95000n,
            bookedDay: 1,
            valueDate: 1,
        });

        // E3 — Authorization hold AED 200
        ledger.process({
            id: "E3",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 20000n,
            bookedDay: 2,
            valueDate: 2,
        });

        // E4 — Credit AED 400
        ledger.process({
            id: "E4",
            type: "CREDIT",
            accountId: "ACC-001",
            amount: 40000n,
            bookedDay: 3,
            valueDate: 3,
        });

        // E5 — Settle Auth-A for AED 185
        ledger.process({
            id: "E5",
            type: "SETTLEMENT",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 18500n,
            bookedDay: 4,
            valueDate: 4,
        });

        // E6 — Unknown authorization, must be rejected
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

        // E7 — Backdated debit AED 620
        const e7 = ledger.process({
            id: "E7",
            type: "DEBIT",
            accountId: "ACC-001",
            amount: 62000n,
            bookedDay: 5,
            valueDate: 2,
        });

        expect(e7.accepted).toBe(true);

        // E8 — Authorization Auth-B must decline
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

        // Reconcile overdraft fees using Day 5 knowledge.
        ledger.reconcileOverdraftFees("ACC-001", 5);

        const fees = ledger.getEntries().filter(
            (entry) => entry.type === "OVERDRAFT_FEE",
        );

        // Negative balances on Days 2, 4, and 5.
        expect(fees).toHaveLength(3);

        expect(fees.map((entry) => entry.valueDate))
            .toEqual([2, 4, 5]);

        // AED -155 minus three AED 25 fees = AED -230.
        expect(ledger.getBalance("ACC-001", 5))
            .toBe(-23000n);

        // Repeated reconciliation should not create duplicate fees.
        ledger.reconcileOverdraftFees("ACC-001", 5);

        expect(ledger.getEntries()).toHaveLength(8);

        // E9 — Reverse E7 on Day 6
        const e9 = ledger.process({
            id: "E9",
            type: "REVERSAL",
            accountId: "ACC-001",
            originalEventId: "E7",
            bookedDay: 6,
            valueDate: 2,
        });

        expect(e9.accepted).toBe(true);

        // Reconcile again after the reversal.
        ledger.reconcileOverdraftFees("ACC-001", 6);

        const refunds = ledger.getEntries().filter(
            (entry) => entry.type === "FEE_REFUND",
        );

        expect(refunds).toHaveLength(3);

        expect(refunds.map((entry) => entry.valueDate))
            .toEqual([2, 4, 5]);

        // Original fees remain, but refunds offset them.
        expect(ledger.getBalance("ACC-001", 6))
            .toBe(46500n);

        // 5 original financial entries + 3 fees
        // + 1 reversal + 3 refunds = 12 entries.
        expect(ledger.getEntries()).toHaveLength(12);

        // Auth-B must remain declined after E9.
        expect(ledger.getAuthorization("Auth-B")?.status)
            .toBe("DECLINED");
    });
});
