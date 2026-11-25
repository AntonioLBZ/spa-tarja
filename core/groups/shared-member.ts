// What the maths reads of a member of a group. Lists of members are in the group's order: when they were added, then
// by id.
interface SharedMember {
    id: string;
    // The member a placeholder was merged into, whom its id stands for from then on
    mergedInto: string | null;
}

interface Resolver {
    mergedInto: Map<string, string | null>;
    resolved: Map<string, string>;
}

// What each id of a list of members stands for, worked out once per list and id: the balances ask it for every share of
// every entry, and a group may have thousands of entries and dozens of members. A list is never changed in place.
const resolvers = new WeakMap<readonly SharedMember[], Resolver>();

const resolverOf = (members: readonly SharedMember[]): Resolver => {
    let resolver = resolvers.get(members);
    if (!resolver) {
        resolver = {
            mergedInto: new Map(members.map((member) => [member.id, member.mergedInto])),
            resolved: new Map(),
        };
        resolvers.set(members, resolver);
    }
    return resolver;
};

// The member an id stands for: the end of its chain of merges, or itself when it was never merged. The server merges a
// placeholder only into a user, who is never merged, so the chain is one step (ADR-0014); a longer one is still followed,
// and a loop, a member merged into itself included, reads as the member of the loop that comes first in the group.
const canonicalMember = (members: readonly SharedMember[], memberId: string): string => {
    const { mergedInto, resolved } = resolverOf(members);
    const known = resolved.get(memberId);
    if (known !== undefined) return known;

    const path: string[] = [];
    let current = memberId;
    let id: string;
    for (;;) {
        const next = mergedInto.get(current) ?? null;
        if (next === null) {
            id = current;
            break;
        }
        path.push(current);
        if (path.includes(next)) {
            const loop = path.slice(path.indexOf(next));
            id = members.find((member) => loop.includes(member.id))?.id ?? next;
            break;
        }
        current = next;
    }
    resolved.set(memberId, id);
    return id;
};

export { canonicalMember, type SharedMember };
