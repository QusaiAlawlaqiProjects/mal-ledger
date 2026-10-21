
import { describe, expect, it } from "vitest";
import { Ledger } from "../src/ledger.js";

function createLedgerWithAuthorization(): Ledger {
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

    return ledger;
}

describe("Settlement processing", () => {
    it("settles E5 and releases the authorization hold", () => {
        const ledger = createLedgerWithAuthorization();

        const result = ledger.process({
            id: "E5",
            type: "SETTLEMENT",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 18500n,
            bookedDay: 4,
            valueDate: 4,
        });

        expect(result.accepted).toBe(true);
        expect(ledger.getBalance("ACC-001", 4)).toBe(46500n);
        expect(ledger.getActiveHolds("ACC-001")).toBe(0n);
        expect(ledger.getAvailableBalance("ACC-001", 4)).toBe(46500n);

        expect(ledger.getAuthorization("Auth-A")?.status)
            .toBe("SETTLED");

        expect(ledger.getAuthorization("Auth-A")?.settlementAmount)
            .toBe(18500n);

        expect(ledger.getEntries()).toHaveLength(4);
    });

    it("rejects E6 because Auth-Z does not exist", () => {
        const ledger = createLedgerWithAuthorization();

        ledger.process({
            id: "E5",
            type: "SETTLEMENT",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 18500n,
            bookedDay: 4,
            valueDate: 4,
        });

        const result = ledger.process({
            id: "E6",
            type: "SETTLEMENT",
            accountId: "ACC-001",
            authorizationId: "Auth-Z",
            amount: 18000n,
            bookedDay: 4,
            valueDate: 4,
        });

        expect(result.accepted).toBe(false);
        expect(result.message).toContain("Unknown authorization");

        // E6 must not move money.
        expect(ledger.getBalance("ACC-001", 4)).toBe(46500n);
        expect(ledger.getEntries()).toHaveLength(4);
        expect(ledger.getActiveHolds("ACC-001")).toBe(0n);
    });

    it("rejects a second settlement of the same authorization", () => {
        const ledger = createLedgerWithAuthorization();

        ledger.process({
            id: "E5",
            type: "SETTLEMENT",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 18500n,
            bookedDay: 4,
            valueDate: 4,
        });

        const result = ledger.process({
            id: "E5-again",
            type: "SETTLEMENT",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 18500n,
            bookedDay: 4,
            valueDate: 4,
        });

        expect(result.accepted).toBe(false);
        expect(ledger.getBalance("ACC-001", 4)).toBe(46500n);
        expect(ledger.getEntries()).toHaveLength(4);
    });

    it("rejects settlement exceeding the authorized amount", () => {
        const ledger = createLedgerWithAuthorization();

        const result = ledger.process({
            id: "E5",
            type: "SETTLEMENT",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 21000n,
            bookedDay: 4,
            valueDate: 4,
        });

        expect(result.accepted).toBe(false);
        expect(result.message).toContain(
            "Settlement exceeds authorized amount",
        );

        expect(ledger.getAuthorization("Auth-A")?.status)
            .toBe("APPROVED");

        expect(ledger.getActiveHolds("ACC-001")).toBe(20000n);
        expect(ledger.getBalance("ACC-001", 4)).toBe(65000n);
    });
});
