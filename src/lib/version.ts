// The version of this build: the number of the release, plus the commit in the prerelease, where every push is a new
// build of the same number
const appVersion = (): string => {
    const version: string = import.meta.env.VITE_APP_VERSION || 'dev';
    const commit: string = import.meta.env.VITE_APP_COMMIT || '';
    return commit ? `${version}+${commit}` : version;
};

export { appVersion };
