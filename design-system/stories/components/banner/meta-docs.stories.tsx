import { BannerProvider, useBanner } from '@/components/banner/banner';
import { SampleFrame } from '@stories/shared/frame';
import { useEffect, useEffectEvent } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Banner/Examples',
    component: BannerProvider,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
    decorators: [
        (Story) => (
            <SampleFrame>
                <Story />
            </SampleFrame>
        ),
    ],
};

// A little longer than a banner stays, so the example always has one
const AGAIN_MS = 9_000;

const ShowNotice = () => {
    const banner = useBanner();
    const show = useEffectEvent(() =>
        banner.show({ title: 'Flat', message: 'Ana added Dinner · your part €6.25', onOpen: () => undefined })
    );

    useEffect(() => {
        show();
        const timer = setInterval(() => show(), AGAIN_MS);
        return () => clearInterval(timer);
    }, []);

    return null;
};

export const Basic = () => {
    return (
        <BannerProvider dismissLabel="Dismiss">
            <ShowNotice />
        </BannerProvider>
    );
};

export default Story;
