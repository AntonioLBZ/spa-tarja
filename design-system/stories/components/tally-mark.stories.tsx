import { TallyMark as TallyMarkComponent, type TallyMarkProps } from '@/components/tally-mark/tally-mark';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<TallyMarkProps> = {
    title: 'Components/TallyMark',
    component: TallyMarkComponent,
    argTypes: { className: { control: false } },
};

// Reload the story to see it draw itself
export const TallyMark = (args: TallyMarkProps) => {
    return <TallyMarkComponent {...args} />;
};

export default Story;
