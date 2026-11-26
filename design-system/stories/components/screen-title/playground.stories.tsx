import { ScreenTitle } from '@/components/screen-title/screen-title';

import type { Meta } from '@storybook/react-vite';

interface ScreenTitleStoryProps {
    children: string;
}

const Story: Meta<ScreenTitleStoryProps> = {
    title: 'Components/ScreenTitle',
    args: { children: 'Expenses' },
    argTypes: { children: { control: 'text' } },
};

export const Playground = (args: ScreenTitleStoryProps) => {
    return (
        <>
            <ScreenTitle {...args} />
            <p className="hint">The title of this page is now “{args.children} – Tarja”.</p>
        </>
    );
};

export default Story;
