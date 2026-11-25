// A month is a year and a month of the calendar as YYYY-MM text, like the days it holds
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const isMonth = (value: string): boolean => {
    return MONTH.test(value);
};

// The month a YYYY-MM-DD day falls in
const monthOf = (day: string): string => {
    return day.slice(0, 7);
};

const shiftMonth = (month: string, months: number): string => {
    const [year = 0, number = 1] = month.split('-').map(Number);
    const target = year * 12 + (number - 1) + months;
    const pad = (amount: number, size: number) => String(amount).padStart(size, '0');
    return `${pad(Math.floor(target / 12), 4)}-${pad((target % 12) + 1, 2)}`;
};

export { isMonth, monthOf, shiftMonth };
