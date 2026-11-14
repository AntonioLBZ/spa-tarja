import { describe, expect, it } from 'vitest';

import { pushTargets } from './push-targets';

const device = (userId: string, n: number) => ({ userId, endpoint: `https://fcm.googleapis.com/${userId}/${n}` });

describe('pushTargets', () => {
    it('takes every device while they fit', () => {
        const devices = [device('ana', 1), device('ana', 2), device('bea', 1)];

        expect(pushTargets(devices, 5)).toEqual([device('ana', 1), device('bea', 1), device('ana', 2)]);
    });

    it("takes the newest device of each person before anybody's second one", () => {
        const devices = [device('ana', 1), device('ana', 2), device('ana', 3), device('bea', 1), device('carla', 1)];

        expect(pushTargets(devices, 4)).toEqual([
            device('ana', 1),
            device('bea', 1),
            device('carla', 1),
            device('ana', 2),
        ]);
    });
});
