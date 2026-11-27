import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { expect } from 'vitest';

import en from '@/assets/locales/en.json';
import { CATEGORIES_KEY, GROUPS_KEY, groupEntriesKey } from '@/lib/api';
import { createFakeApi } from '@/lib/testing/fake-api';
import { person, sampleGroup } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { openAddSheet, openSplit } from '@/lib/testing/sheet';
import { spokenText } from '@/lib/testing/spoken-text';
import { formatAmount } from '@core/basics/money';

import type { SharedGroup } from '@core/groups/shared-group';

const t = createTranslator({ locale: 'en', messages: en });

const form = en.expenses.form;

const share = en.groups.share;

const you = t('groups.names.you', { name: 'Ana' });

const euros = (cents: number) => {
    return formatAmount(cents, 'EUR', 'en');
};

const ana = person('Ana', { role: 'owner' });

const bea = person('Bea');

const cris = person('Cris');

const trip = (overrides: Partial<SharedGroup> = {}) => {
    return sampleGroup({ name: 'Trip', members: [ana, bea, cris], me: ana.id, ...overrides });
};

const friend = (name: string, overrides: Partial<SharedGroup> = {}) => {
    const me = person('Ana', { role: 'owner' });
    return sampleGroup({ kind: 'direct', name: null, members: [me, person(name)], me: me.id, ...overrides });
};

const openHome = async (groups: SharedGroup[], options: Parameters<typeof createFakeApi>[0] = {}) => {
    const api = createFakeApi({ groups, ...options });
    stubApi(api.handler);
    const app = renderApp();
    await screen.findByRole('button', { name: en.nav.add });
    await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
    await waitFor(() => expect(app.queryClient.getQueryState(CATEGORIES_KEY)?.status).toBe('success'));
    await openAddSheet();
    return { api, app };
};

const openGroup = async (group: SharedGroup) => {
    const api = createFakeApi({ groups: [group] });
    stubApi(api.handler);
    const app = renderApp({ path: `/groups/${group.id}` });
    await screen.findByRole('heading', { name: 'Trip' });
    await waitFor(() => expect(app.queryClient.getQueryState(groupEntriesKey(group.id))?.status).toBe('success'));
    return { api, app };
};

const spokenLeft = () => {
    return within(theForm()).getByRole('status').textContent;
};

const balance = () => {
    return spokenText(
        within(screen.getByRole('main'))
            .getAllByRole('status')
            .find((region) => region.textContent !== '')
    );
};

const splitToggle = () => {
    return screen.getByRole('button', { name: new RegExp(`^${share.split}`) });
};

const summaryLines = () => {
    const toggle = screen.queryByRole('button', { name: new RegExp(`^${share.split}`) });
    const summary = toggle && document.getElementById(toggle.getAttribute('aria-describedby') ?? '');
    if (!summary) return null;
    return [...summary.querySelectorAll('.shared-summary__line')].map((line) => line.textContent);
};

const forChoice = (name: string) => {
    return screen.getByRole('radio', { name }) as HTMLInputElement;
};

const field = (label: string) => {
    const dialog = screen.queryByRole('dialog');
    return (dialog ? within(dialog) : screen).getByLabelText(label) as HTMLInputElement;
};

const fill = ({ amount, text = '' }: { amount: string; text?: string }) => {
    fireEvent.change(field(form.amount), { target: { value: amount } });
    fireEvent.change(field(form.text), { target: { value: text } });
};

const addButton = () => {
    return screen.getByRole('button', { name: form.submit }) as HTMLButtonElement;
};

const addIsRefused = async () => {
    const amount = field(form.amount).value;
    expect(addButton().disabled).toBe(false);
    fireEvent.click(addButton());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole('dialog', { name: form.title })).toBeDefined();
    expect(field(form.amount).value).toBe(amount);
};

const people = () => {
    openSplit();
    return screen.getByRole('group', { name: share.people });
};

const rows = () => {
    return within(people())
        .getAllByRole('listitem')
        .map((row) => row.textContent);
};

const theForm = () => {
    return screen.getByRole('form', { name: form.title });
};

const shareField = (name: string, kind: 'percentOf' | 'amountOf') => {
    return within(people()).getByRole('textbox', { name: t(`groups.share.${kind}`, { name }) }) as HTMLInputElement;
};

const shareValues = () => {
    return within(people())
        .queryAllByRole('textbox')
        .map((input) => (input as HTMLInputElement).value);
};

const pickMode = (mode: 'equal' | 'percent' | 'exact') => {
    openSplit();
    fireEvent.click(screen.getByRole('button', { name: share.modes[mode] }));
};

const percent = (basisPoints: number, locale = 'en') => {
    return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(basisPoints / 10_000);
};

const checkbox = (name: string) => {
    return within(people()).getByRole('checkbox', { name }) as HTMLInputElement;
};

const amountsShown = () => {
    return rows().map((text) => {
        const amount = /\d[\d,.]*$/.exec(text ?? '')?.[0] ?? '0';
        return Math.round(Number(amount.replace(/,/g, '')) * 100);
    });
};

export {
    addButton,
    addIsRefused,
    amountsShown,
    ana,
    balance,
    bea,
    checkbox,
    cris,
    euros,
    field,
    fill,
    forChoice,
    form,
    friend,
    openGroup,
    openHome,
    people,
    percent,
    pickMode,
    rows,
    share,
    shareField,
    shareValues,
    splitToggle,
    spokenLeft,
    summaryLines,
    t,
    theForm,
    trip,
    you,
};
