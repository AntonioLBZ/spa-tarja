// A duration token, in milliseconds; 0 when it is missing or reduced motion has zeroed it. The built stylesheet may
// spell it in seconds.
const readDuration = (name: string): number => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const amount = Number.parseFloat(value);
    if (Number.isNaN(amount)) {
        return 0;
    }
    return /\d\s*s$/.test(value) && !value.endsWith('ms') ? amount * 1000 : amount;
};

export { readDuration };
