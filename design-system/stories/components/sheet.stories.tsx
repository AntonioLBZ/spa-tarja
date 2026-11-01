import { Sheet as SheetComponent, type SheetProps } from '@/components/sheet/sheet';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<SheetProps> = {
    title: 'Components/Sheet',
    component: SheetComponent,
    args: { label: 'Yours', level: 'h2' },
    argTypes: {
        label: { control: 'text' },
        level: { control: 'inline-radio', options: ['h2', 'h3'] },
        children: { control: false },
    },
};

export const Sheet = (args: SheetProps) => {
    return (
        <SheetComponent {...args}>
            <p style={{ margin: 0 }}>Whatever goes on the sheet: rows, a total, a note.</p>
        </SheetComponent>
    );
};

export default Story;
