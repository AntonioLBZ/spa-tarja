import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Card, CardList } from '@/components/card/card';
import { Icon } from '@/components/icon/icon';
import { Sheet } from '@/components/sheet/sheet';

import { myBalance } from './my-balance';
import { useGroupWords } from './use-group-words';

import type { Ledger } from './use-ledgers';
import type { Pins } from './use-pins';
import type { SharedGroup } from '@core/shared-group';

import './group-list.css';

interface GroupListProps {
    ledgers: readonly Ledger[];
    // The pin of each card, which pins its group to the Expenses screen (ADR-0021)
    pins: Pins;
}

interface GroupSheetProps {
    ledgers: readonly Ledger[];
    label: string;
}

interface PinButtonProps {
    group: SharedGroup;
    name: string;
    pins: Pins;
}

interface GroupRowProps {
    ledger: Ledger;
    // On a card of its own, which the link covers, instead of on paper
    card?: boolean;
    pins?: Pins;
}

// Groups or friends as cards, each leading to its screen, under the heading of their section. The link covers the
// whole card; the pin sits over it, before the chevron.
const GroupList = (props: GroupListProps) => {
    const { ledgers, pins } = props;

    return (
        <CardList>
            {ledgers.map((ledger) => (
                <Card key={ledger.group.id} as="li" className="group-card">
                    <GroupRow card ledger={ledger} pins={pins} />
                </Card>
            ))}
        </CardList>
    );
};

const PinButton = (props: PinButtonProps) => {
    const { group, name, pins } = props;
    const t = useTranslations('groups.row');
    const pinned = pins.isPinned(group);

    return (
        <Button
            ghost
            glyph
            className="group-card__pin"
            aria-label={t('pin', { name })}
            aria-pressed={pinned}
            disabled={!pins.canToggle(group)}
            onClick={() => void pins.toggle(group)}
        >
            <Icon name={pinned ? 'keep_filled' : 'keep'} />
        </Button>
    );
};

// Groups or friends on a sheet, each leading to its screen
const GroupSheet = (props: GroupSheetProps) => {
    const { label, ledgers } = props;

    return (
        <Sheet label={label}>
            <CardList>
                {ledgers.map((ledger) => (
                    <li key={ledger.group.id}>
                        <GroupRow ledger={ledger} />
                    </li>
                ))}
            </CardList>
        </Sheet>
    );
};

// The name and, under it, the person's balance in an open group, or why a closed one is closed and whether it is in
// their expenses. A ledger the device never pulled has no balance to tell.
const GroupRow = (props: GroupRowProps) => {
    const { ledger, card, pins } = props;
    const { group, entries, hasData } = ledger;
    const t = useTranslations('groups.row');
    const words = useGroupWords(group);
    const rowClsx = clsx('group-row', { 'group-row--card': card });
    const body = (
        <span className="group-row__body">
            <span className="group-row__name">{words.title}</span>
            {words.closed === null ? (
                hasData && <span className="group-row__detail">{words.row(myBalance(group, entries))}</span>
            ) : (
                <span className="group-row__detail">
                    <span>{t(words.closed)}</span>
                    <span>{group.showInExpenses ? t('shown') : t('hidden')}</span>
                </span>
            )}
        </span>
    );

    if (!card) {
        return (
            <Link className={rowClsx} to="/groups/$groupId" params={{ groupId: group.id }}>
                {body}
                <Icon name="chevron_right" />
            </Link>
        );
    }

    return (
        <>
            <Link className={rowClsx} to="/groups/$groupId" params={{ groupId: group.id }}>
                {body}
            </Link>
            {pins && group.closed === null && <PinButton group={group} name={words.title} pins={pins} />}
            <Icon name="chevron_right" />
        </>
    );
};

export { GroupList, GroupSheet, type GroupListProps, type GroupSheetProps };
