
export function splitAmount(
    total: bigint,
    parts: number,
): bigint[] {
    if (total <= 0n) {
        throw new Error("Total must be positive");
    }

    if (!Number.isSafeInteger(parts) || parts <= 0) {
        throw new Error("Parts must be a positive integer");
    }

    const count = BigInt(parts);
    const base = total / count;
    let remainder = total % count;

    const amounts: bigint[] = [];

    for (let i = 0; i < parts; i++) {
        let amount = base;

        if (remainder > 0n) {
            amount += 1n;
            remainder -= 1n;
        }

        amounts.push(amount);
    }

    return amounts;
}
