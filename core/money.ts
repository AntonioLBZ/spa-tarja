const DEFAULT_CURRENCY = 'EUR';

// Nine integer digits keep the amount in cents far below Number.MAX_SAFE_INTEGER
const MAX_INTEGER_DIGITS = 9;

const MAX_AMOUNT_CENTS = 10 ** (MAX_INTEGER_DIGITS + 2) - 1;

const GROUPED_INTEGER = /^\d{1,3}([.,])\d{3}(\1\d{3})*$/;

function decimalSeparatorOf(locale: string): string {
    return new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
}

// Reads what a person types as an amount and returns cents, or null when it isn't a valid one
function parseAmount(input: string, locale: string): number | null {
    const text = input.replace(/[\s€]/g, '');
    if (!/^\d[\d.,]*$/.test(text)) return null;

    const lastDot = text.lastIndexOf('.');
    const lastComma = text.lastIndexOf(',');
    let decimalAt = -1;

    if (lastDot >= 0 && lastComma >= 0) {
        decimalAt = Math.max(lastDot, lastComma);
    } else if (lastDot >= 0 || lastComma >= 0) {
        const separator = lastDot >= 0 ? '.' : ',';
        const last = Math.max(lastDot, lastComma);
        const occurrences = text.split(separator).length - 1;
        const digitsAfter = text.length - last - 1;
        const looksLikeThousands = digitsAfter === 3 && separator !== decimalSeparatorOf(locale);
        if (occurrences === 1 && !looksLikeThousands) decimalAt = last;
    }

    const integerText = decimalAt < 0 ? text : text.slice(0, decimalAt);
    const fraction = decimalAt < 0 ? '' : text.slice(decimalAt + 1);

    if (!/^\d{0,2}$/.test(fraction)) return null;
    if (!/^\d+$/.test(integerText) && !GROUPED_INTEGER.test(integerText)) return null;

    const integerDigits = integerText.replace(/[.,]/g, '');
    if (integerDigits.length > MAX_INTEGER_DIGITS) return null;

    return Number(integerDigits) * 100 + Number(fraction.padEnd(2, '0'));
}

function formatAmount(cents: number, currency: string, locale: string): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

// Cents as text for an amount field: what parseAmount reads back, so no grouping and no currency
function formatAmountInput(cents: number, locale: string): string {
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
    }).format(cents / 100);
}

export { DEFAULT_CURRENCY, MAX_AMOUNT_CENTS, formatAmount, formatAmountInput, parseAmount };
