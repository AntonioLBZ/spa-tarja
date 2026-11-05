import { useEffect, useState } from 'react';

import { useGroupTitles } from '@/features/groups/use-group-options';
import { useGroups, useLedgers } from '@/features/groups/use-ledgers';

const WAIT_MS = 10_000;

interface Answer {
    hasData: boolean;
    isError: boolean;
    isWaitingForNetwork: boolean;
}

// Whether what a query is asked for is still on its way: not here, not failed and not held back for want of a connection
const isOnItsWay = ({ hasData, isError, isWaitingForNetwork }: Answer) => !hasData && !isError && !isWaitingForNetwork;

// The groups the files are made from: every group and friend the device holds, closed ones and those that stay out of
// the person's expenses included, with its entries, and what the screens call each. A group whose entries haven't reached
// the device is left out, as an empty list would say it has none; `missing` says some are, and `loading` that the files
// wait for the first answer of the groups or of the entries of one, for ten seconds at most: after that a request that
// never answers counts as missing. A device that never heard of its groups has none to miss.
const useExportGroups = () => {
    const known = useGroups();
    const { ledgers } = useLedgers();
    const titles = useGroupTitles(known.groups);
    const [gaveUp, setGaveUp] = useState(false);
    const onItsWay = isOnItsWay(known) || ledgers.some(isOnItsWay);

    useEffect(() => {
        if (!onItsWay) return;
        const timer = setTimeout(() => setGaveUp(true), WAIT_MS);
        return () => clearTimeout(timer);
    }, [onItsWay]);

    return {
        ledgers: ledgers.filter((ledger) => ledger.hasData),
        titles,
        loading: onItsWay && !gaveUp,
        missing: ledgers.some((ledger) => !ledger.hasData && (gaveUp || !isOnItsWay(ledger))),
    };
};

export { useExportGroups };
