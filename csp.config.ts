import { createHash } from 'node:crypto';

// What stands, in the policy of the static files, for the hashes of the page's inline scripts until a build puts them in
const SCRIPT_HASHES_MARKER = '%INLINE_SCRIPT_HASHES%';

// A browser hashes the text between the tags once its parser has made every line break a line feed
const hashOf = (code: string) => {
    return `sha256-${createHash('sha256').update(code.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}`;
};

// The hash of every script written in the page: a `<script>` with no `src`
const inlineScriptHashes = (html: string) => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
    return scripts
        .filter(([, attributes = '']) => !/\ssrc\s*=/i.test(attributes))
        .map(([, , code = '']) => hashOf(code));
};

// The headers of a build: the marker gives way to the hash of each inline script of its page, so the policy can't fall
// out of step with the page
const withScriptHashes = (headers: string, html: string) => {
    const marker = ` ${SCRIPT_HASHES_MARKER}`;
    if (!headers.includes(marker)) throw new Error(`the headers no longer hold ${SCRIPT_HASHES_MARKER}`);
    return headers.replace(
        marker,
        inlineScriptHashes(html)
            .map((hash) => ` '${hash}'`)
            .join('')
    );
};

export { SCRIPT_HASHES_MARKER, inlineScriptHashes, withScriptHashes };
