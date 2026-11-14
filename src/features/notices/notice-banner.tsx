import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'use-intl';

import { useBanner } from '@/components/banner/banner';
import { groupTitle, memberNames } from '@/features/groups/member-names';
import { useScreenGroup } from '@/features/groups/use-screen-group';
import { GROUPS_KEY } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { subscribeNotices, useGroupWatcher } from '@/lib/offline';
import { formatAmount } from '@core/money';
import { canonicalMember } from '@core/shared-member';

import { wordNotices, type NoticeContext } from './notice-words';

import type { Notice } from '@core/notices';
import type { SharedGroup } from '@core/shared-group';

// Tells in a banner the new entries of others that concern the person, wherever the pull that brought them came from,
// but those of the group whose screen is showing, where the person sees them come in (ADR-0025)
const NoticeBanner = () => {
    useGroupWatcher();
    const client = useQueryClient();
    const router = useRouter();
    const banner = useBanner();
    const t = useTranslations('notices');
    const tGroups = useTranslations('groups');
    const { locale } = useLocale();
    const screenGroup = useScreenGroup()?.id ?? null;
    const onScreen = useRef(screenGroup);
    // What the banner showing holds, which a new notice adds to
    const shown = useRef<NoticeContext[]>([]);

    useEffect(() => {
        onScreen.current = screenGroup;
    }, [screenGroup]);

    useEffect(() => {
        const contextOf = (groups: readonly SharedGroup[], notice: Notice): NoticeContext[] => {
            const group = groups.find((item) => item.id === notice.groupId);
            if (!group || notice.groupId === onScreen.current) return [];
            const names = memberNames(group.members, {
                deleted: tGroups('names.deleted'),
                numbered: (name, number) => tGroups('names.numbered', { name, number }),
            });
            const nameOf = (memberId: string | null) =>
                (memberId && names.get(canonicalMember(group.members, memberId))) || tGroups('names.deleted');
            const isExpense = notice.kind === 'expense';
            const cents = isExpense ? notice.partCents : notice.amountCents;
            return [
                {
                    notice,
                    groupTitle: groupTitle(group, names),
                    actor: nameOf(isExpense ? notice.authorId : notice.counterpartId),
                    amount: formatAmount(cents, notice.currency, locale),
                },
            ];
        };

        return subscribeNotices(client, (notices) => {
            const groups = client.getQueryData<SharedGroup[]>(GROUPS_KEY) ?? [];
            const fresh = notices.flatMap((notice) => contextOf(groups, notice));
            if (fresh.length === 0) return;
            shown.current = [...shown.current, ...fresh];
            const { title, message } = wordNotices(t, shown.current);
            const ids = new Set(shown.current.map((context) => context.notice.groupId));
            const [only] = ids;
            banner.show({
                title,
                message,
                onOpen: () => {
                    if (ids.size === 1 && only)
                        void router.navigate({ to: '/groups/$groupId', params: { groupId: only } });
                    else void router.navigate({ to: '/groups' });
                },
                onGone: () => {
                    shown.current = [];
                },
            });
        });
    }, [client, router, banner, t, tGroups, locale]);

    return null;
};

export { NoticeBanner };
