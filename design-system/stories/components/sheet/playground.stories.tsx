import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';
import { Sheet } from '@/components/sheet/sheet';

import type { Meta } from '@storybook/react-vite';

interface SheetStoryProps {
    /** Empty for a sheet with no label */
    label: string;
    level: 'h2' | 'h3';
    /** A small action at the end of the label row */
    withAction: boolean;
}

const Story: Meta<SheetStoryProps> = {
    title: 'Components/Sheet',
    args: { label: 'Balances', level: 'h2', withAction: false },
    argTypes: {
        label: { control: 'text' },
        level: { control: 'inline-radio', options: ['h2', 'h3'] },
    },
};

export const Playground = (args: SheetStoryProps) => {
    const { label, level, withAction } = args;

    return (
        <Sheet
            label={label || undefined}
            level={level}
            action={
                withAction ? (
                    <Button ghost small>
                        <Icon name="payments" />
                        Settle up
                    </Button>
                ) : undefined
            }
        >
            <p className="story-flush">Whatever goes on the sheet: rows, a total, a note.</p>
        </Sheet>
    );
};

export default Story;
