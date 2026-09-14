import * as crypto from 'node:crypto';

export interface SignOptions {
    accessKeyId: string;
    secretAccessKey: string;
    method: string;
    path: string;
    query: URLSearchParams;
    body: string;
    host: string;
    region: string;
    service: string;
    sessionToken?: string;
}

export interface SignedHeaders {
    Authorization: string;
    Host: string;
    'X-Date': string;
    'X-Content-Sha256': string;
    'X-Security-Token'?: string;
}

const UNSIGNABLE_HEADERS = new Set([
    'authorization',
    'content-type',
    'content-length',
    'user-agent',
    'connection',
    'expect'
]);

function sha256Hex(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmac(key: crypto.BinaryLike | crypto.KeyObject, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function hmacHex(key: crypto.BinaryLike | crypto.KeyObject, data: string): string {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

function normalizeHeaderValue(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

function encodeRfc3986(value: string): string {
    return encodeURIComponent(value).replace(/[!'()*]/g, (ch) =>
        `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
    );
}

export function canonicalQuery(params: URLSearchParams): string {
    return Array.from(params.entries())
        .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
            const byKey = leftKey.localeCompare(rightKey);
            return byKey !== 0 ? byKey : leftValue.localeCompare(rightValue);
        })
        .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
        .join('&');
}

export function signVolcRequest(options: SignOptions): SignedHeaders {
    const now = new Date();
    const xDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const dateStamp = xDate.slice(0, 8);
    const payloadHash = sha256Hex(options.body);

    const headers: Record<string, string> = {
        host: options.host,
        'x-content-sha256': payloadHash,
        'x-date': xDate
    };
    if (options.sessionToken) {
        headers['x-security-token'] = options.sessionToken;
    }

    const signedKeys = Object.keys(headers)
        .filter((key) => !UNSIGNABLE_HEADERS.has(key.toLowerCase()))
        .sort();
    const signedHeaders = signedKeys.join(';');
    const canonicalHeaders = signedKeys
        .map((key) => `${key}:${normalizeHeaderValue(headers[key])}`)
        .join('\n');

    const canonicalRequest = [
        options.method.toUpperCase(),
        options.path || '/',
        canonicalQuery(options.query),
        `${canonicalHeaders}\n`,
        signedHeaders,
        payloadHash
    ].join('\n');

    const credentialScope = `${dateStamp}/${options.region}/${options.service}/request`;
    const stringToSign = [
        'HMAC-SHA256',
        xDate,
        credentialScope,
        sha256Hex(canonicalRequest)
    ].join('\n');

    let signingKey: Buffer = hmac(options.secretAccessKey, dateStamp);
    signingKey = hmac(signingKey, options.region);
    signingKey = hmac(signingKey, options.service);
    signingKey = hmac(signingKey, 'request');

    const signature = hmacHex(signingKey, stringToSign);

    return {
        Authorization: `HMAC-SHA256 Credential=${options.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        Host: options.host,
        'X-Date': xDate,
        'X-Content-Sha256': payloadHash,
        ...(options.sessionToken ? { 'X-Security-Token': options.sessionToken } : {})
    };
}
