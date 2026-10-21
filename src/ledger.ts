
import type {
    Account,
    AccountId,
    Day,
    LedgerEntry,
    LedgerEvent,
} from "./types.js";

export class Ledger {
    private readonly accounts: Map<AccountId, Account>;
    private readonly events: LedgerEvent[] = [];
    private readonly entries: LedgerEntry[] = [];
    private readonly eventIds = new Set<string>();

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
