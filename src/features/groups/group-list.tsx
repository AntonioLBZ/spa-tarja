import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { useTranslations } from 'use-intl';

import { Card, CardList } from '@/components/card/card';
import { Icon } from '@/components/icon/icon';
import { Sheet } from '@/components/sheet/sheet';

import { myBalance } from './my-balance';
import { useGroupWords } from './use-group-words';

import type { Ledger } from './use-ledgers';

import './group-list.css';

interface GroupListProps {
    ledgers: readonly Ledger[];
}

interface GroupSheetProps extends GroupListProps {
    label: string;
}

interface GroupRowProps {
    ledger: Ledger;
    // On a card of its own, which the whole row fills, instead of on paper
    card?: boolean;
}

// Groups or friends as cards, each leading to its screen, under the heading of their section
const GroupList = (props: GroupListProps) => {
    const { ledgers } = props;

    return (
        <CardList>
            {ledgers.map((ledger) => (
                <Card key={ledger.group.id} as="li" className="group-card">
                    <GroupRow card ledger={ledger} />
                </Card>
            ))}
        </CardList>
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
    const { ledger, card } = props;
    const { group, entries, hasData } = ledger;
    const t = useTranslations('groups.row');
    const words = useGroupWords(group);
    const rowClsx = clsx('group-row', { 'group-row--card': card });

    return (
        <Link className={rowClsx} to="/groups/$groupId" params={{ groupId: group.id }}>
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
            <Icon name="chevron_right" />
        </Link>
    );
};

export { GroupList, GroupSheet, type GroupListProps, type GroupSheetProps };
