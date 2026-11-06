import { planBalance, splitEvenly } from './installments';
import { MAX_AMOUNT_CENTS } from './money';
import { shuffled } from './shuffle';

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

// The turn of each position to get a unit left over, 0 being the first: set by the seed, so a split can be shown and
// saved as the same
const turnsOf = (count: number, seed: number): number[] => {
    return shuffled(
        Array.from({ length: count }, (_, index) => index),
        seed
    );
};

// A whole in parts as even as they can be, in the order of the positions: the units left go one at a time to the
// positions whose turn comes first
const spreadEvenly = (whole: number, count: number, seed: number): number[] => {
    const evenly = splitEvenly(whole, count);
    return turnsOf(count, seed).map((turn) => evenly[turn] ?? 0);
};

// A whole shared out by weights: each part rounded down, and the units left one at a time to the biggest fractions, a
// tie going to the position whose turn comes first
const largestRemainder = (
    whole: number,
    weights: readonly number[],
    weightTotal: number,
    turns: readonly number[]
): number[] => {
    const fractions = weights.map((weight) => (whole * weight) % weightTotal);
    const parts = weights.map((weight, index) => (whole * weight - fractions[index]!) / weightTotal);
    const left = whole - sumOf(parts);
    const extra = new Set(
        fractions
            .map((fraction, index) => ({ fraction, index }))
            .sort((a, b) => b.fraction - a.fraction || turns[a.index]! - turns[b.index]!)
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

// Whole cents an entry can hold, which also keeps the percent maths below the largest safe integer
const isAmount = (cents: number): boolean => {
    return Number.isInteger(cents) && cents >= 0 && cents <= MAX_AMOUNT_CENTS;
};

const isPercent = (basisPoints: number): boolean => {
    return Number.isInteger(basisPoints) && basisPoints >= 0 && basisPoints <= HUNDRED_PERCENT;
};

// Equally among the members who are in, in the group's order: the cents left go one at a time to members the 32-bit
// seed picks, the same ones for the same seed. None when nobody is in. Every split is none for an amount that isn't
// whole cents from 0 to the maximum.
const splitEqually = (amountCents: number, memberIds: readonly string[], seed: number): Share[] | null => {
    if (!isAmount(amountCents) || memberIds.length === 0) return null;
    return sharesOf(memberIds, spreadEvenly(amountCents, memberIds.length, seed));
};

// By the percentage of each member, in the group's order, a cent left going to the biggest fraction and, when two tie,
// to the member the seed puts first. None unless each is 0 to 100 % and they add up to 100 %.
const splitByPercent = (amountCents: number, percents: readonly MemberPercent[], seed: number): Share[] | null => {
    const basisPoints = percents.map((percent) => percent.basisPoints);
    if (!isAmount(amountCents) || !basisPoints.every(isPercent) || sumOf(basisPoints) !== HUNDRED_PERCENT) return null;
    return sharesOf(
        percents.map((percent) => percent.memberId),
        largestRemainder(amountCents, basisPoints, HUNDRED_PERCENT, turnsOf(percents.length, seed))
    );
};

// By the amount typed for each member. None unless each is whole cents, none negative, and they add up to the amount.
const splitExactly = (amountCents: number, parts: readonly Share[]): Share[] | null => {
    const valid = parts.every((part) => Number.isInteger(part.cents) && part.cents >= 0);
    if (!isAmount(amountCents) || !valid || unassignedCents(amountCents, parts) !== 0) return null;
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

// Where the percent mode starts: 100 % split evenly, the hundredths left going to the members the seed picks, the same
// order as the cents of an equal split
const equalPercents = (memberIds: readonly string[], seed: number): MemberPercent[] => {
    const basisPoints = spreadEvenly(HUNDRED_PERCENT, memberIds.length, seed);
    return memberIds.map((memberId, index) => ({ memberId, basisPoints: basisPoints[index] ?? 0 }));
};

// What an entry split by percent reopens with: each share over the amount, rounded as the parts are, so they add up to
// 100 %. The shares are those of an entry, which add up to the amount.
const percentsOf = (amountCents: number, shares: readonly Share[]): MemberPercent[] => {
    const basisPoints = largestRemainder(
        HUNDRED_PERCENT,
        shares.map((share) => share.cents),
        amountCents,
        shares.map((_, index) => index)
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
