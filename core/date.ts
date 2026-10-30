// Expense dates are the day the person picked, as YYYY-MM-DD text, so no time zone can shift them
const isCalendarDate = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

// The calendar day of a Date in the device's own time zone
const toDateString = (date: Date): string => {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// The inverse of toDateString, for showing a stored day without a time zone shifting it
const fromDateString = (value: string): Date => {
    const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const pad = (amount: number, size: number) => String(amount).padStart(size, '0');

const parseDay = (value: string): [number, number, number] => {
    const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
    return [year, month, day];
};

// Midnight UTC of a day, whose month and day may overflow into the next ones. Date.UTC alone reads the years 0 to 99
// as 1900 to 1999.
const utcDate = (year: number, month: number, day: number): Date => {
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    return date;
};

const formatUtc = (date: Date): string => {
    return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
};

// The same day some months later, or the last day of that month when it has no such day (31 Jan + 1 month is 28 Feb)
const addMonths = (value: string, months: number): string => {
    const [year, month, day] = parseDay(value);
    const target = year * 12 + (month - 1) + months;
    const targetYear = Math.floor(target / 12);
    const targetMonth = target % 12;
    const lastDay = utcDate(targetYear, targetMonth + 2, 0).getUTCDate();
    return `${pad(targetYear, 4)}-${pad(targetMonth + 1, 2)}-${pad(Math.min(day, lastDay), 2)}`;
};

// The same day some days later, or earlier when the number is negative
const addDays = (value: string, days: number): string => {
    const [year, month, day] = parseDay(value);
    return formatUtc(utcDate(year, month, day + days));
};

// The Monday of the week a day is in, which is where weeks start in the app
const startOfWeek = (value: string): string => {
    const [year, month, day] = parseDay(value);
    const sinceMonday = (utcDate(year, month, day).getUTCDay() + 6) % 7;
    return addDays(value, -sinceMonday);
};

// The last day of the month a day is in
const endOfMonth = (value: string): string => {
    return addDays(addMonths(`${value.slice(0, 7)}-01`, 1), -1);
};

// How many days later the second one is, negative when it is earlier
const daysBetween = (from: string, to: string): number => {
    const [fromYear, fromMonth, fromDay] = parseDay(from);
    const [toYear, toMonth, toDay] = parseDay(to);
    const difference = utcDate(toYear, toMonth, toDay).getTime() - utcDate(fromYear, fromMonth, fromDay).getTime();
    return Math.round(difference / 86_400_000);
};

export { addDays, addMonths, daysBetween, endOfMonth, fromDateString, isCalendarDate, startOfWeek, toDateString };
