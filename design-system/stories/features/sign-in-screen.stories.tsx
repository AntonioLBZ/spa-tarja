import { SignInScreen } from '@/features/auth/sign-in-screen';
import { AuthProvider } from '@/lib/auth';
import { createFakeAuth } from '@/lib/test/fake-auth';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Nobody is signed in, which is what the screen is for
function SignedOut(props: { unreachable: boolean }) {
    const { unreachable } = props;

    return (
        <AuthProvider auth={createFakeAuth({ session: null, cached: null }).auth}>
            <SignInScreen unreachable={unreachable} />
        </AuthProvider>
    );
}

const meta = {
    title: 'Features/SignInScreen',
    parameters: { layout: 'fullscreen' },
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default: Story = { render: () => <SignedOut unreachable={false} /> };

const ServerUnreachable: Story = { render: () => <SignedOut unreachable /> };

export default meta;
export { Default, ServerUnreachable };
