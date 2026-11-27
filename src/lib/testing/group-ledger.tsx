import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { expect } from 'vitest';

import en from '@/assets/locales/en.json';
import { groupEntriesKey } from '@/lib/api';
import { createFakeApi } from '@/lib/testing/fake-api';
import { person, sampleEntry, sampleGroup } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { formatAmount } from '@core/basics/money';

import type { PendingEntry } from '@/lib/offline';
import type { SeededEntry } from '@/lib/testing/fake-groups';
import type { SharedGroup } from '@core/groups/shared-group';

const t = createTranslator({ locale: 'en', messages: en });

const ledger = en.groups.ledger;

const euros = (cents: number) => {
    return formatAmount(cents, 'EUR', 'en');
};

const ana = person('Ana', { role: 'owner' });

const bea = person('Bea');

const cris = person('Cris');

const trip = (overrides: Partial<SharedGroup> = {}) => {
    return sampleGroup({ name: 'Trip', members: [ana, bea, cris], me: ana.id, ...overrides });
};

type ExpenseFields = Partial<Extract<PendingEntry, { kind: 'expense' }>> & Pick<SeededEntry, 'createdBy' | 'updatedBy'>;

const dinner = (group: SharedGroup, overrides: ExpenseFields = {}): SeededEntry => {
    const { createdBy, updatedBy, ...fields } = overrides;
    const entry = sampleEntry(group, {
        amountCents: 3000,
        shares: [
            { memberId: ana.id, cents: 1000 },
            { memberId: bea.id, cents: 1000 },
            { memberId: cris.id, cents: 1000 },
        ],
        ...fields,
    });
    return { ...entry, createdBy, updatedBy };
};

const open = async (group: SharedGroup, entries: SeededEntry[] = []) => {
    const api = createFakeApi({ groups: [group], entries });
    stubApi(api.handler);
    const app = renderApp({ path: `/groups/${group.id}` });
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(app.queryClient.getQueryState(groupEntriesKey(group.id))?.status).toBe('success'));
    return { api, app };
};

const theLedger = () => {
    return document.querySelector<HTMLElement>('.group-ledger')!;
};

const days = () => {
    return within(theLedger())
        .queryAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent);
};

const rowNames = () => {
    return within(theLedger())
        .queryAllByRole('listitem')
        .map((row) => row.querySelector('.expense-item__text')?.textContent);
};

const rowOf = (name: string) => {
    return within(theLedger()).getByText(name, { selector: '.expense-item__text' }).closest('li')!;
};

const details = (name: string) => {
    return [...rowOf(name).querySelectorAll('.expense-item__meta > span')].map((span) => span.textContent);
};

const amountOf = (name: string) => {
    return rowOf(name).querySelector('.expense-item__amount')?.textContent ?? null;
};

const spoken = (name: string) => {
    return rowOf(name).querySelector('.expense-item__body > .visually-hidden')?.textContent;
};

const longDay = (isoDay: string, locale = 'en') => {
    return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
        new Date(`${isoDay}T12:00:00`)
    );
};

const shortDay = (isoDay: string, withYear: boolean) => {
    return new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'short',
        ...(withYear ? { year: 'numeric' } : {}),
    }).format(new Date(`${isoDay}T12:00:00`));
};

const orderGroup = () => {
    return within(theLedger()).getByRole('group', { name: ledger.order.legend });
};

const orderRadio = (name: string) => {
    return within(orderGroup()).getByRole('radio', { name });
};

const chooseOrder = (name: string) => {
    fireEvent.click(orderRadio(name));
};

export {
    amountOf,
    ana,
    bea,
    chooseOrder,
    cris,
    days,
    details,
    dinner,
    euros,
    type ExpenseFields,
    ledger,
    longDay,
    open,
    orderGroup,
    orderRadio,
    rowNames,
    rowOf,
    shortDay,
    spoken,
    t,
    theLedger,
    trip,
};
