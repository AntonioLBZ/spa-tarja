// The server answered, and the answer wasn't a success; a request that never got an answer throws something else
class ApiError extends Error {
    readonly status: number;
    // The `error` the Worker put in the body, when it did
    readonly code: string | null;

    constructor(status: number, code: string | null = null) {
        super(`Request failed with status ${status}`);
        this.status = status;
        this.code = code;
    }
}

async function toApiError(response: { status: number; json: () => Promise<unknown> }): Promise<ApiError> {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    return new ApiError(response.status, typeof body?.error === 'string' ? body.error : null);
}

export { ApiError, toApiError };
