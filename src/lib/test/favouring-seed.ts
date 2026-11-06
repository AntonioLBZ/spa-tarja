import { splitEqually } from '@core/split';

// A seed that gives the cent left of 10.00 split equally among three to the member at the index
const seedFavouring = (index: number): number => {
    const members = ['first', 'second', 'third'];
    for (let seed = 0; ; seed++) {
        if (splitEqually(1000, members, seed)?.find((item) => item.memberId === members[index])?.cents === 334) {
            return seed;
        }
    }
};

export { seedFavouring };
