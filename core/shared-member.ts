// What the maths reads of a member of a group. Lists of members are in the group's order: when they were added, then
// by id.
interface SharedMember {
    id: string;
    // The member a placeholder was merged into, whom its id stands for from then on
    mergedInto: string | null;
}

// The member an id stands for: the end of its chain of merges, or itself when it was never merged. The server merges a
// placeholder only into a user, who is never merged, so the chain is one step (ADR-0014); a longer one is still followed,
// and a loop, a member merged into itself included, reads as the member of the loop that comes first in the group.
const canonicalMember = (members: readonly SharedMember[], memberId: string): string => {
    const path: string[] = [];
    let current = memberId;

    for (;;) {
        const next = members.find((member) => member.id === current)?.mergedInto ?? null;
        if (next === null) return current;
        path.push(current);
        if (path.includes(next)) {
            const loop = path.slice(path.indexOf(next));
            return members.find((member) => loop.includes(member.id))?.id ?? next;
        }
        current = next;
    }
};

export { canonicalMember, type SharedMember };
