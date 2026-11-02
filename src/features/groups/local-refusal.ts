// Why the device refused a change before it reached the server: there is no connection, the group is read-only for the
// person (closed, or not on the device), or it still has writes of theirs that could not be sent
type LocalRefusalCode = 'offline' | 'read-only' | 'unsynced';

class LocalRefusal extends Error {
    readonly code: LocalRefusalCode;

    constructor(code: LocalRefusalCode, options?: ErrorOptions) {
        super(`Refused on the device: ${code}`, options);
        this.code = code;
    }
}

export { LocalRefusal, type LocalRefusalCode };
