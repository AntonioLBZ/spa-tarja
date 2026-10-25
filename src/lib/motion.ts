// A duration token of tokens.css, in milliseconds; 0 when it is missing or reduced motion has zeroed it
function readDuration(name: string): number {
    const amount = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isNaN(amount) ? 0 : amount;
}

export { readDuration };
