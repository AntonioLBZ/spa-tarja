import { SignInScreen as SignInScreenComponent, type SignInScreenProps } from '@/features/auth/sign-in-screen';
import { AuthProvider } from '@/lib/auth';
import { createFakeAuth } from '@/lib/test/fake-auth';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<SignInScreenProps> = {
    title: 'Features/SignInScreen',
    component: SignInScreenComponent,
    args: { unreachable: false },
    parameters: { layout: 'fullscreen' },
};

export const SignInScreen = (args: SignInScreenProps) => {
    // Nobody is signed in, which is what the screen is for
    const [auth] = useState(() => createFakeAuth({ session: null, cached: null }).auth);

    return (
        <AuthProvider auth={auth}>
            <SignInScreenComponent {...args} />
        </AuthProvider>
    );
};

export default Story;
