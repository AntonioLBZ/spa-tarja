import { useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Notice } from '@/components/notice/notice';
import { useUser } from '@/lib/auth';
import { answerPushSuggestion, pushSuggestionAnswered } from '@/lib/push';

import { usePush } from './use-push';

import type { SharedGroup } from '@core/shared-group';

import './push-suggestion.css';

interface PushSuggestionProps {
    group: SharedGroup;
}

// Somebody else in the group who uses the app, who could add an expense with the person
const sharesWithSomebody = (group: SharedGroup) => {
    return group.members.some((member) => member.id !== group.me && member.claimed && member.leftAt === null);
};

// Suggests turning notifications on, once per device, on the screen of an open group with somebody else in it, while the
// browser has never been asked (ADR-0025). Either answer, or a refusal of the browser's prompt, puts it away for good.
const PushSuggestion = (props: PushSuggestionProps) => {
    const { group } = props;
    const t = useTranslations('groups.pushSuggestion');
    const user = useUser();
    const { state, permission, busy, turnOn } = usePush();
    const [answered, setAnswered] = useState(() => pushSuggestionAnswered(user.id));

    const answer = () => {
        answerPushSuggestion(user.id);
        setAnswered(true);
    };

    if (answered || group.closed !== null || !sharesWithSomebody(group)) return null;
    if (state !== 'off' || permission !== 'default') return null;

    return (
        <div className="push-suggestion">
            <Notice tone="quiet">{t('text')}</Notice>
            <div className="push-suggestion__actions">
                <Button
                    ghost
                    disabled={busy}
                    onClick={() => {
                        answer();
                        void turnOn();
                    }}
                >
                    {t('turnOn')}
                </Button>
                <Button ghost disabled={busy} onClick={answer}>
                    {t('notNow')}
                </Button>
            </div>
        </div>
    );
};

export { PushSuggestion };
