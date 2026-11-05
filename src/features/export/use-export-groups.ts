import { useGroupTitles } from '@/features/groups/use-group-options';
import { useGroups, useLedgers } from '@/features/groups/use-ledgers';

// The groups the files are made from: every group and friend the device holds, closed ones and those that stay out of
// the person's expenses included, with its entries, and what the screens call each. A group whose entries haven't reached
// the device is left out, as an empty list would say it has none.
const useExportGroups = () => {
    const { groups } = useGroups();
    const { ledgers } = useLedgers();
    const titles = useGroupTitles(groups);

    return { ledgers: ledgers.filter((ledger) => ledger.hasData), titles };
};

export { useExportGroups };
