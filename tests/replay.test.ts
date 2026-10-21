
import { describe, expect, it } from "vitest";
import { Ledger } from "../src/ledger.js";
import { splitAmount } from "../src/money.js";
import type { Account } from "../src/types.js";

describe("Full E1-E10 replay", () => {
    it("processes all events and produces correct final balances", () => {
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

        // Day 1
        expect(ledger.process({
            id: "E1",
            type: "CREDIT",
            accountId: "ACC-001",
            amount: 120000n,
            bookedDay: 1,
            valueDate: 1,
        }).accepted).toBe(true);

        expect(ledger.process({
            id: "E2",
            type: "DEBIT",
            accountId: "ACC-001",
            amount: 95000n,
            bookedDay: 1,
            valueDate: 1,
        }).accepted).toBe(true);

        // Day 2
        expect(ledger.process({
            id: "E3",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 20000n,
            bookedDay: 2,
            valueDate: 2,
        }).accepted).toBe(true);

        expect(ledger.getAuthorization("Auth-A")?.status)
            .toBe("APPROVED");

        // Day 3
        expect(ledger.process({
            id: "E4",
            type: "CREDIT",
            accountId: "ACC-001",
            amount: 40000n,
            bookedDay: 3,
            valueDate: 3,
        }).accepted).toBe(true);

        // Day 4
        expect(ledger.process({
            id: "E5",
            type: "SETTLEMENT",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 18500n,
            bookedDay: 4,
            valueDate: 4,
        }).accepted).toBe(true);

        expect(ledger.getAuthorization("Auth-A")?.status)
            .toBe("SETTLED");

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

        // Day 5 — Backdated debit
        expect(ledger.process({
            id: "E7",
            type: "DEBIT",
            accountId: "ACC-001",
            amount: 62000n,
            bookedDay: 5,
            valueDate: 2,
        }).accepted).toBe(true);

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

        // Assess overdraft fees after E7.
        ledger.reconcileOverdraftFees("ACC-001", 5);

        const fees = ledger.getEntries().filter(
            (entry) => entry.type === "OVERDRAFT_FEE",
        );

        expect(fees).toHaveLength(3);
        expect(fees.map((entry) => entry.valueDate))
            .toEqual([2, 4, 5]);

        expect(ledger.getBalance("ACC-001", 5))
            .toBe(-23000n);

        // Day 6 — Reverse E7
        expect(ledger.process({
            id: "E9",
            type: "REVERSAL",
            accountId: "ACC-001",
            originalEventId: "E7",
            bookedDay: 6,
            valueDate: 2,
        }).accepted).toBe(true);

        ledger.reconcileOverdraftFees("ACC-001", 6);

        const refunds = ledger.getEntries().filter(
            (entry) => entry.type === "FEE_REFUND",
        );

        expect(refunds).toHaveLength(3);

        // Fees are offset, not deleted.
        expect(ledger.getBalance("ACC-001", 6))
            .toBe(46500n);

        // E10 — BHD 10.000 in three installments
        const installments = splitAmount(10000n, 3);

        expect(installments).toEqual([
            3334n,
            3333n,
            3333n,
        ]);

        for (let i = 0; i < installments.length; i++) {
            const result = ledger.process({
                id: `E10-${i + 1}`,
                type: "CREDIT",
                accountId: "ACC-002",
                amount: installments[i]!,
                bookedDay: 5,
                valueDate: 5,
            });

            expect(result.accepted).toBe(true);
        }

        expect(ledger.getBalance("ACC-002", 6))
            .toBe(10000n);

        // Capitalize interest at the end of Day 6.
        expect(ledger.capitalizeInterest("ACC-001"))
            .toBe(102n);

        expect(ledger.capitalizeInterest("ACC-002"))
            .toBe(8n);

        // Final balances
        expect(ledger.getBalance("ACC-001", 6))
            .toBe(46602n);

        expect(ledger.getBalance("ACC-002", 6))
            .toBe(10008n);

        // Verify rejected events never entered the event log.
        const events = ledger.getEvents();

        expect(events.some((event) => event.id === "E6"))
            .toBe(false);

        // Verify reversal preserved the original entry.
        const entries = ledger.getEntries();

        expect(entries.some((entry) => entry.eventId === "E7"))
            .toBe(true);

        expect(entries.some((entry) => entry.eventId === "E9"))
            .toBe(true);

        // Verify the declined authorization remains declined.
        expect(ledger.getAuthorization("Auth-B")?.status)
            .toBe("DECLINED");
    });
});
