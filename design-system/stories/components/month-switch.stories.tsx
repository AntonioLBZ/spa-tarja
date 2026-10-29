import { MonthSwitch } from '@/components/month-switch/month-switch';
import { useLocale } from '@/lib/i18n';
import { fromDateString } from '@core/date';
import { shiftMonth } from '@core/month';
import { useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import type { Meta, StoryObj } from '@storybook/react-vite';

// The month moves and is named the way the Summary does it, with the labels of the chosen language
function MonthSwitchDemo() {
    const t = useTranslations('monthSwitch');
    const { locale } = useLocale();
    const [month, setMonth] = useState('2026-10');
    const format = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);

    return (
        <MonthSwitch
            monthName={format.format(fromDateString(`${month}-01`))}
            labels={{ previous: t('previous'), next: t('next') }}
            onPrevious={() => setMonth(shiftMonth(month, -1))}
            onNext={() => setMonth(shiftMonth(month, 1))}
        />
    );
}

const meta = {
    title: 'Components/MonthSwitch',
    render: () => <MonthSwitchDemo />,
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

export default meta;
export { Default };
