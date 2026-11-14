// The devices one entry is pushed to, at most `max`, so a request stays within the calls a Worker may make: the
// newest device of each person first, then their second newest, and so on; the devices come newest first
const pushTargets = <T extends { userId: string }>(devices: readonly T[], max: number): T[] => {
    const seen = new Map<string, number>();
    const ranked = devices.map((device, index) => {
        const rank = seen.get(device.userId) ?? 0;
        seen.set(device.userId, rank + 1);
        return { device, rank, index };
    });
    ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
    return ranked.slice(0, max).map(({ device }) => device);
};

export { pushTargets };
