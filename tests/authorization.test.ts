
import { describe, expect, it } from "vitest";
import { Ledger } from "../src/ledger.js";

function createFundedLedger(): Ledger {
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

    return ledger;
}

describe("Authorization holds", () => {
    it("approves a hold when funds are sufficient", () => {
        const ledger = createFundedLedger();

        const result = ledger.process({
            id: "E3",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 20000n,
            bookedDay: 2,
            valueDate: 2,
        });

        expect(result.accepted).toBe(true);
        expect(ledger.getAuthorization("Auth-A")?.status)
            .toBe("APPROVED");

        expect(ledger.getBalance("ACC-001", 2)).toBe(25000n);
        expect(ledger.getActiveHolds("ACC-001")).toBe(20000n);
        expect(ledger.getAvailableBalance("ACC-001", 2)).toBe(5000n);

        // Holds do not affect the financial ledger.
        expect(ledger.getEntries()).toHaveLength(2);
        expect(ledger.getEvents()).toHaveLength(3);
    });

    it("records a declined authorization without reserving funds", () => {
        const ledger = createFundedLedger();

        const result = ledger.process({
            id: "E3",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 30000n,
            bookedDay: 2,
            valueDate: 2,
        });

        // The request was processed, but the authorization declined.
        expect(result.accepted).toBe(true);
        expect(ledger.getAuthorization("Auth-A")?.status)
            .toBe("DECLINED");

        expect(ledger.getActiveHolds("ACC-001")).toBe(0n);
        expect(ledger.getAvailableBalance("ACC-001", 2)).toBe(25000n);
        expect(ledger.getEntries()).toHaveLength(2);
    });

    it("prevents holds from exceeding available funds", () => {
        const ledger = createFundedLedger();

        ledger.process({
            id: "E3",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 20000n,
            bookedDay: 2,
            valueDate: 2,
        });

        const result = ledger.process({
            id: "E3-test",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-B",
            amount: 10000n,
            bookedDay: 2,
            valueDate: 2,
        });

        expect(result.accepted).toBe(true);
        expect(ledger.getAuthorization("Auth-A")?.status)
            .toBe("APPROVED");
        expect(ledger.getAuthorization("Auth-B")?.status)
            .toBe("DECLINED");

        expect(ledger.getActiveHolds("ACC-001")).toBe(20000n);
        expect(ledger.getAvailableBalance("ACC-001", 2)).toBe(5000n);
    });

    it("rejects duplicate authorization IDs", () => {
        const ledger = createFundedLedger();

        ledger.process({
            id: "E3",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 20000n,
            bookedDay: 2,
            valueDate: 2,
        });

        const result = ledger.process({
            id: "E3-test",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 10000n,
            bookedDay: 2,
            valueDate: 2,
        });

        expect(result.accepted).toBe(false);
        expect(result.message).toContain("Duplicate authorization ID");

        expect(ledger.getActiveHolds("ACC-001")).toBe(20000n);
        expect(ledger.getEvents()).toHaveLength(3);
    });
});
