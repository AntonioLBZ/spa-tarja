import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { expect } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/testing/fake-api';
import { person, sampleEntry, sampleGroup } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { pickOption } from '@/lib/testing/select';
import { formatAmount } from '@core/basics/money';

import type { PendingEntry } from '@/lib/offline';
import type { GroupMember, SharedGroup } from '@core/groups/shared-group';

const t = createTranslator({ locale: 'en', messages: en });

const text = en.groups.settle;

const you = t('groups.names.you', { name: 'Ana' });

const euros = (cents: number) => {
    return formatAmount(cents, 'EUR', 'en');
};

const ana = person('Ana', { role: 'owner' });

const bea = person('Bea');

const cris = person('Cris');

const expense = (group: SharedGroup, payer: GroupMember, shares: Array<[GroupMember, number]>) => {
    return sampleEntry(group, {
        paidBy: payer.id,
        amountCents: shares.reduce((sum, [, cents]) => sum + cents, 0),
        shares: shares.map(([member, cents]) => ({ memberId: member.id, cents })),
    });
};

const trip = (overrides: Partial<SharedGroup> = {}) => {
    return sampleGroup({ members: [ana, bea, cris], me: ana.id, ...overrides });
};

const debts = (group: SharedGroup) => {
    return [
        expense(group, bea, [
            [ana, 1500],
            [bea, 1500],
        ]),
        expense(group, ana, [
            [ana, 1000],
            [cris, 1000],
        ]),
    ];
};

const open = async (group: SharedGroup, entries: PendingEntry[]) => {
    const api = createFakeApi({ groups: [group], entries });
    stubApi(api.handler);
    const app = renderApp({ path: `/groups/${group.id}` });
    await screen.findByRole('heading', { name: en.groups.debts.label });
    await waitFor(() => expect(lines().length).toBeGreaterThan(0));
    return { api, app };
};

const spokenStatus = () => {
    return within(screen.getByRole('main'))
        .getAllByRole('status')
        .find((region) => region.textContent !== '');
};

const sheet = () => {
    return screen.getByRole('heading', { name: en.groups.debts.label }).closest('section')!;
};

const lines = () => {
    for (const toggle of within(sheet()).queryAllByRole('button')) {
        if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
    }
    const sentences = [...sheet().querySelectorAll('.group-balances__debt > .visually-hidden')].map(
        (sentence) => sentence.textContent
    );
    return [...new Set(sentences)];
};

const lineButton = (debt: string) => {
    return screen.getAllByRole('button', { name: t('groups.settle.lineItem', { debt }) })[0]!;
};

const toggle = () => {
    return screen.getByRole('button', { name: text.open }) as HTMLButtonElement;
};

const settleUp = () => {
    return screen.getByRole('dialog') as HTMLElement;
};

const closeSheet = () => {
    act(() => settleUp().dispatchEvent(new Event('cancel', { cancelable: true })));
    act(() => (settleUp() as HTMLDialogElement).close());
};

const choose = (label: string, option: string) => {
    pickOption(label, option);
};

const amount = () => {
    return within(settleUp()).getByLabelText(text.amount) as HTMLInputElement;
};

const date = () => {
    return within(settleUp()).getByLabelText(text.date) as HTMLInputElement;
};

const save = () => {
    return screen.getByRole('button', { name: text.save }) as HTMLButtonElement;
};

const problemOf = (field: HTMLElement) => {
    return field
        .getAttribute('aria-describedby')
        ?.split(' ')
        .map((id) => document.getElementById(id))
        .find((element) => element?.getAttribute('role') === 'alert')?.textContent;
};

const sentences = (...texts: string[]) => {
    return texts.map((text) => `${text}.`).join(' ');
};

const hint = () => {
    return document.getElementById(amount().getAttribute('aria-describedby')!.split(' ')[0]!)!.textContent;
};

export {
    amount,
    ana,
    bea,
    choose,
    closeSheet,
    cris,
    date,
    debts,
    euros,
    expense,
    hint,
    lineButton,
    lines,
    open,
    problemOf,
    save,
    sentences,
    settleUp,
    sheet,
    spokenStatus,
    t,
    text,
    toggle,
    trip,
    you,
};
