
export type Currency = "AED" | "BHD";

export type Day = 1 | 2 | 3 | 4 | 5 | 6;

export type AccountId = "ACC-001" | "ACC-002";

export interface Account {
    id: AccountId;
    currency: Currency;
    openingBalance: bigint;
}

export type EventType = "CREDIT" | "DEBIT";

export interface LedgerEvent {
    id: string;
    type: EventType;
    accountId: AccountId;
    amount: bigint;

    bookedDay: Day; // When the bank records the event.
    valueDate: Day; // When it financially takes effect.
}

export interface LedgerEntry {
    id: string;
    eventId: string;
    accountId: AccountId;
    type: EventType;
    amount: bigint; // Signed amount in minor units.
    bookedDay: Day;
    valueDate: Day;
}
