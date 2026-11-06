// A random 32-bit whole number, which works outside a secure context too
const randomSeed = (): number => {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
};

export { randomSeed };
