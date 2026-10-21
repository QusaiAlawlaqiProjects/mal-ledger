
import type {
    Account,
    AccountId,
    AuthorizationState,
    Day,
    LedgerEntry,
    LedgerEvent,
} from "./types.js";

export class Ledger {
    private readonly accounts: Map<AccountId, Account>;
    private readonly events: LedgerEvent[] = [];
    private readonly entries: LedgerEntry[] = [];
    private readonly eventIds = new Set<string>();

    // Authorization
    private readonly authorizations =
        new Map<string, AuthorizationState>();

    constructor(accounts: Account[]) {
        this.accounts = new Map(
            accounts.map((account) => [
                account.id,
                Object.freeze({ ...account }),
            ]),
        );

        if (this.accounts.size !== accounts.length) {
            throw new Error("Duplicate account ID");
        }
    }

    public getEntries(): LedgerEntry[] {
        return this.entries.map((entry) => ({ ...entry }));
    }

    public getEvents(): LedgerEvent[] {
        return this.events.map((event) => ({ ...event }));
    }

    public getAuthorization(
        authorizationId: string,
    ): AuthorizationState | undefined {
        const authorization = this.authorizations.get(authorizationId);

        return authorization ? { ...authorization } : undefined;
    }

    public getBalance(
        accountId: AccountId,
        day: Day,
    ): bigint {
        const account = this.accounts.get(accountId);

        // Check if account exists
        if (!account) {
            throw new Error(`Unknown account: ${accountId}`);
        }

        let balance = account.openingBalance;

        for (const entry of this.entries) {
            if (
                entry.accountId === accountId &&
                entry.valueDate <= day
            ) {
                balance += entry.amount;
            }
        }

        return balance;
    }

    public getActiveHolds(accountId: AccountId): bigint {
        if (!this.accounts.has(accountId)) {
            throw new Error(`Unknown account: ${accountId}`);
        }

        let total = 0n;

        for (const authorization of this.authorizations.values()) {
            if (
                authorization.accountId === accountId &&
                authorization.status === "APPROVED"
            ) {
                total += authorization.amount;
            }
        }

        return total;
    }

    public getAvailableBalance(
        accountId: AccountId,
        day: Day,
    ): bigint {
        return (
            this.getBalance(accountId, day) -
            this.getActiveHolds(accountId)
        );
    }

    public process(event: LedgerEvent): void {

        // Validation Checks
        if (this.eventIds.has(event.id)) {
            throw new Error(`Duplicate event ID: ${event.id}`);
        }

        if (!this.accounts.has(event.accountId)) {
            throw new Error(`Unknown account: ${event.accountId}`);
        }

        if (event.amount <= 0n) {
            throw new Error("Amount must be positive");
        }

        if (event.type === "AUTHORIZATION") {
            if (this.authorizations.has(event.authorizationId)) {
                throw new Error(
                    `Duplicate authorization ID: ${event.authorizationId}`,
                );
            }

            const available = this.getAvailableBalance(
                event.accountId,
                event.bookedDay,
            );

            const status =
                available >= event.amount ? "APPROVED" : "DECLINED";

            const authorization: AuthorizationState = {
                authorizationId: event.authorizationId,
                accountId: event.accountId,
                amount: event.amount,
                status,
            };

            this.authorizations.set(
                event.authorizationId,
                Object.freeze({ ...authorization }),
            );

            // Both approval and decline are valid processing outcomes.
            this.events.push(Object.freeze({ ...event }));
            this.eventIds.add(event.id);

            return;
        }

        if (event.type === "CREDIT" || event.type === "DEBIT") {
            const signedAmount =
                event.type === "CREDIT"
                    ? event.amount
                    : -event.amount;

            const entry: LedgerEntry = {
                id: `entry-${event.id}`,
                eventId: event.id,
                accountId: event.accountId,
                type: event.type,
                amount: signedAmount,
                bookedDay: event.bookedDay,
                valueDate: event.valueDate,
            };

            // Commit only after all validations succeed.
            this.events.push(Object.freeze({ ...event }));
            this.entries.push(Object.freeze({ ...entry }));
            this.eventIds.add(event.id);

        }
    }
}
