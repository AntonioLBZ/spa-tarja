// What the maths reads of a member of a group. Lists of members are in the group's order: when they were added, then
// by id.
interface SharedMember {
    id: string;
    // The member a placeholder was merged into, whom its id stands for from then on
    mergedInto: string | null;
}

// The member an id stands for: the one a placeholder was merged into, or else itself. A placeholder is merged only into
// a member who is a user, who is never merged in turn, so one step is enough (ADR-0014).
const canonicalMember = (members: readonly SharedMember[], memberId: string): string => {
    return members.find((member) => member.id === memberId)?.mergedInto ?? memberId;
};

export { canonicalMember, type SharedMember };
