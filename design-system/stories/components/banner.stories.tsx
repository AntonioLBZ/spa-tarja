import { BannerProvider, useBanner } from '@/components/banner/banner';
import { Button } from '@/components/button/button';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

interface BannerStoryProps {
    title: string;
    message: string;
    // The text a second notice that comes while it shows puts in it
    summary: string;
    onOpen: () => void;
}

const BannerButtons = (props: BannerStoryProps) => {
    const { title, message, summary, onOpen } = props;
    const banner = useBanner();

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--size-4)', paddingTop: '8rem' }}>
            <Button onClick={() => banner.show({ title, message, onOpen })}>Show</Button>
            <Button onClick={() => banner.show({ title, message: summary, onOpen })}>Another one</Button>
            <Button onClick={() => banner.dismiss()}>Dismiss</Button>
        </div>
    );
};

const Story: Meta<BannerStoryProps> = {
    title: 'Components/Banner',
    args: {
        title: 'Flat',
        message: 'Ana added Dinner · your part €6.25',
        summary: '2 new expenses',
        onOpen: fn(),
    },
    argTypes: { title: { control: 'text' }, message: { control: 'text' }, summary: { control: 'text' } },
    parameters: { layout: 'fullscreen' },
};

export const Banner = (args: BannerStoryProps) => {
    return (
        <BannerProvider dismissLabel="Dismiss">
            <div style={{ padding: 'var(--size-4)' }}>
                <BannerButtons {...args} />
            </div>
        </BannerProvider>
    );
};

export default Story;
