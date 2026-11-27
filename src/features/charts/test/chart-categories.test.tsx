import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { CATEGORIES_KEY, EXPENSES_KEY } from '@/lib/api';
import {
    breakdown,
    dates,
    expense,
    open,
    pick,
    rowOf,
    shareOf,
    splitRow,
    t,
    text,
    totalLine,
} from '@/lib/testing/charts';
import { createFakeApi } from '@/lib/testing/fake-api';
import { stubLanguages } from '@/lib/testing/languages';
import { renderApp, stubApi } from '@/lib/testing/render-app';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    stubLanguages(['en-GB']);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('by category', () => {
    it('lists each category with what it took, the biggest first, and its share', async () => {
        await open();

        expect(breakdown().map((item) => item.textContent)).toEqual([
            expect.stringContaining(`${en.categories.groceries}€45.99`),
            expect.stringContaining(`${en.categories.leisure}€28.00`),
            expect.stringContaining(`${en.categories.food}€15.50`),
        ]);
        expect(breakdown()[0]!.textContent).toContain('51%');
        expect(breakdown()[1]!.textContent).toContain('31%');
        expect(breakdown()[2]!.textContent).toContain('17%');
    });

    it('shows the icon of each category next to its name', async () => {
        await open();

        expect(breakdown()[0]!.querySelector('[data-icon]')).not.toBeNull();
    });

    it('sets each category in a notched card with no bar of its own', async () => {
        await open();

        for (const row of breakdown()) {
            expect(row.classList.contains('card')).toBe(true);
            expect(row.querySelector('[style]')).toBeNull();
        }
    });

    it('draws one strip over the rows, a segment per category as wide as its share, the biggest first', async () => {
        await open();

        const strip = document.querySelector('.category-split__strip')!;
        const segments = [...strip.querySelectorAll<HTMLElement>('.category-split__segment')];
        const startOf = (element: HTMLElement) => Number(element.style.getPropertyValue('--start'));
        expect(strip.compareDocumentPosition(screen.getByRole('list', { name: text.byCategory }))).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING
        );
        expect(segments).toHaveLength(3);
        expect(segments.map(shareOf)).toEqual([
            expect.closeTo(4599 / 8949, 5),
            expect.closeTo(2800 / 8949, 5),
            expect.closeTo(1550 / 8949, 5),
        ]);
        expect(segments.map(startOf)).toEqual([0, expect.closeTo(4599 / 8949, 5), expect.closeTo(7399 / 8949, 5)]);
    });

    it('parts the segments with gaps where one ends and the next begins', async () => {
        await open();

        const gaps = [...document.querySelectorAll<HTMLElement>('.category-split__gap')];
        expect(gaps.map((gap) => Number(gap.style.getPropertyValue('--start')))).toEqual([
            expect.closeTo(4599 / 8949, 5),
            expect.closeTo(7399 / 8949, 5),
        ]);
    });

    it('hides the strip from assistive technology, since the rows carry the numbers', async () => {
        await open();

        expect(document.querySelector('.category-split__strip')!.getAttribute('aria-hidden')).toBe('true');
    });

    it('paints each segment in the color of its category, the same as its icon', async () => {
        await open();

        const segments = [...document.querySelectorAll('.category-split__segment')];
        expect(segments.map((segment) => segment.className)).toEqual([
            'category-split__segment category-split__segment--green',
            'category-split__segment category-split__segment--purple',
            'category-split__segment category-split__segment--vermillion',
        ]);
        expect(breakdown()[0]!.querySelector('.category-badge--green')).not.toBeNull();
        expect(breakdown()[1]!.querySelector('.category-badge--purple')).not.toBeNull();
    });

    it('keeps the gaps in the page color', async () => {
        await open();

        for (const gap of document.querySelectorAll('.category-split__gap')) {
            expect(gap.getAttribute('class')).toBe('category-split__gap');
        }
    });

    it('paints a deleted category as the fallback, in gray', async () => {
        await open([expense({ categoryId: crypto.randomUUID(), amountCents: 300 })]);

        const [segment] = document.querySelectorAll('.category-split__segment');
        expect(segment!.classList.contains('category-split__segment--gray')).toBe(true);
    });

    it('is one whole segment for a single category', async () => {
        await open([expense({ amountCents: 900 })]);

        const segments = [...document.querySelectorAll('.category-split__segment')];
        expect(segments.map(shareOf)).toEqual([1]);
        expect(document.querySelectorAll('.category-split__gap')).toHaveLength(0);
    });

    it('draws a segment for a category that took about one percent', async () => {
        await open([expense({ amountCents: 9900 }), expense({ categoryId: 'leisure', amountCents: 100 })]);

        const segments = [...document.querySelectorAll('.category-split__segment')];
        expect(segments.map(shareOf)).toEqual([expect.closeTo(0.99, 5), expect.closeTo(0.01, 5)]);
        expect(breakdown()[1]!.textContent).toContain('1%');
    });

    it('says nothing was spent when the only expense has none of it as yours', async () => {
        await open([
            expense({
                amountCents: 1000,
                personalCents: 0,
                date: '2026-10-12',
                payment: 'voucher',
                chargeDate: '2026-11-12',
            }),
        ]);

        expect(screen.getByText(text.empty)).toBeTruthy();
        expect(document.querySelector('.category-split')).toBeNull();
    });

    it('names a custom category, and shows a deleted one as the fallback', async () => {
        const gym = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' } as const;
        await open(
            [
                expense({ categoryId: gym.id, amountCents: 5000 }),
                expense({ categoryId: crypto.randomUUID(), amountCents: 300 }),
                expense({ categoryId: 'other', amountCents: 200 }),
            ],
            { categories: [gym] }
        );

        expect(breakdown().map((item) => item.textContent)).toEqual([
            expect.stringContaining('Gym€50.00'),
            expect.stringContaining(`${en.categories.other}€5.00`),
        ]);
    });

    it('puts the categories that took the same in the order of their names, not of their ids', async () => {
        const zumba = {
            id: '00000000-0000-4000-8000-000000000000',
            name: 'Zumba',
            color: 'blue',
            icon: 'fitness_center',
        } as const;
        const aikido = {
            id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            name: 'Aikido',
            color: 'green',
            icon: 'spa',
        } as const;

        await open(
            [expense({ categoryId: zumba.id, amountCents: 100 }), expense({ categoryId: aikido.id, amountCents: 100 })],
            { categories: [zumba, aikido] }
        );

        expect(breakdown().map((item) => item.textContent)).toEqual([
            expect.stringContaining('Aikido'),
            expect.stringContaining('Zumba'),
        ]);
    });

    it('does not fold what it cannot name into Other before the categories are known', async () => {
        const api = createFakeApi({
            expenses: [
                expense({ categoryId: crypto.randomUUID(), amountCents: 300 }),
                expense({ categoryId: 'other', amountCents: 200 }),
            ],
        });
        stubApi((url, init) =>
            url.pathname === '/api/categories' ? new Response(null, { status: 500 }) : api.handler(url, init)
        );
        const app = renderApp({ path: '/charts' });
        await screen.findByRole('heading', { name: text.title });
        await waitFor(() => expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success'));
        await waitFor(() => expect(app.queryClient.getQueryState(CATEGORIES_KEY)?.status).toBe('error'));

        expect(breakdown().map((item) => item.textContent)).toEqual([
            expect.stringContaining('€3.00'),
            expect.stringContaining('€2.00'),
        ]);
    });

    it('is not asked for when nothing was spent, and says so', async () => {
        await open([]);

        expect(screen.queryByRole('list', { name: text.byCategory })).toBeNull();
        expect(document.querySelector('.category-split__strip')).toBeNull();
        expect(screen.getByText(text.empty).classList.contains('notice--quiet')).toBe(true);
    });

    it('does not say it is empty when something was spent', async () => {
        await open();

        expect(screen.queryByText(text.empty)).toBeNull();
    });
});

describe('picking a category from the split', () => {
    it('has no list of categories among the filters', async () => {
        await open();

        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.getByText(text.pickHint)).toBeDefined();
    });

    it('makes each row of the split a toggle, none pressed at first', async () => {
        await open();

        expect(splitRow(en.categories.food).getAttribute('aria-pressed')).toBe('false');
        expect(splitRow(en.categories.groceries).getAttribute('aria-pressed')).toBe('false');
    });

    it('narrows the bars and the total to the category pressed, and names it', async () => {
        await open();

        pick(en.categories.food);

        expect(splitRow(en.categories.food).getAttribute('aria-pressed')).toBe('true');
        expect(rowOf('Oct 25').textContent).toContain('€3.00');
        expect(rowOf('Oct 24').textContent).toContain('€12.50');
        const total = screen.getByText(t('charts.totalIn', { category: en.categories.food })).closest('p')!;
        expect(total.textContent).toContain('€15.50');
    });

    it('lets go of the category when its row is pressed again', async () => {
        await open();

        pick(en.categories.food);
        pick(en.categories.food);

        expect(splitRow(en.categories.food).getAttribute('aria-pressed')).toBe('false');
        expect(totalLine().textContent).toContain('€89.49');
    });

    it('moves to another category when another row is pressed', async () => {
        await open();

        pick(en.categories.food);
        pick(en.categories.leisure);

        expect(splitRow(en.categories.food).getAttribute('aria-pressed')).toBe('false');
        expect(splitRow(en.categories.leisure).getAttribute('aria-pressed')).toBe('true');
        expect(
            screen.getByText(t('charts.totalIn', { category: en.categories.leisure })).closest('p')!.textContent
        ).toContain('€28.00');
    });

    it('leaves the split by category alone', async () => {
        await open();

        pick(en.categories.food);

        expect(breakdown()).toHaveLength(3);
    });

    it('keeps the picked category at zero, last, when the new range has none of it, so it can be let go of', async () => {
        await open();
        pick(en.categories.leisure);

        dates('2026-10-24', '2026-10-25');

        expect(breakdown()).toHaveLength(3);
        expect(breakdown().at(-1)!.textContent).toContain(en.categories.leisure);
        expect(breakdown().at(-1)!.textContent).toContain('€0.00');
        expect(document.querySelectorAll('.category-split__segment')).toHaveLength(2);

        pick(en.categories.leisure);

        expect(breakdown()).toHaveLength(2);
    });

    it('moves the focus to the first row that stays when a picked row at zero goes away', async () => {
        await open();
        pick(en.categories.leisure);
        dates('2026-10-24', '2026-10-25');
        splitRow(en.categories.leisure).focus();

        pick(en.categories.leisure);

        expect(document.activeElement).toBe(splitRow(en.categories.groceries));
    });

    it('moves the focus to the total when the picked row at zero was the last one', async () => {
        await open();
        pick(en.categories.food);
        dates('2026-10-11', '2026-10-12');
        splitRow(en.categories.food).focus();

        pick(en.categories.food);

        expect(screen.queryByRole('list', { name: text.byCategory })).toBeNull();
        expect(document.activeElement).toBe(totalLine());
    });

    it('says the new total when a category is picked or let go of', async () => {
        await open();
        const status = () => [...document.querySelectorAll('[role="status"]')].map((region) => region.textContent);

        pick(en.categories.food);
        await waitFor(() =>
            expect(status()).toContain(t('charts.picked', { category: en.categories.food, total: '€15.50' }))
        );

        pick(en.categories.food);
        await waitFor(() => expect(status()).toContain(t('charts.pickedAll', { total: '€89.49' })));
    });

    it('keeps the picked category when nothing at all was spent in the new range', async () => {
        await open();
        pick(en.categories.food);

        dates('2026-10-11', '2026-10-12');

        expect(screen.getByText(text.empty)).toBeDefined();
        expect(breakdown()).toHaveLength(1);
        expect(splitRow(en.categories.food).getAttribute('aria-pressed')).toBe('true');
    });
});
