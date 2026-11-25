import type { Debt, MemberBalance } from './balance';

// The first of the balances that scores highest above zero, if any
const highest = (balances: readonly MemberBalance[], score: (cents: number) => number): MemberBalance | undefined => {
    return balances.reduce<MemberBalance | undefined>(
        (best, balance) => (score(balance.cents) > (best ? score(best.cents) : 0) ? balance : best),
        undefined
    );
};

// The balances, in the group's order, as payments: the member who owes most pays the one owed most the smaller of the
// two amounts, until all are zero. A tie goes to the first in the order, so every device gets the same payments. Nobody
// both pays and receives, and there is at least one payment fewer than members with a balance.
const simplifyDebts = (balances: readonly MemberBalance[]): Debt[] => {
    const left = balances.map((balance) => ({ ...balance }));
    const payments: Debt[] = [];

    for (;;) {
        const debtor = highest(left, (cents) => -cents);
        const creditor = highest(left, (cents) => cents);
        if (!debtor || !creditor) return payments;
        const cents = Math.min(-debtor.cents, creditor.cents);
        payments.push({ from: debtor.memberId, to: creditor.memberId, cents });
        debtor.cents += cents;
        creditor.cents -= cents;
    }
};

export { simplifyDebts };
