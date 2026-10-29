import { countedCents, paymentOf } from './counting';
import { toDateString } from './date';
import { formatAmountInput } from './money';

import type { Budget } from './budget';
import type { Category } from './category';
import type { Expense, Payment } from './expense';
import type { Income } from './income';

const BACKUP_APP = 'tarja';
const BACKUP_VERSION = 1;

// What a spreadsheet reads as a byte order mark: the file is UTF-8
const BOM = '﻿';

// What a spreadsheet would run as a formula if a cell started with it
const FORMULA_START = /^[=+\-@\t\r]/;

interface BackupData {
    expenses: readonly Expense[];
    // The custom categories only: the built-in ones come with the app
    categories: readonly Category[];
    income: readonly Income[];
    budgets: readonly Budget[];
}

interface Backup {
    app: typeof BACKUP_APP;
    version: typeof BACKUP_VERSION;
    exportedAt: string;
    expenses: Expense[];
    categories: Category[];
    income: Income[];
    budgets: Budget[];
}

// The words of the file, in the language of the app. The names of the categories come from outside because the built-in
// ones are translated by the app.
interface CsvLabels {
    // Date, text, category, amount, currency, payment, charge date, your part and part
    columns: readonly string[];
    payments: Record<Payment, string>;
    categoryName: (categoryId: string) => string;
}

function compare(a: string | number, b: string | number): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

// The expenses that are listed, the deleted ones left out, by the day made, when created, the part and the id
function listed(expenses: readonly Expense[]): Expense[] {
    return expenses
        .filter((expense) => expense.deletedAt === null)
        .toSorted(
            (a, b) =>
                compare(a.date, b.date) ||
                compare(a.createdAt, b.createdAt) ||
                compare(a.plan?.part ?? 0, b.plan?.part ?? 0) ||
                compare(a.id, b.id)
        );
}

// Everything the person keeps, as it is stored and nothing derived, so that it can be restored from it (ADR-0001)
function buildBackup(data: BackupData, now: Date): Backup {
    return {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: now.toISOString(),
        expenses: listed(data.expenses),
        categories: [...data.categories],
        income: data.income.toSorted((a, b) => compare(a.month, b.month)),
        budgets: data.budgets.toSorted((a, b) => compare(a.month, b.month) || compare(a.scope, b.scope)),
    };
}

function backupJson(data: BackupData, now: Date): string {
    return `${JSON.stringify(buildBackup(data, now), null, 2)}\n`;
}

// Where a language puts its decimal mark; its columns are told apart by the other one so the two never meet
function decimalMarkOf(locale: string): string {
    return new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
}

function delimiterOf(locale: string): string {
    return decimalMarkOf(locale) === ',' ? ';' : ',';
}

// A leading apostrophe makes a spreadsheet read the cell as text, never as a formula
function inert(text: string): string {
    return FORMULA_START.test(text) ? `'${text}` : text;
}

function quoted(field: string, delimiter: string): string {
    return field.includes(delimiter) || /["\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

// One row for each expense, and for each part of a plan, with the amounts and the delimiter of the language
function expensesCsv(expenses: readonly Expense[], locale: string, labels: CsvLabels): string {
    const delimiter = delimiterOf(locale);
    const line = (fields: readonly string[]) => fields.map((field) => quoted(field, delimiter)).join(delimiter);

    const rows = listed(expenses).map((expense) => {
        const payment = paymentOf(expense);
        return line([
            expense.date,
            inert(expense.text),
            inert(labels.categoryName(expense.categoryId)),
            formatAmountInput(expense.amountCents, locale),
            expense.currency,
            labels.payments[payment],
            expense.chargeDate ?? '',
            payment === 'voucher' ? formatAmountInput(countedCents(expense), locale) : '',
            expense.plan ? `${expense.plan.part}/${expense.plan.parts}` : '',
        ]);
    });

    return `${BOM}${[line(labels.columns), ...rows].join('\r\n')}\r\n`;
}

// The name of the file, with the day of the device
function exportFileName(now: Date, extension: 'json' | 'csv'): string {
    return `tarja-${toDateString(now)}.${extension}`;
}

export { backupJson, buildBackup, expensesCsv, exportFileName };
export type { Backup, BackupData, CsvLabels };
