import { vi } from 'vitest';

// The languages the browser says it prefers; jsdom always says en-US. Undone by `vi.restoreAllMocks`.
const stubLanguages = (languages: readonly string[]) => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
};

export { stubLanguages };
