import { BannerProvider, useBanner, type BannerOptions } from '@/components/banner/banner';
import { Button } from '@/components/button/button';
import { StoryRow } from '@stories/shared/layout';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

type BannerStoryProps = Pick<BannerOptions, 'title' | 'message' | 'onOpen'>;

const Buttons = (props: BannerStoryProps) => {
    const banner = useBanner();

    return (
        <StoryRow>
            <Button onClick={() => banner.show(props)}>Show</Button>
            <Button onClick={() => banner.dismiss()}>Take it away</Button>
        </StoryRow>
    );
};

const Story: Meta<BannerStoryProps> = {
    title: 'Components/Banner',
    args: { title: 'Flat', message: 'Ana added Dinner · your part €6.25', onOpen: fn() },
    argTypes: {
        title: { control: 'text' },
        message: { control: 'text' },
        onOpen: { table: { disable: true } },
    },
};

export const Playground = (args: BannerStoryProps) => {
    return (
        <BannerProvider dismissLabel="Dismiss">
            <Buttons {...args} />
        </BannerProvider>
    );
};

export default Story;
