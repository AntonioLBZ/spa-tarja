// A name as a search reads it: without accents, in one case
const searchForm = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();

// Whether a name holds what was typed, ignoring case and accents; anything holds nothing typed
const matchesName = (name: string, query: string) => searchForm(name).includes(searchForm(query));

export { matchesName };
