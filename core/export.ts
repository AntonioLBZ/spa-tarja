import { countedCents, paymentOf } from './counting';
import { toDateString } from './date';
import { formatAmountInput } from './money';
import { isSharedRow } from './shared-expense';

import type { Budget } from './budget';
import type { Category } from './category';
import type { Expense, Payment } from './expense';
import type { Income } from './income';
import type { LedgerEntry, Share, SplitMode } from './shared-entry';
import type { GroupClosed, GroupKind, GroupMember, SharedGroup } from './shared-group';

const BACKUP_APP = 'tarja';
const BACKUP_VERSION = 1;

// What a spreadsheet reads as a byte order mark: the file is UTF-8
const BOM = '﻿';

// What a spreadsheet would run as a formula if a cell started with it
const FORMULA_START = /^[=+\-@\t\r]/;

// A group or friend the device holds, with its entries as the person sees them
interface BackupLedger {
    group: SharedGroup;
    entries: readonly LedgerEntry[];
}

interface BackupData {
    // The person's own: never their part of a shared expense, which is derived
    expenses: readonly Expense[];
    // The custom categories only: the built-in ones come with the app
    categories: readonly Category[];
    income: readonly Income[];
    budgets: readonly Budget[];
    groups: readonly BackupLedger[];
}

// An entry of a group as stored, field by field: who made it and who wrote it last are members, never users
interface BackupEntry {
    id: string;
    kind: LedgerEntry['kind'];
    text: string;
    categoryId: string | null;
    amountCents: number;
    currency: string;
    date: string;
    paidBy: string;
    split: SplitMode;
    shares: Share[];
    payment: Payment;
    chargeDate: string | null;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
    createdBy: string | null;
    updatedBy: string | null;
}

interface BackupGroup {
    id: string;
    kind: GroupKind;
    name: string | null;
    currency: string;
    simplifyDebts: boolean;
    closed: GroupClosed | null;
    archived: boolean;
    showInExpenses: boolean;
    // The member of the person
    me: string;
    members: GroupMember[];
    entries: BackupEntry[];
}

interface Backup {
    app: typeof BACKUP_APP;
    version: typeof BACKUP_VERSION;
    exportedAt: string;
    expenses: Expense[];
    categories: Category[];
    income: Income[];
    budgets: Budget[];
    groups: BackupGroup[];
}

// The words of the file, in the language of the app. The names of the categories come from outside because the built-in
// ones are translated by the app.
interface CsvLabels {
    // Date, text, category, amount, currency, payment, charge date, your part, part and group
    columns: readonly string[];
    payments: Record<Payment, string>;
    categoryName: (categoryId: string) => string;
    // What the screens call a group or a friend
    groupName: (groupId: string) => string;
}

const compare = (a: string | number, b: string | number): number => {
    return a < b ? -1 : a > b ? 1 : 0;
};

// The expenses that are listed, the deleted ones left out, by the day made, when created, the part and the id
const listed = (expenses: readonly Expense[]): Expense[] => {
    return expenses
        .filter((expense) => expense.deletedAt === null)
        .toSorted(
            (a, b) =>
                compare(a.date, b.date) ||
                compare(a.createdAt, b.createdAt) ||
                compare(a.plan?.part ?? 0, b.plan?.part ?? 0) ||
                compare(a.id, b.id)
        );
};

// A group or friend with its people and its live entries by the day made, then when created and the id. Each field is
// named, so no user id or email can reach the file.
const backupGroup = ({ group, entries }: BackupLedger): BackupGroup => {
    return {
        id: group.id,
        kind: group.kind,
        name: group.name,
        currency: group.currency,
        simplifyDebts: group.simplifyDebts,
        closed: group.closed,
        archived: group.archived,
        showInExpenses: group.showInExpenses,
        me: group.me,
        members: group.members.map(({ id, name, role, claimed, leftAt, mergedInto }) => {
            return { id, name, role, claimed, leftAt, mergedInto };
        }),
        entries: entries
            .filter((entry) => entry.deletedAt === null)
            .toSorted((a, b) => compare(a.date, b.date) || compare(a.createdAt, b.createdAt) || compare(a.id, b.id))
            .map((entry) => ({
                id: entry.id,
                kind: entry.kind,
                text: entry.text,
                categoryId: entry.categoryId,
                amountCents: entry.amountCents,
                currency: entry.currency,
                date: entry.date,
                paidBy: entry.paidBy,
                split: entry.split,
                shares: entry.shares.map(({ memberId, cents }) => ({ memberId, cents })),
                payment: entry.payment,
                chargeDate: entry.chargeDate,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt,
                deletedAt: entry.deletedAt,
                createdBy: entry.createdBy,
                updatedBy: entry.updatedBy,
            })),
    };
};

// Everything the person keeps, as it is stored and nothing derived, so that it can be restored from it (ADR-0001)
const buildBackup = (data: BackupData, now: Date): Backup => {
    return {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: now.toISOString(),
        expenses: listed(data.expenses.filter((expense) => !isSharedRow(expense))),
        categories: [...data.categories],
        income: data.income.toSorted((a, b) => compare(a.month, b.month)),
        budgets: data.budgets.toSorted((a, b) => compare(a.month, b.month) || compare(a.scope, b.scope)),
        groups: data.groups.map(backupGroup),
    };
};

const backupJson = (data: BackupData, now: Date): string => {
    return `${JSON.stringify(buildBackup(data, now), null, 2)}\n`;
};

// Where a language puts its decimal mark; its columns are told apart by the other one so the two never meet
const decimalMarkOf = (locale: string): string => {
    return new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
};

const delimiterOf = (locale: string): string => {
    return decimalMarkOf(locale) === ',' ? ';' : ',';
};

// A leading apostrophe makes a spreadsheet read the cell as text, never as a formula
const inert = (text: string): string => {
    return FORMULA_START.test(text) ? `'${text}` : text;
};

const quoted = (field: string, delimiter: string): string => {
    return field.includes(delimiter) || /["\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
};

// One row for each expense, and for each part of a plan, with the amounts and the delimiter of the language. A shared
// row says the total that was paid, your part of it and its group.
const expensesCsv = (expenses: readonly Expense[], locale: string, labels: CsvLabels): string => {
    const delimiter = delimiterOf(locale);
    const line = (fields: readonly string[]) => fields.map((field) => quoted(field, delimiter)).join(delimiter);

    const rows = listed(expenses).map((expense) => {
        const payment = paymentOf(expense);
        const shared = isSharedRow(expense) ? expense.shared : null;
        return line([
            expense.date,
            inert(expense.text),
            inert(labels.categoryName(expense.categoryId)),
            formatAmountInput(shared?.totalCents ?? expense.amountCents, locale),
            expense.currency,
            labels.payments[payment],
            expense.chargeDate ?? '',
            shared || payment === 'voucher' ? formatAmountInput(countedCents(expense), locale) : '',
            expense.plan ? `${expense.plan.part}/${expense.plan.parts}` : '',
            shared ? inert(labels.groupName(shared.groupId)) : '',
        ]);
    });

    return `${BOM}${[line(labels.columns), ...rows].join('\r\n')}\r\n`;
};

// The name of the file, with the day of the device
const exportFileName = (now: Date, extension: 'json' | 'csv'): string => {
    return `tarja-${toDateString(now)}.${extension}`;
};

export {
    backupJson,
    buildBackup,
    expensesCsv,
    exportFileName,
    type Backup,
    type BackupData,
    type BackupLedger,
    type CsvLabels,
};
