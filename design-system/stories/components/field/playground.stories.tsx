import { Button } from '@/components/button/button';
import { Field } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';
import { ICON_CONTROL, iconOf, type IconChoice } from '@stories/shared/icons';
import { StoryNarrow } from '@stories/shared/layout';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

interface FieldStoryProps {
    label: string;
    hint: string;
    /** Empty for no problem */
    error: string;
    placeholder: string;
    suffix: string;
    icon: IconChoice;
    /** A button beside the box, as the Save of a field that is a form of its own */
    withAction: boolean;
    onAction: () => void;
}

const Story: Meta<FieldStoryProps> = {
    title: 'Components/Field',
    args: {
        label: 'Amount',
        hint: '',
        error: '',
        placeholder: '',
        suffix: '',
        icon: 'none',
        withAction: false,
        onAction: fn(),
    },
    argTypes: {
        label: { control: 'text' },
        hint: { control: 'text' },
        error: { control: 'text' },
        placeholder: { control: 'text' },
        suffix: { control: 'text' },
        icon: ICON_CONTROL,
        onAction: { table: { disable: true } },
    },
};

export const Playground = (args: FieldStoryProps) => {
    const { label, icon, withAction, onAction, hint, error, suffix, placeholder } = args;

    return (
        <StoryNarrow>
            <Field
                label={label}
                hint={hint || undefined}
                error={error || undefined}
                suffix={suffix || undefined}
                placeholder={placeholder || undefined}
                icon={iconOf(icon)}
                actions={
                    withAction ? (
                        <Button ghost glyph aria-label="Save" onClick={onAction}>
                            <Icon name="check" />
                        </Button>
                    ) : undefined
                }
            >
                {(control) => <input type="text" {...control} />}
            </Field>
        </StoryNarrow>
    );
};

export default Story;
