import { ScreenTitle as ScreenTitleComponent, type ScreenTitleProps } from '@/components/screen-title/screen-title';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<ScreenTitleProps> = {
    title: 'Components/ScreenTitle',
    component: ScreenTitleComponent,
    args: { children: 'Expenses' },
    argTypes: { children: { control: 'text' } },
};

export const ScreenTitle = (args: ScreenTitleProps) => {
    return (
        <>
            <ScreenTitleComponent {...args} />
            <p className="hint">The title of this page is now “{args.children} – Tarja”.</p>
        </>
    );
};

export default Story;
