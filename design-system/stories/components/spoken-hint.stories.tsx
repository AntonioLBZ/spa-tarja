import { Field } from '@/components/field/field';
import { SpokenHint as SpokenHintComponent } from '@/components/field/spoken-hint';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/SpokenHint',
};

export const SpokenHint = () => {
    const [value, setValue] = useState('');
    const left = 100 - (Number(value) || 0);

    return (
        <div style={{ display: 'grid', gap: 'var(--size-2)' }}>
            <Field label="Percent">
                {(control) => (
                    <input {...control} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
                )}
            </Field>
            <SpokenHintComponent>{value !== '' && left > 0 && `${left}% left`}</SpokenHintComponent>
        </div>
    );
};

export default Story;
