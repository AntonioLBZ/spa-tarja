import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';
import { Sheet as SheetComponent, type SheetProps } from '@/components/sheet/sheet';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<SheetProps> = {
    title: 'Components/Sheet',
    component: SheetComponent,
    args: { label: 'Yours', level: 'h2' },
    argTypes: {
        label: { control: 'text' },
        level: { control: 'inline-radio', options: ['h2', 'h3'] },
        action: { control: false },
        children: { control: false },
    },
};

export const Sheet = (args: SheetProps) => {
    return (
        <SheetComponent
            {...args}
            action={
                <Button ghost small>
                    <Icon name="payments" />
                    Settle up
                </Button>
            }
        >
            <p style={{ margin: 0 }}>Whatever goes on the sheet: rows, a total, a note.</p>
        </SheetComponent>
    );
};

export default Story;
