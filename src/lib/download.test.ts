import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadFile } from './download';

let revoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.useFakeTimers();
    revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:tarja' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
    vi.useRealTimers();
});

describe('downloadFile', () => {
    it('clicks a link with the name of the file and takes it out of the page', () => {
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');

        downloadFile('tarja.csv', 'a;b', 'text/csv');

        const link = click.mock.contexts[0] as HTMLAnchorElement;
        expect(link.download).toBe('tarja.csv');
        expect(link.href).toBe('blob:tarja');
        expect(document.body.contains(link)).toBe(false);
    });

    it('keeps the address of the file for a while, as a browser may read it well after the click', () => {
        downloadFile('tarja.csv', 'a;b', 'text/csv');

        vi.advanceTimersByTime(30_000);
        expect(revoke).not.toHaveBeenCalled();

        vi.advanceTimersByTime(10_000);
        expect(revoke).toHaveBeenCalledTimes(1);
        expect(revoke).toHaveBeenCalledWith('blob:tarja');
    });
});
