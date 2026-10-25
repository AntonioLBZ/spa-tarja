// Expense dates are the day the person picked, as YYYY-MM-DD text, so no time zone can shift them
function isCalendarDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// The calendar day of a Date in the device's own time zone
function toDateString(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// The inverse of toDateString, for showing a stored day without a time zone shifting it
function fromDateString(value: string): Date {
    const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// The same day some months later, or the last day of that month when it has no such day (31 Jan + 1 month is 28 Feb)
function addMonths(value: string, months: number): string {
    const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
    const target = year * 12 + (month - 1) + months;
    const targetYear = Math.floor(target / 12);
    const targetMonth = target % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const pad = (amount: number, size: number) => String(amount).padStart(size, '0');
    return `${pad(targetYear, 4)}-${pad(targetMonth + 1, 2)}-${pad(Math.min(day, lastDay), 2)}`;
}

export { addMonths, fromDateString, isCalendarDate, toDateString };
