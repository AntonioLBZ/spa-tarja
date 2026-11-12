import { Button } from '@/components/button/button';
import { Card, CardList } from '@/components/card/card';
import { Icon } from '@/components/icon/icon';
import clsx from 'clsx';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

import './pinned-group-pin.css';

type Place = 'before-chevron' | 'start' | 'mark';

interface Option {
    place: Place;
    title: string;
    note: string;
}

const OPTIONS: readonly Option[] = [
    {
        place: 'before-chevron',
        title: '1. Pin before the chevron (built)',
        note: 'A ghost glyph button on the right of the card, just before the chevron. The link still covers the whole card; the pin sits over it. Outlined while not pinned, filled while pinned. Easy to reach with the thumb, and the name keeps the start of the row.',
    },
    {
        place: 'start',
        title: '2. Pin at the start',
        note: 'The same button before the name. A pinned group reads as marked at a glance, but every name moves right by the width of a touch target, and the names stop lining up with the headings of the sections.',
    },
    {
        place: 'mark',
        title: '3. A mark only, pinned from the settings',
        note: 'No button on the card: a small filled pin after the name of a pinned group, and pinning only in Edit group. The quietest list, but two taps more to pin, and the owner asked for the button.',
    },
];

const ROWS = [
    { name: 'Flat on Calle Mayor', detail: 'You owe €12.50' },
    { name: 'Trip to the mountains 2026', detail: 'Bea owes you €8.00' },
    { name: 'Car', detail: 'Settled' },
];

interface RowsProps {
    place: Place;
}

const Rows = (props: RowsProps) => {
    const { place } = props;
    const [pinned, setPinned] = useState<readonly string[]>([ROWS[0]!.name]);
    const full = pinned.length >= 2;

    const toggle = (name: string) => {
        setPinned((list) => (list.includes(name) ? list.filter((item) => item !== name) : [...list, name]));
    };

    return (
        <div className="pin-lab__rows">
            {full && place !== 'mark' && (
                <p className="pin-lab__full">You can pin 2 groups to Expenses. Unpin one to pin another.</p>
            )}
            <CardList>
                {ROWS.map((row) => {
                    const isPinned = pinned.includes(row.name);
                    const button = (
                        <Button
                            ghost
                            glyph
                            className="pin-lab__pin"
                            aria-label={`Pin ${row.name} to Expenses`}
                            aria-pressed={isPinned}
                            disabled={full && !isPinned}
                            onClick={() => toggle(row.name)}
                        >
                            <Icon name={isPinned ? 'keep_filled' : 'keep'} />
                        </Button>
                    );
                    const cardClsx = clsx('pin-lab__card', `pin-lab__card--${place}`);

                    return (
                        <Card as="li" className={cardClsx} key={row.name}>
                            {place === 'start' && button}
                            <span className="pin-lab__body">
                                <span className="pin-lab__name">
                                    <span className="pin-lab__text">{row.name}</span>
                                    {place === 'mark' && isPinned && (
                                        <span className="pin-lab__mark">
                                            <Icon name="keep_filled" />
                                        </span>
                                    )}
                                </span>
                                <span className="pin-lab__detail">{row.detail}</span>
                            </span>
                            {place === 'before-chevron' && button}
                            <Icon name="chevron_right" />
                        </Card>
                    );
                })}
            </CardList>
        </div>
    );
};

const Story: Meta = {
    title: 'Lab/Pinned group pin',
    parameters: { layout: 'padded' },
};

export const PinnedGroupPin = () => {
    return (
        <div className="pin-lab">
            <p className="pin-lab__intro">
                Where the pin goes on a card of the Groups screen. Press a pin: with two pinned, the others are off and
                a short line says why. The first one is what the app has now. Check them at 320 px in the toolbar.
            </p>
            <div className="pin-lab__options">
                {OPTIONS.map((option) => (
                    <section className="pin-lab__option" key={option.place}>
                        <h2 className="pin-lab__title">{option.title}</h2>
                        <Rows place={option.place} />
                        <p className="pin-lab__note">{option.note}</p>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default Story;
