import { Button } from '@/components/button/button';
import { Field, FieldBox } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Field/Examples',
    component: Field,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return <Field label="Expense">{(control) => <input type="text" {...control} />}</Field>;
};

export const Hint = () => {
    return (
        <Field label="Your email" hint="Type it to confirm.">
            {(control) => <input type="email" {...control} />}
        </Field>
    );
};

export const Invalid = () => {
    return (
        <Field label="Amount" error="Type an amount above zero.">
            {(control) => <input type="text" inputMode="decimal" defaultValue="0" {...control} />}
        </Field>
    );
};

export const Placeholder = () => {
    return (
        <Field label="Amount" placeholder="0.00">
            {(control) => <input type="text" inputMode="decimal" {...control} />}
        </Field>
    );
};

export const WithIcon = () => {
    return (
        <Field label="Search" icon={<Icon name="search" />}>
            {(control) => <input type="search" {...control} />}
        </Field>
    );
};

export const Suffix = () => {
    return (
        <Field label="Ana's part, in percent" suffix="%">
            {(control) => <input type="text" inputMode="decimal" defaultValue="25" {...control} />}
        </Field>
    );
};

export const Actions = () => {
    return (
        <Field
            label="Income"
            actions={
                <Button ghost glyph aria-label="Save">
                    <Icon name="check" />
                </Button>
            }
        >
            {(control) => <input type="text" inputMode="decimal" defaultValue="1,800.00" {...control} />}
        </Field>
    );
};

export const Box = () => {
    return (
        <FieldBox suffix="%">
            <input type="text" inputMode="decimal" aria-label="Ana's part, in percent" placeholder="0" />
        </FieldBox>
    );
};

export default Story;
