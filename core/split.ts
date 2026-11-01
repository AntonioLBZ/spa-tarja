import { planBalance, splitEvenly } from './installments';

import type { Share } from './shared-entry';

// 100 % in basis points, hundredths of a percent: a percentage takes up to two decimals
const HUNDRED_PERCENT = 10_000;

interface MemberPercent {
    memberId: string;
    basisPoints: number;
}

const sumOf = (values: readonly number[]): number => {
    return values.reduce((sum, value) => sum + value, 0);
};

// A whole shared out by weights: each part rounded down, and the units left one at a time to the biggest fractions, a
// tie going to the first
const largestRemainder = (whole: number, weights: readonly number[], weightTotal: number): number[] => {
    const fractions = weights.map((weight) => (whole * weight) % weightTotal);
    const parts = weights.map((weight, index) => (whole * weight - fractions[index]!) / weightTotal);
    const left = whole - sumOf(parts);
    const extra = new Set(
        fractions
            .map((fraction, index) => ({ fraction, index }))
            .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
            .slice(0, left)
            .map(({ index }) => index)
    );
    return parts.map((part, index) => part + (extra.has(index) ? 1 : 0));
};

// The shares of the members in the order given; a member whose part is nothing is out
const sharesOf = (memberIds: readonly string[], cents: readonly number[]): Share[] => {
    return memberIds
        .map((memberId, index) => ({ memberId, cents: cents[index] ?? 0 }))
        .filter((share) => share.cents > 0);
};

const isPercent = (basisPoints: number): boolean => {
    return Number.isInteger(basisPoints) && basisPoints >= 0 && basisPoints <= HUNDRED_PERCENT;
};

// Equally among the members who are in, in the group's order: the cents left go one at a time to the first ones
const splitEqually = (amountCents: number, memberIds: readonly string[]): Share[] => {
    return sharesOf(memberIds, splitEvenly(amountCents, memberIds.length));
};

// By the percentage of each member, in the group's order. None unless each is 0 to 100 % and they add up to 100 %.
const splitByPercent = (amountCents: number, percents: readonly MemberPercent[]): Share[] | null => {
    const basisPoints = percents.map((percent) => percent.basisPoints);
    if (!basisPoints.every(isPercent) || sumOf(basisPoints) !== HUNDRED_PERCENT) return null;
    return sharesOf(
        percents.map((percent) => percent.memberId),
        largestRemainder(amountCents, basisPoints, HUNDRED_PERCENT)
    );
};

// By the amount typed for each member. None unless each is whole cents, none negative, and they add up to the amount.
const splitExactly = (amountCents: number, parts: readonly Share[]): Share[] | null => {
    const valid = parts.every((part) => Number.isInteger(part.cents) && part.cents >= 0);
    if (!valid || unassignedCents(amountCents, parts) !== 0) return null;
    return parts.filter((part) => part.cents > 0);
};

// What is left to assign of the amount; negative when the parts go over it
const unassignedCents = (amountCents: number, parts: readonly Share[]): number => {
    return planBalance(
        amountCents,
        parts.map((part) => part.cents)
    );
};

// What is left to reach 100 %, in basis points; negative when the percentages go over it
const percentLeft = (percents: readonly MemberPercent[]): number => {
    return HUNDRED_PERCENT - sumOf(percents.map((percent) => percent.basisPoints));
};

// Where the percent mode starts: 100 % split evenly, the hundredths left going to the first ones
const equalPercents = (memberIds: readonly string[]): MemberPercent[] => {
    const basisPoints = splitEvenly(HUNDRED_PERCENT, memberIds.length);
    return memberIds.map((memberId, index) => ({ memberId, basisPoints: basisPoints[index] ?? 0 }));
};

// What an entry split by percent reopens with: each share over the amount, rounded as the parts are, so they add up to
// 100 %. The shares are those of an entry, which add up to the amount.
const percentsOf = (amountCents: number, shares: readonly Share[]): MemberPercent[] => {
    const basisPoints = largestRemainder(
        HUNDRED_PERCENT,
        shares.map((share) => share.cents),
        amountCents
    );
    return shares.map((share, index) => ({ memberId: share.memberId, basisPoints: basisPoints[index] ?? 0 }));
};

export {
    HUNDRED_PERCENT,
    equalPercents,
    percentLeft,
    percentsOf,
    splitByPercent,
    splitEqually,
    splitExactly,
    unassignedCents,
    type MemberPercent,
};
