import { useTranslations } from 'use-intl';

import { CardList } from '@/components/card/card';
import { Sheet } from '@/components/sheet/sheet';

import type { ReactNode, Ref } from 'react';

import './people-sheet.css';

interface PeopleRowProps {
    children: ReactNode;
}

interface PeopleSheetProps {
    // The label, which takes the focus when the row that had it leaves
    labelRef?: Ref<HTMLHeadingElement>;
    children: ReactNode;
}

// The people of a group on paper, one row each: in the settings of a group, and as they will be on a new one
const PeopleSheet = (props: PeopleSheetProps) => {
    const { labelRef, children } = props;
    const t = useTranslations('groups.people');

    return (
        <Sheet label={t('title')} labelRef={labelRef}>
            <CardList flush>{children}</CardList>
        </Sheet>
    );
};

// A row of the sheet with nothing to open: the person, and what can be done to them there
const PeopleRow = (props: PeopleRowProps) => {
    const { children } = props;

    return <li className="people-sheet__row">{children}</li>;
};

export { PeopleRow, PeopleSheet, type PeopleRowProps, type PeopleSheetProps };
