import { useTranslations } from 'use-intl';

import { ButtonLink } from '@/components/button/button-link';
import { Icon } from '@/components/icon/icon';
import { backTarget, type BackTarget } from '@/lib/route-transition';

import { useShownPathname } from './shown-path';

const BACK_WORDS = {
    '/': 'expenses',
    '/groups': 'groups',
    '/groups/$groupId': 'group',
    '/summary': 'summary',
    '/settings': 'settings',
} as const satisfies Record<BackTarget['to'], string>;

// The link back to the parent of a screen deeper than a tab, named for the place it leads to; nothing on a tab
const BackLink = () => {
    const t = useTranslations('nav');
    const target = backTarget(useShownPathname());

    if (!target) return null;
    const place = t(BACK_WORDS[target.to]);
    const content = (
        <>
            <Icon name="chevron_left" />
            {place}
        </>
    );

    return 'params' in target ? (
        <ButtonLink ghost className="back-link" to={target.to} params={target.params} aria-label={t('back', { place })}>
            {content}
        </ButtonLink>
    ) : (
        <ButtonLink ghost className="back-link" to={target.to} aria-label={t('back', { place })}>
            {content}
        </ButtonLink>
    );
};

export { BackLink };
