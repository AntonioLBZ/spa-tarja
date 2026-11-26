import { Field } from '@/components/field/field';
import { SpokenHint } from '@/components/field/spoken-hint';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/SpokenHint/Examples',
    component: SpokenHint,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    const [value, setValue] = useState('25');
    const left = 100 - (Number(value) || 0);

    return (
        <>
            <Field label="Ana's part, in percent" suffix="%">
                {(control) => (
                    <input
                        {...control}
                        inputMode="decimal"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                    />
                )}
            </Field>
            <SpokenHint>{value !== '' && left > 0 && `${left}% left`}</SpokenHint>
        </>
    );
};

export default Story;
