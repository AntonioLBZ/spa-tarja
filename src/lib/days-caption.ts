// The words of a range of days, each end already written as the screen writes a day; an empty end is open
interface DaysWords {
    all: string;
    from: (from: string) => string;
    to: (to: string) => string;
    between: (from: string, to: string) => string;
}

// The days a table holds, in words: every day, from one, up to one, or between two
const daysCaption = (from: string, to: string, words: DaysWords): string => {
    if (from && to) return words.between(from, to);
    if (from) return words.from(from);
    if (to) return words.to(to);
    return words.all;
};

export { daysCaption, type DaysWords };
