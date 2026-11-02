import type { GroupMember } from '@core/shared-group';

interface NameWords {
    // A member whose name is empty: a person who deleted their account
    deleted: string;
    // A name that a member listed before them has too
    numbered: (name: string, number: number) => string;
}

// The name the screens show for each member who isn't merged into another: the stored one, "Deleted user" when it is
// empty, and a number after a name an earlier member has too, ignoring case
const memberNames = (members: readonly GroupMember[], words: NameWords): Map<string, string> => {
    const seen = new Map<string, number>();
    const names = new Map<string, string>();

    for (const member of members) {
        if (member.mergedInto !== null) continue;
        const name = member.name || words.deleted;
        const key = name.toLowerCase();
        const number = (seen.get(key) ?? 0) + 1;
        seen.set(key, number);
        names.set(member.id, number === 1 ? name : words.numbered(name, number));
    }

    return names;
};

export { memberNames, type NameWords };
