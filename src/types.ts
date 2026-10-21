
export type Currency = "AED" | "BHD";

export type Day = 1 | 2 | 3 | 4 | 5 | 6;

export type AccountId = "ACC-001" | "ACC-002";

export interface Account {
    id: AccountId;
    currency: Currency;
    openingBalance: bigint;
}

export type EventType = "CREDIT" | "DEBIT" | "AUTHORIZATION" | "SETTLEMENT" | "REVERSAL";

export interface BaseEvent {
    id: string;
    accountId: AccountId;
    bookedDay: Day;
    valueDate: Day;
}

export interface CreditEvent extends BaseEvent {
    type: "CREDIT";
    amount: bigint;
}

export interface DebitEvent extends BaseEvent {
    type: "DEBIT";
    amount: bigint;
}

// Authorization Event
export interface AuthorizationEvent extends BaseEvent {
    type: "AUTHORIZATION";
    authorizationId: string;
    amount: bigint;
}

// Settlement Event
export interface SettlementEvent extends BaseEvent {
    type: "SETTLEMENT";
    authorizationId: string;
    amount: bigint;
}

// Reversal Event
export interface ReversalEvent extends BaseEvent {
    type: "REVERSAL";
    originalEventId: string;
}

export type LedgerEvent =
    | CreditEvent
    | DebitEvent
    | AuthorizationEvent
    | SettlementEvent
    | ReversalEvent;

export interface LedgerEntry {
    id: string;
    eventId: string;
    accountId: AccountId;
    type: EventType;
    amount: bigint; // Signed amount in minor units.
    bookedDay: Day;
    valueDate: Day;
}

// Authorization Types
export type AuthorizationStatus = "APPROVED" | "DECLINED" | "SETTLED";

export interface AuthorizationState {
    authorizationId: string;
    accountId: AccountId;
    amount: bigint;
    status: AuthorizationStatus;
    settlementAmount?: bigint;
}

export interface ProcessingResult {
    eventId: string;
    accepted: boolean;
    message: string;
}