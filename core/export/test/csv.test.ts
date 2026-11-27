import { describe, expect, it } from 'vitest';

import { expensesCsv, groupCsv, groupFileName, type BackupLedger, type GroupCsvLabels } from '@core/export/export';
import { groupTable } from '@core/export/group-table';
import {
    BOM,
    DANI_ID,
    dinner,
    expense,
    group,
    GYM,
    LABELS,
    LABELS_ES,
    ledger,
    member,
    partsOf,
    rows,
    settlement,
} from '@core/testing/export';

import type { LedgerEntry } from '@core/groups/shared-entry';

describe('expensesCsv', () => {
    it('starts with a byte order mark, so a spreadsheet reads the accents', () => {
        expect(expensesCsv([], 'en', LABELS).startsWith(BOM)).toBe(true);
    });

    it('is just the header when there is nothing to list', () => {
        expect(rows(expensesCsv([], 'en', LABELS))).toEqual([
            'Date,Text,Category,Amount,Currency,Payment,Charge date,Your part,Part,Group',
            '',
        ]);
    });

    it('has a row for each expense, in English with commas and a decimal point', () => {
        const csv = expensesCsv([expense({ text: 'Lunch', date: '2026-10-24', amountCents: 1250 })], 'en', LABELS);

        expect(rows(csv)).toEqual([
            'Date,Text,Category,Amount,Currency,Payment,Charge date,Your part,Part,Group',
            '2026-10-24,Lunch,Food,12.50,EUR,Now,,,,',
            '',
        ]);
    });

    it('uses semicolons and a decimal comma in Spanish, with the header and the names in Spanish', () => {
        const csv = expensesCsv([expense({ text: 'Almuerzo', amountCents: 1250 })], 'es', LABELS_ES);

        expect(rows(csv)).toEqual([
            'Fecha;Texto;Categoría;Importe;Moneda;Pago;Fecha de cargo;Tu parte;Parte;Grupo',
            '2026-10-24;Almuerzo;Comida;12,50;EUR;Ahora;;;;',
            '',
        ]);
    });

    it('writes no thousands separator, and the cents of a small amount', () => {
        const csv = expensesCsv(
            [expense({ amountCents: 123_456_78, createdAt: 1 }), expense({ amountCents: 5, createdAt: 2 })],
            'en',
            LABELS
        );

        expect(
            rows(csv)
                .slice(1, 3)
                .map((line) => line.split(',')[3])
        ).toEqual(['123456.78', '0.05']);
    });

    it('names the category the way the labels do, the fallback for one that no longer exists', () => {
        const csv = expensesCsv(
            [
                expense({ categoryId: GYM.id, text: 'Month', createdAt: 1 }),
                expense({ categoryId: crypto.randomUUID(), text: 'Lost', createdAt: 2 }),
            ],
            'en',
            LABELS
        );

        expect(
            rows(csv)
                .slice(1, 3)
                .map((line) => line.split(',')[2])
        ).toEqual(['Gym', 'Other']);
    });

    it('says how a card payment was paid, and the day it is charged', () => {
        const csv = expensesCsv(
            [expense({ text: 'Shoes', payment: 'credit', chargeDate: '2026-11-02', amountCents: 8000 })],
            'en',
            LABELS
        );

        expect(rows(csv)[1]).toBe('2026-10-24,Shoes,Food,80.00,EUR,Credit card,2026-11-02,,,');
    });

    it('gives your part of a restaurant card expense, the whole amount when none was set', () => {
        const csv = expensesCsv(
            [
                expense({
                    text: 'Dinner',
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                    amountCents: 4000,
                    personalCents: 2050,
                    createdAt: 1,
                }),
                expense({
                    text: 'Menu',
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                    amountCents: 1100,
                    createdAt: 2,
                }),
                expense({
                    text: 'Nothing',
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                    amountCents: 900,
                    personalCents: 0,
                    createdAt: 3,
                }),
            ],
            'en',
            LABELS
        );

        expect(rows(csv).slice(1, 4)).toEqual([
            '2026-10-24,Dinner,Food,40.00,EUR,Restaurant card,2026-11-12,20.50,,',
            '2026-10-24,Menu,Food,11.00,EUR,Restaurant card,2026-11-12,11.00,,',
            '2026-10-24,Nothing,Food,9.00,EUR,Restaurant card,2026-11-12,0.00,,',
        ]);
    });

    it('leaves your part empty for what is not a restaurant card expense', () => {
        const csv = expensesCsv([expense({ payment: undefined, personalCents: undefined })], 'en', LABELS);

        expect(rows(csv)[1]!.split(',').slice(5)).toEqual(['Now', '', '', '', '']);
    });

    it('numbers the parts of a plan, a row for each, in the order of the plan', () => {
        const plan = { id: crypto.randomUUID(), parts: 3 };
        const charges = ['2026-10-01', '2026-11-01', '2026-12-01'];
        const parts = [2, 3, 1].map((part) =>
            expense({
                text: 'Sofa',
                plan: { ...plan, part },
                date: '2026-10-01',
                chargeDate: charges[part - 1],
                amountCents: 500 * part,
            })
        );

        const csv = expensesCsv(parts, 'en', LABELS);

        expect(rows(csv).slice(1, 4)).toEqual([
            '2026-10-01,Sofa,Food,5.00,EUR,Now,2026-10-01,,1/3,',
            '2026-10-01,Sofa,Food,10.00,EUR,Now,2026-11-01,,2/3,',
            '2026-10-01,Sofa,Food,15.00,EUR,Now,2026-12-01,,3/3,',
        ]);
    });

    it('leaves out the deleted expenses', () => {
        const csv = expensesCsv([expense({ text: 'Kept' }), expense({ text: 'Gone', deletedAt: 3_000 })], 'en', LABELS);

        expect(rows(csv)).toHaveLength(3);
        expect(csv).toContain('Kept');
        expect(csv).not.toContain('Gone');
    });

    it('lists them in the order of the backup', () => {
        const csv = expensesCsv(
            [
                expense({ text: 'Later', date: '2026-10-25', createdAt: 1 }),
                expense({ text: 'Earlier', date: '2026-10-20' }),
                expense({ text: 'Same day later', date: '2026-10-25', createdAt: 5 }),
            ],
            'en',
            LABELS
        );

        expect(
            rows(csv)
                .slice(1, 4)
                .map((line) => line.split(',')[1])
        ).toEqual(['Earlier', 'Later', 'Same day later']);
    });

    it('keeps the currency of each expense', () => {
        const csv = expensesCsv([expense({ currency: 'USD' })], 'en', LABELS);

        expect(rows(csv)[1]!.split(',')[4]).toBe('USD');
    });

    describe('quoting', () => {
        it('wraps a field with the delimiter and doubles the quotes in it', () => {
            const csv = expensesCsv([expense({ text: 'Bread, "fresh"' })], 'en', LABELS);

            expect(rows(csv)[1]).toBe('2026-10-24,"Bread, ""fresh""",Food,12.50,EUR,Now,,,,');
        });

        it('wraps a field with a line break, which stays inside it', () => {
            const csv = expensesCsv([expense({ text: 'Two\nlines' })], 'en', LABELS);

            expect(csv).toContain('"Two\nlines"');
            expect(rows(csv)).toHaveLength(3);
        });

        it('quotes by the delimiter of the language: a semicolon only matters in Spanish', () => {
            const text = 'Pan; leche, huevos';

            expect(expensesCsv([expense({ text })], 'es', LABELS_ES)).toContain(`;"${text}";`);
            expect(expensesCsv([expense({ text })], 'en', LABELS)).toContain(`,"${text}",`);
            expect(expensesCsv([expense({ text: 'Pan; leche' })], 'en', LABELS)).toContain(',Pan; leche,');
            expect(expensesCsv([expense({ text: 'Pan, leche' })], 'es', LABELS_ES)).toContain(';Pan, leche;');
        });

        it('does not touch a plain text with accents', () => {
            expect(rows(expensesCsv([expense({ text: 'Café con leche ñ' })], 'en', LABELS))[1]).toContain(
                ',Café con leche ñ,'
            );
        });
    });

    describe('a text a spreadsheet could run as a formula', () => {
        it.each(['=SUM(A1:A9)', '+1', '-1', '@cmd', '\tx', '\rx'])('gets a leading apostrophe: %j', (text) => {
            const csv = expensesCsv([expense({ text })], 'en', LABELS);

            expect(rows(csv)[1]).toContain(`'${text}`);
        });

        it('is guarded before it is quoted', () => {
            const csv = expensesCsv([expense({ text: '=HYPERLINK("http://x","y")' })], 'en', LABELS);

            expect(rows(csv)[1]).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
        });

        it('is guarded in the name of a category too', () => {
            const evil = { ...LABELS, categoryName: () => '=cmd|calc' };

            const csv = expensesCsv([expense()], 'en', evil);

            expect(rows(csv)[1]).toContain(",'=cmd|calc,");
        });

        it.each(['a=b', 'x+1', ' =x', '1-2'])('is left alone when it only has the sign inside: %j', (text) => {
            const csv = expensesCsv([expense({ text })], 'en', LABELS);

            expect(rows(csv)[1]).toContain(`,${text},`);
        });
    });
});

describe('the shared rows of the CSV', () => {
    const csvOf = (locale: 'en' | 'es', ...ledgers: BackupLedger[]) => {
        return expensesCsv(ledgers.flatMap(partsOf), locale, locale === 'en' ? LABELS : LABELS_ES);
    };

    it('has your part of what somebody else paid, with the total, "Now" and the group', () => {
        const csv = csvOf('en', ledger(group({ me: 'bea' }), dinner()));

        expect(rows(csv)).toEqual([
            'Date,Text,Category,Amount,Currency,Payment,Charge date,Your part,Part,Group',
            '2026-10-25,Dinner,Food,40.00,EUR,Now,,20.00,,Trip',
            '',
        ]);
    });

    it('says how you paid, and the day it is charged, when you are the payer', () => {
        const csv = csvOf(
            'en',
            ledger(
                group(),
                dinner({ text: 'Hotel', payment: 'credit', chargeDate: '2026-11-02', createdAt: 1 }),
                dinner({
                    text: 'Menu',
                    amountCents: 3000,
                    shares: [
                        { memberId: 'ana', cents: 1000 },
                        { memberId: 'bea', cents: 2000 },
                    ],
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                    createdAt: 2,
                })
            )
        );

        expect(rows(csv).slice(1, 3)).toEqual([
            '2026-10-25,Hotel,Food,40.00,EUR,Credit card,2026-11-02,20.00,,Trip',
            '2026-10-25,Menu,Food,30.00,EUR,Restaurant card,2026-11-12,10.00,,Trip',
        ]);
    });

    it('leaves the card of the payer out of the row of somebody else', () => {
        const csv = csvOf('en', ledger(group({ me: 'bea' }), dinner({ payment: 'credit', chargeDate: '2026-11-02' })));

        expect(rows(csv)[1]).toBe('2026-10-25,Dinner,Food,40.00,EUR,Now,,20.00,,Trip');
    });

    it('is a row in the order of the others, among the expenses of your own', () => {
        const [row] = partsOf(ledger(group(), dinner({ text: 'Shared', date: '2026-10-24', createdAt: 5 })));
        const csv = expensesCsv(
            [expense({ text: 'Later', date: '2026-10-26' }), row!, expense({ text: 'Earlier', date: '2026-10-20' })],
            'en',
            LABELS
        );

        const lines = rows(csv).slice(1, 4);
        expect(lines.map((line) => line.split(',')[1])).toEqual(['Earlier', 'Shared', 'Later']);
        expect(lines.map((line) => line.split(',').at(-1))).toEqual(['', 'Trip', '']);
    });

    it('names a friend by the person', () => {
        const dani = group({
            id: DANI_ID,
            kind: 'direct',
            name: null,
            members: [member('ana', 'Ana'), member('dani', 'Dani')],
        });

        const csv = csvOf('en', ledger(dani, dinner()));

        expect(rows(csv)[1]!.split(',').at(-1)).toBe('Dani');
    });

    it('gives no row for a settlement, for an expense you are not in or for a deleted one', () => {
        const csv = csvOf(
            'en',
            ledger(
                group(),
                settlement(),
                dinner({ amountCents: 2000, shares: [{ memberId: 'bea', cents: 2000 }] }),
                dinner({ deletedAt: 9_000 })
            )
        );

        expect(rows(csv)).toHaveLength(2);
    });

    it('gives no row for a group whose switch is off', () => {
        expect(rows(csvOf('en', ledger(group({ showInExpenses: false }), dinner())))).toHaveLength(2);
    });

    it('writes the amounts and the delimiter of the language, as for the rows of your own', () => {
        const big = dinner({
            amountCents: 12_345_678,
            shares: [
                { memberId: 'ana', cents: 10_000_000 },
                { memberId: 'bea', cents: 2_345_678 },
            ],
        });

        const csv = csvOf('es', ledger(group({ me: 'bea' }), big));

        expect(rows(csv)[1]).toBe('2026-10-25;Dinner;Comida;123456,78;EUR;Ahora;;23456,78;;Viaje');
    });

    describe('the name of the group', () => {
        const lineWith = (name: string, locale: 'en' | 'es' = 'en') => {
            const labels = locale === 'en' ? LABELS : LABELS_ES;
            return expensesCsv(partsOf(ledger(group(), dinner())), locale, { ...labels, groupName: () => name });
        };

        it('is quoted, with its quotes doubled, when it holds the delimiter or a quote', () => {
            expect(rows(lineWith('Trip, "Lisbon"'))[1]).toMatch(/,"Trip, ""Lisbon"""$/);
            expect(rows(lineWith('Pan; leche', 'es'))[1]).toMatch(/;"Pan; leche"$/);
        });

        it('is quoted, with the line break kept inside, when it has one', () => {
            const csv = lineWith('Two\nlines');

            expect(csv).toContain(',"Two\nlines"\r\n');
            expect(rows(csv)).toHaveLength(3);
        });

        it('is guarded, so a spreadsheet never runs it', () => {
            expect(rows(lineWith('=cmd|calc'))[1]).toMatch(/,'=cmd\|calc$/);
        });
    });
});

describe('groupCsv', () => {
    const names: Readonly<Record<string, string>> = { ana: 'Ana', bea: 'Bea' };
    const labels: GroupCsvLabels = {
        columns: ['date', 'text', 'category', 'paid by', 'amount', 'currency'],
        memberName: (id) => names[id] ?? '',
        entryText: (entry) => (entry.kind === 'expense' ? entry.text : `${names[entry.paidBy]} paid`),
        categoryName: (id) => (id === 'food' ? 'Food' : 'Other'),
        opening: 'Before',
        closing: 'Balance',
    };
    const csvOf = (entries: LedgerEntry[], from = '', locale = 'en', words = labels) =>
        groupCsv(groupTable(entries, group().members, { from, to: '' }), 'EUR', locale, words);
    const rows = (csv: string) => csv.slice(BOM.length).split('\r\n').slice(0, -1);

    it('has a column per member and a row per entry, each cell signed, with the closing balance last', () => {
        expect(rows(csvOf([dinner(), settlement()]))).toEqual([
            'date,text,category,paid by,amount,currency,Ana,Bea',
            '2026-10-25,Dinner,Food,Ana,40.00,EUR,20.00,-20.00',
            '2026-10-26,Bea paid,,Bea,15.00,EUR,-15.00,15.00',
            ',Balance,,,,EUR,5.00,-5.00',
        ]);
    });

    it('opens on the balance before the first day when the range has one', () => {
        expect(rows(csvOf([dinner(), settlement()], '2026-10-26')).slice(1, 3)).toEqual([
            ',Before,,,,EUR,20.00,-20.00',
            '2026-10-26,Bea paid,,Bea,15.00,EUR,-15.00,15.00',
        ]);
    });

    it('leaves the cell of a member who is out of the entry empty', () => {
        const alone = dinner({ createdAt: 2_000, shares: [{ memberId: 'ana', cents: 4000 }] });

        expect(rows(csvOf([dinner(), alone]))[2]).toBe('2026-10-25,Dinner,Food,Ana,40.00,EUR,0.00,');
    });

    it('writes the numbers and the delimiter of the language', () => {
        expect(rows(csvOf([dinner()], '', 'es'))[1]).toBe('2026-10-25;Dinner;Food;Ana;40,00;EUR;20,00;-20,00');
    });

    it('guards a text or a name, so a spreadsheet never runs it, but never a number', () => {
        const memberName = (id: string) => (id === 'bea' ? '=cmd|calc' : 'Ana');
        const csv = rows(csvOf([dinner({ text: '+SUM(A1)' })], '', 'en', { ...labels, memberName }));

        expect(csv[0]).toMatch(/,'=cmd\|calc$/);
        expect(csv[1]).toMatch(/^2026-10-25,'\+SUM\(A1\),.*,-20.00$/);
    });

    it('guards who paid, the category and the label of a balance as texts', () => {
        const words = { ...labels, memberName: () => '@ana', categoryName: () => '-food', closing: '=total' };
        const csv = rows(csvOf([dinner()], '', 'en', words));

        expect(csv[1]).toBe("2026-10-25,Dinner,'-food,'@ana,40.00,EUR,20.00,-20.00");
        expect(csv[2]).toBe(",'=total,,,,EUR,20.00,-20.00");
    });

    it('starts with a byte order mark', () => {
        expect(csvOf([dinner()]).startsWith(BOM)).toBe(true);
    });
});

describe('groupFileName', () => {
    const now = new Date(2026, 10, 24, 12, 0);

    it('is tarja, the group and the day of the device', () => {
        expect(groupFileName('Trip to Lisbon', now)).toBe('tarja-Trip-to-Lisbon-2026-11-24.csv');
    });

    it('drops what a file name cannot hold', () => {
        expect(groupFileName('Rent: 2026/27 "flat"', now)).toBe('tarja-Rent-2026-27-flat-2026-11-24.csv');
    });

    it('keeps 60 characters at most, never half of one, and no dash at the end', () => {
        expect(groupFileName(`${'a'.repeat(59)}🏠🏠`, now)).toBe(`tarja-${'a'.repeat(59)}🏠-2026-11-24.csv`);
        expect(groupFileName(`${'a'.repeat(59)} b`, now)).toBe(`tarja-${'a'.repeat(59)}-2026-11-24.csv`);
    });

    it('drops the invisible characters that change how a name reads', () => {
        expect(groupFileName('Flat\u202Etxt.exe', now)).toBe('tarja-Flat-txt.exe-2026-11-24.csv');
    });

    it('is tarja and the day when nothing of the name is left', () => {
        expect(groupFileName(' /?* ', now)).toBe('tarja-2026-11-24.csv');
    });
});
