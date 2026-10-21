
import { describe, expect, it } from "vitest";
import { Ledger } from "../src/ledger.js";

function createFundedLedger() {
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

        ledger.process({
            id: "E3",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 20000n,
            bookedDay: 2,
            valueDate: 2,
        });

        expect(ledger.getAuthorization("Auth-A")?.status)
            .toBe("APPROVED");

        expect(ledger.getBalance("ACC-001", 2))
            .toBe(25000n);

        expect(ledger.getActiveHolds("ACC-001"))
            .toBe(20000n);

        expect(ledger.getAvailableBalance("ACC-001", 2))
            .toBe(5000n);

        // Authorization does not post a financial entry.
        expect(ledger.getEntries()).toHaveLength(2);
    });

    it("declines a hold when funds are insufficient", () => {
        const ledger = createFundedLedger();

        ledger.process({
            id: "E3",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-A",
            amount: 30000n,
            bookedDay: 2,
            valueDate: 2,
        });

        expect(ledger.getAuthorization("Auth-A")?.status)
            .toBe("DECLINED");

        expect(ledger.getActiveHolds("ACC-001"))
            .toBe(0n);

        expect(ledger.getBalance("ACC-001", 2))
            .toBe(25000n);
    });

    it("prevents two holds from reserving the same funds", () => {
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
            id: "E4-test",
            type: "AUTHORIZATION",
            accountId: "ACC-001",
            authorizationId: "Auth-B",
            amount: 10000n,
            bookedDay: 2,
            valueDate: 2,
        });

        expect(ledger.getAuthorization("Auth-A")?.status)
            .toBe("APPROVED");

        expect(ledger.getAuthorization("Auth-B")?.status)
            .toBe("DECLINED");

        expect(ledger.getAvailableBalance("ACC-001", 2))
            .toBe(5000n);
    });
});
