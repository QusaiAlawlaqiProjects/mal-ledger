
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

    private feeSequence = 0;

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


    public getBalanceAsOf(
        accountId: AccountId,
        valueDay: Day,
        asOfBookedDay: Day,
    ): bigint {
        const account = this.accounts.get(accountId);

        if (!account) {
            throw new Error(`Unknown account: ${accountId}`);
        }

        let balance = account.openingBalance;

        for (const entry of this.entries) {
            if (
                entry.accountId === accountId &&
                entry.valueDate <= valueDay &&
                entry.bookedDay <= asOfBookedDay
            ) {
                balance += entry.amount;
            }
        }

        return balance;
    }


    public reconcileOverdraftFees(
        accountId: AccountId,
        bookedDay: Day,
    ): void {
        const account = this.accounts.get(accountId);

        if (!account) {
            throw new Error(`Unknown account: ${accountId}`);
        }

        // AED 25.00 in minor units.
        const feeAmount = 2500n;

        // Only assess days that have already occurred.
        for (let day = 1; day <= bookedDay; day++) {
            const valueDay = day as Day;

            // Calculate balance excluding existing fee entries.
            // We reconcile fees separately to avoid double counting.
            let balance = account.openingBalance;

            for (const entry of this.entries) {
                if (
                    entry.accountId === accountId &&
                    entry.valueDate <= valueDay &&
                    entry.bookedDay <= bookedDay &&
                    entry.type !== "OVERDRAFT_FEE" &&
                    entry.type !== "FEE_REFUND"
                ) {
                    balance += entry.amount;
                }
            }

            const shouldCharge = balance < 0n;

            // Determine the net fee already assessed for this day.
            let existingFee = 0n;

            for (const entry of this.entries) {
                if (
                    entry.accountId === accountId &&
                    entry.valueDate === valueDay &&
                    (entry.type === "OVERDRAFT_FEE" ||
                        entry.type === "FEE_REFUND")
                ) {
                    existingFee += entry.amount;
                }
            }

            const expectedFee = shouldCharge ? -feeAmount : 0n;
            const adjustment = expectedFee - existingFee;

            // No change needed.
            if (adjustment === 0n) {
                continue;
            }

            this.feeSequence++;

            const entry: LedgerEntry = {
                id: `fee-${this.feeSequence}`,
                eventId: `internal-fee-${this.feeSequence}`,
                accountId,
                type:
                    adjustment < 0n
                        ? "OVERDRAFT_FEE"
                        : "FEE_REFUND",
                amount: adjustment,
                bookedDay,
                valueDate: valueDay,
            };

            this.entries.push(Object.freeze({ ...entry }));
        }
    }

    calculateInterest(
        accountId: AccountId,
    ): {
        day: Day;
        closingBalance: bigint;
        interestNumerator: bigint;
    }[] {
        const account = this.accounts.get(accountId);

        if (!account) {
            throw new Error("Account not found");
        }

        const results: {
            day: Day;
            closingBalance: bigint;
            interestNumerator: bigint;
        }[] = [];

        for (let day = 1; day <= 6; day++) {
            const valueDay = day as Day;
            const closingBalance = this.getBalance(accountId, valueDay);

            // 0.04% = 4 / 10000.
            // Keep the numerator to avoid daily rounding loss.
            const interestNumerator =
                closingBalance > 0n ? closingBalance * 4n : 0n;

            results.push({
                day: valueDay,
                closingBalance,
                interestNumerator,
            });
        }

        return results;
    }


    capitalizeInterest(accountId: AccountId): bigint {
        const account = this.accounts.get(accountId);

        if (!account) {
            throw new Error("Account not found");
        }

        // Prevent capitalization from being posted twice.
        for (const entry of this.entries) {
            if (
                entry.accountId === accountId &&
                entry.type === "INTEREST"
            ) {
                throw new Error("Interest already capitalized");
            }
        }

        const dailyInterest = this.calculateInterest(accountId);

        let totalNumerator = 0n;

        for (const day of dailyInterest) {
            totalNumerator += day.interestNumerator;
        }

        // Round half-up once, after accumulating all six days.
        const totalInterest =
            (totalNumerator + 5000n) / 10000n;

        if (totalInterest === 0n) {
            return 0n;
        }

        const entry: LedgerEntry = {
            id: `interest-${accountId}`,
            eventId: `internal-interest-${accountId}`,
            accountId,
            type: "INTEREST",
            amount: totalInterest,
            bookedDay: 6,
            valueDate: 6,
        };

        this.entries.push(Object.freeze({ ...entry }));

        return totalInterest;
    }




    public process(event: LedgerEvent): ProcessingResult {
        // Validate event ID
        if (this.eventIds.has(event.id)) {
            return {
                eventId: event.id,
                accepted: false,
                message: `Duplicate event ID: ${event.id}`,
            };
        }

        // Validate account
        if (!this.accounts.has(event.accountId)) {
            return {
                eventId: event.id,
                accepted: false,
                message: `Unknown account: ${event.accountId}`,
            };
        }

        // Reversals do not have an amount
        if (event.type !== "REVERSAL" && event.amount <= 0n) {
            return {
                eventId: event.id,
                accepted: false,
                message: "Amount must be positive",
            };
        }

        // AUTHORIZATION
        if (event.type === "AUTHORIZATION") {
            if (this.authorizations.has(event.authorizationId)) {
                return {
                    eventId: event.id,
                    accepted: false,
                    message: `Duplicate authorization ID: ${event.authorizationId}`,
                };
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

            this.events.push(Object.freeze({ ...event }));
            this.eventIds.add(event.id);

            return {
                eventId: event.id,
                accepted: true,
                message: `Authorization ${status.toLowerCase()}`,
            };
        }

        // SETTLEMENT
        if (event.type === "SETTLEMENT") {
            const authorization = this.authorizations.get(
                event.authorizationId,
            );

            if (!authorization) {
                return {
                    eventId: event.id,
                    accepted: false,
                    message: `Unknown authorization: ${event.authorizationId}`,
                };
            }

            if (authorization.accountId !== event.accountId) {
                return {
                    eventId: event.id,
                    accepted: false,
                    message: "Authorization account mismatch",
                };
            }

            if (authorization.status !== "APPROVED") {
                return {
                    eventId: event.id,
                    accepted: false,
                    message: "Authorization is not active",
                };
            }

            if (event.amount > authorization.amount) {
                return {
                    eventId: event.id,
                    accepted: false,
                    message: "Settlement exceeds authorized amount",
                };
            }

            const entry: LedgerEntry = {
                id: `entry-${event.id}`,
                eventId: event.id,
                accountId: event.accountId,
                type: "SETTLEMENT",
                amount: -event.amount,
                bookedDay: event.bookedDay,
                valueDate: event.valueDate,
            };

            this.events.push(Object.freeze({ ...event }));
            this.entries.push(Object.freeze({ ...entry }));
            this.eventIds.add(event.id);

            this.authorizations.set(
                event.authorizationId,
                Object.freeze({
                    ...authorization,
                    status: "SETTLED",
                    settlementAmount: event.amount,
                }),
            );

            return {
                eventId: event.id,
                accepted: true,
                message: `Settlement completed for ${event.authorizationId}`,
            };
        }

        // REVERSAL
        if (event.type === "REVERSAL") {
            let originalEntry: LedgerEntry | undefined;

            // Find the original financial entry
            for (const entry of this.entries) {
                if (entry.eventId === event.originalEventId) {
                    originalEntry = entry;
                    break;
                }
            }

            if (!originalEntry) {
                return {
                    eventId: event.id,
                    accepted: false,
                    message: `Original entry not found: ${event.originalEventId}`,
                };
            }

            if (originalEntry.accountId !== event.accountId) {
                return {
                    eventId: event.id,
                    accepted: false,
                    message: "Reversal account mismatch",
                };
            }

            if (originalEntry.type === "REVERSAL") {
                return {
                    eventId: event.id,
                    accepted: false,
                    message: "Cannot reverse a reversal",
                };
            }

            // Prevent reversing the same transaction twice
            for (const previousEvent of this.events) {
                if (
                    previousEvent.type === "REVERSAL" &&
                    previousEvent.originalEventId === event.originalEventId
                ) {
                    return {
                        eventId: event.id,
                        accepted: false,
                        message: "Original entry already reversed",
                    };
                }
            }

            // Preserve the original value date
            if (event.valueDate !== originalEntry.valueDate) {
                return {
                    eventId: event.id,
                    accepted: false,
                    message: "Reversal must use original value date",
                };
            }

            // Create a compensating entry
            const reversalEntry: LedgerEntry = {
                id: `entry-${event.id}`,
                eventId: event.id,
                accountId: event.accountId,
                type: "REVERSAL",
                amount: -originalEntry.amount,
                bookedDay: event.bookedDay,
                valueDate: event.valueDate,
            };

            this.events.push(Object.freeze({ ...event }));
            this.entries.push(Object.freeze({ ...reversalEntry }));
            this.eventIds.add(event.id);

            return {
                eventId: event.id,
                accepted: true,
                message: `Reversed ${event.originalEventId}`,
            };
        }

        // CREDIT / DEBIT
        // These are the only remaining event types.
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

        this.events.push(Object.freeze({ ...event }));
        this.entries.push(Object.freeze({ ...entry }));
        this.eventIds.add(event.id);

        return {
            eventId: event.id,
            accepted: true,
            message: `${event.type} posted successfully`,
        };
    }


}
