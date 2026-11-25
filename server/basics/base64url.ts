const toBase64Url = (bytes: ArrayBuffer | Uint8Array): string => {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
    const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export { fromBase64Url, toBase64Url };
