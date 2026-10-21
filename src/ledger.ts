
import type {
    Account,
    AccountId,
    AuthorizationState,
    Day,
    LedgerEntry,
    LedgerEvent,
    ProcessingResult,
} from "./types.js";

export class Ledger {
    private readonly accounts: Map<AccountId, Account>;
    private readonly events: LedgerEvent[] = [];
    private readonly entries: LedgerEntry[] = [];
    private readonly eventIds = new Set<string>();
    private readonly results: ProcessingResult[] = [];

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


    public getResults(): ProcessingResult[] {
        const results: ProcessingResult[] = [];

        for (const result of this.results) {
            results.push({ ...result });
        }

        return results;
    }


    public process(event: LedgerEvent): ProcessingResult {
        const reject = (message: string): ProcessingResult => {
            const result: ProcessingResult = {
                eventId: event.id,
                accepted: false,
                message,
            };

            this.results.push(Object.freeze({ ...result }));
            return result;
        };

        if (this.eventIds.has(event.id)) {
            return reject(`Duplicate event ID: ${event.id}`);
        }

        if (!this.accounts.has(event.accountId)) {
            return reject(`Unknown account: ${event.accountId}`);
        }

        if (event.amount <= 0n) {
            return reject("Amount must be positive");
        }

        let entry: LedgerEntry | undefined;
        let nextAuthorization: AuthorizationState | undefined;
        let message = "";

        switch (event.type) {
            case "CREDIT":
            case "DEBIT": {
                entry = {
                    id: `entry-${event.id}`,
                    eventId: event.id,
                    accountId: event.accountId,
                    type: event.type,
                    amount:
                        event.type === "CREDIT"
                            ? event.amount
                            : -event.amount,
                    bookedDay: event.bookedDay,
                    valueDate: event.valueDate,
                };

                message = `${event.type} posted`;
                break;
            }

            case "AUTHORIZATION": {
                if (this.authorizations.has(event.authorizationId)) {
                    return reject(
                        `Duplicate authorization ID: ${event.authorizationId}`,
                    );
                }

                const available = this.getAvailableBalance(
                    event.accountId,
                    event.bookedDay,
                );

                const status =
                    available >= event.amount
                        ? "APPROVED"
                        : "DECLINED";

                nextAuthorization = {
                    authorizationId: event.authorizationId,
                    accountId: event.accountId,
                    amount: event.amount,
                    status,
                };

                message = `Authorization ${status.toLowerCase()}`;
                break;
            }

            case "SETTLEMENT": {
                const authorization = this.authorizations.get(
                    event.authorizationId,
                );

                if (!authorization) {
                    return reject(
                        `Unknown authorization: ${event.authorizationId}`,
                    );
                }

                if (authorization.accountId !== event.accountId) {
                    return reject("Authorization account mismatch");
                }

                if (authorization.status !== "APPROVED") {
                    return reject(
                        `Authorization is not active: ${event.authorizationId}`,
                    );
                }

                if (event.amount > authorization.amount) {
                    return reject(
                        "Settlement exceeds authorized amount",
                    );
                }

                entry = {
                    id: `entry-${event.id}`,
                    eventId: event.id,
                    accountId: event.accountId,
                    type: "SETTLEMENT",
                    amount: -event.amount,
                    bookedDay: event.bookedDay,
                    valueDate: event.valueDate,
                };

                nextAuthorization = {
                    ...authorization,
                    status: "SETTLED",
                    settlementAmount: event.amount,
                };

                message = "Settlement posted";
                break;
            }
        }

        // Commit only after the event has passed validation.
        this.events.push(Object.freeze({ ...event }));
        this.eventIds.add(event.id);

        if (entry) {
            this.entries.push(Object.freeze({ ...entry }));
        }

        if (nextAuthorization) {
            this.authorizations.set(
                nextAuthorization.authorizationId,
                Object.freeze({ ...nextAuthorization }),
            );
        }

        const result: ProcessingResult = {
            eventId: event.id,
            accepted: true,
            message,
        };

        this.results.push(Object.freeze({ ...result }));
        return result;
    }
}
