import { Button } from '@/components/button/button';
import { CountUp as CountUpComponent, type CountUpProps } from '@/components/count-up/count-up';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const euros = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;

const Story: Meta<CountUpProps> = {
    title: 'Components/CountUp',
    component: CountUpComponent,
    args: { value: 41230, format: euros },
};

export const CountUp = (args: CountUpProps) => {
    const [value, setValue] = useState(args.value);

    return (
        <div style={{ display: 'grid', gap: '1rem', justifyItems: 'start' }}>
            <p style={{ fontSize: 'var(--font-size-hero)', fontWeight: 'var(--font-weight-display)', margin: 0 }}>
                <CountUpComponent {...args} value={value} />
            </p>
            <Button onClick={() => setValue(Math.round(Math.random() * 200000))}>Change it</Button>
        </div>
    );
};

export default Story;
