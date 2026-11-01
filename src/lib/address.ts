// Where the app lives, and the address it left
const NEW_HOST = 'tarja.albz.app';
const NEW_ADDRESS = `https://${NEW_HOST}`;
const OLD_HOST = 'tarja.antoniolbz.workers.dev';

const isOldAddress = (hostname: string) => {
    return hostname === OLD_HOST;
};

export { NEW_ADDRESS, NEW_HOST, isOldAddress };
