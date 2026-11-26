import { SignInScreen } from '@/features/auth/sign-in-screen';
import { AuthProvider } from '@/lib/auth';
import { createFakeAuth } from '@/lib/testing/fake-auth';

import type { Meta } from '@storybook/react-vite';

// Nobody is signed in, which is what the screen is for
const SIGNED_OUT = createFakeAuth({ session: null, cached: null }).auth;

const Story: Meta = {
    title: 'Features/SignInScreen',
    component: SignInScreen,
    tags: ['!dev'],
    decorators: [
        (Story) => (
            <AuthProvider auth={SIGNED_OUT}>
                <Story />
            </AuthProvider>
        ),
    ],
    parameters: {
        layout: 'fullscreen',
        docs: { source: { type: 'dynamic' }, story: { inline: false, iframeHeight: 640 } },
    },
};

export const Basic = () => {
    return <SignInScreen unreachable={false} deleted={null} />;
};

export const Unreachable = () => {
    return <SignInScreen unreachable deleted={null} />;
};

export const Deleted = () => {
    return <SignInScreen unreachable={false} deleted={{ cleared: true }} />;
};

export const DeletedNotCleared = () => {
    return <SignInScreen unreachable={false} deleted={{ cleared: false }} />;
};

export default Story;
