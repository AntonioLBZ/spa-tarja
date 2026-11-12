import { About as AboutComponent } from '@/features/about/about';

import { AppData } from './app-data';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/About',
};

export const About = () => {
    return <AppData>{() => <AboutComponent />}</AppData>;
};

export default Story;
