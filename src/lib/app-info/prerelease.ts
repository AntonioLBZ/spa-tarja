// Whether this build was made for the prerelease environment
const isPrerelease = (): boolean => {
    return import.meta.env.VITE_PRERELEASE === 'true';
};

export { isPrerelease };
