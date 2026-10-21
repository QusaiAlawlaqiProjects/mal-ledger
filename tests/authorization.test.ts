
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
        expect(ledger.getAuthorization("Auth-A")?.status).toBe("APPROVED");

        expect(ledger.getBalance("ACC-001", 2)).toBe(25000n);
        expect(ledger.getActiveHolds("ACC-001")).toBe(20000n);
        expect(ledger.getAvailableBalance("ACC-001", 2)).toBe(5000n);

        // Authorization holds do not create financial entries.
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

        expect(result.accepted).toBe(true);
        expect(ledger.getAuthorization("Auth-A")?.status).toBe("DECLINED");

        expect(ledger.getActiveHolds("ACC-001")).toBe(0n);
        expect(ledger.getAvailableBalance("ACC-001", 2)).toBe(25000n);
        expect(ledger.getEntries()).toHaveLength(2);
        expect(ledger.getEvents()).toHaveLength(3);
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
        expect(ledger.getAuthorization("Auth-A")?.status).toBe("APPROVED");
        expect(ledger.getAuthorization("Auth-B")?.status).toBe("DECLINED");

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

    it("declines E8 after the backdated debit E7", () => {
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

        ledger.process({
            id: "E7",
            type: "DEBIT",
            accountId: "ACC-001",
            amount: 62000n,
            bookedDay: 5,
            valueDate: 2,
        });

        const result = ledger.process({
            id: "E8",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-B",
            amount: 9000n,
            bookedDay: 5,
            valueDate: 5,
        });

        expect(result.accepted).toBe(true);
        expect(ledger.getAuthorization("Auth-B")?.status).toBe("DECLINED");

        expect(ledger.getBalance("ACC-001", 5)).toBe(-15500n);
        expect(ledger.getActiveHolds("ACC-001")).toBe(0n);
        expect(ledger.getAvailableBalance("ACC-001", 5)).toBe(-15500n);

        // Declined authorizations do not create financial entries.
        expect(ledger.getEntries()).toHaveLength(5);
        expect(ledger.getEvents()).toHaveLength(7);
    });
});
