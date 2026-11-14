import { useEffect, useState } from 'react';

import { useLocale } from '@/lib/i18n';
import { pushPermission, readPushSubscription, turnPushOff, turnPushOn } from '@/lib/push';

// Whether this device can show notifications and whether it does: they belong to the device, not to the account
type PushState = 'unsupported' | 'denied' | 'off' | 'on';

const usePush = () => {
    const { locale } = useLocale();
    const [permission, setPermission] = useState(pushPermission);
    const [subscribed, setSubscribed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let current = true;
        void readPushSubscription()
            .then((subscription) => current && setSubscribed(subscription !== null))
            .catch(() => undefined);
        return () => {
            current = false;
        };
    }, []);

    const run = async (work: () => Promise<void>) => {
        setBusy(true);
        setFailed(false);
        try {
            await work();
        } catch {
            setFailed(true);
        } finally {
            setBusy(false);
        }
    };

    const turnOn = () =>
        run(async () => {
            const answer = await turnPushOn(locale);
            setPermission(answer);
            setSubscribed(answer === 'granted');
        });

    const turnOff = () =>
        run(async () => {
            await turnPushOff();
            setSubscribed(false);
        });

    const state: PushState =
        permission === 'unsupported' ? 'unsupported' : permission === 'denied' ? 'denied' : subscribed ? 'on' : 'off';

    return { state, permission, busy, failed, turnOn, turnOff };
};

export { usePush, type PushState };
