import { ToastProvider, useToast, type ToastApi } from '@/components/toast/toast';
import { SampleFrame } from '@stories/shared/frame';
import { useEffect, useEffectEvent } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Toast/Examples',
    component: ToastProvider,
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

// A little longer than a toast stays, so the example always has one
const AGAIN_MS = 9_000;

interface ShowToastProps {
    show: (toast: ToastApi) => void;
}

const ShowToast = (props: ShowToastProps) => {
    const toast = useToast();
    const show = useEffectEvent(() => props.show(toast));

    useEffect(() => {
        show();
        const timer = setInterval(() => show(), AGAIN_MS);
        return () => clearInterval(timer);
    }, []);

    return null;
};

export const Basic = () => {
    return (
        <ToastProvider dismissLabel="Dismiss">
            <ShowToast
                show={(toast) =>
                    toast.show({ message: 'Expense deleted', action: { label: 'Undo', onAction: () => undefined } })
                }
            />
        </ToastProvider>
    );
};

export const Done = () => {
    return (
        <ToastProvider dismissLabel="Dismiss">
            <ShowToast show={(toast) => toast.show({ message: 'Expense added', icon: 'check' })} />
        </ToastProvider>
    );
};

export const Pinned = () => {
    return (
        <ToastProvider dismissLabel="Dismiss">
            <ShowToast
                show={(toast) =>
                    toast.pin({
                        message: 'A new version is ready',
                        actions: [
                            { label: 'Update', onAction: () => undefined },
                            { label: 'Later', onAction: () => undefined },
                        ],
                        onSwipeAway: () => undefined,
                    })
                }
            />
        </ToastProvider>
    );
};

export default Story;
