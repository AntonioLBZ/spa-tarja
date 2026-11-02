import { Link } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { CardList } from '@/components/card/card';
import { Icon } from '@/components/icon/icon';
import { Sheet } from '@/components/sheet/sheet';

import { myBalance } from './my-balance';
import { useGroupWords } from './use-group-words';

import type { Ledger } from './use-ledgers';

import './group-list.css';

interface GroupListProps {
    label: string;
    ledgers: readonly Ledger[];
}

interface GroupRowProps {
    ledger: Ledger;
}

// Groups or friends on a sheet, each leading to its screen
const GroupList = (props: GroupListProps) => {
    const { label, ledgers } = props;

    return (
        <Sheet label={label}>
            <CardList>
                {ledgers.map((ledger) => (
                    <GroupRow key={ledger.group.id} ledger={ledger} />
                ))}
            </CardList>
        </Sheet>
    );
};

// The name and, under it, the person's balance in an open group, or why a closed one is closed and whether it is in
// their expenses. A ledger the device never pulled has no balance to tell.
const GroupRow = (props: GroupRowProps) => {
    const { ledger } = props;
    const { group, entries, hasData } = ledger;
    const t = useTranslations('groups.row');
    const words = useGroupWords(group);

    return (
        <li>
            <Link className="group-row" to="/groups/$groupId" params={{ groupId: group.id }}>
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
        </li>
    );
};

export { GroupList, type GroupListProps };
