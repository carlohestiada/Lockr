export class ApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

function csrfToken(): string {
    const cookie = document.cookie.split('; ').find((item) => item.startsWith('XSRF-TOKEN='));

    return cookie ? decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)) : '';
}

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers as Record<string, string> | undefined),
    };

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        const token = csrfToken();
        if (token) headers['X-XSRF-TOKEN'] = token;
    }

    const response = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: 'same-origin',
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errors = body.errors ? Object.values(body.errors).flat().join(' ') : body.message;
        const error = new ApiError(errors || `Request failed (${response.status}).`, response.status);

        if (response.status === 423) {
            window.dispatchEvent(new Event('vault:locked'));
        }

        throw error;
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
}
