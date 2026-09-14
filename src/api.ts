import * as vscode from 'vscode';
import { signVolcRequest } from './signer';
import { AccountType, AfpUsageRecord, AfpWindowUsage, Credentials, NormalizedUsage, WindowKey } from './types';

const SERVICE = 'ark';
const REGION = 'cn-beijing';
const VERSION = '2024-01-01';

export class ArkApiError extends Error {
    constructor(message: string, readonly status?: number, readonly body?: unknown) {
        super(message);
        this.name = 'ArkApiError';
    }
}

interface RawWindow {
    Quota?: string | number;
    Used?: string | number;
    ResetTime?: number;
    SubscribeTime?: number;
}

interface RawSeatUsage extends RawWindow {
    SeatID?: string;
    SeatId?: string;
    SeatName?: string;
    Name?: string;
    PlanType?: string;
}

function config() {
    return vscode.workspace.getConfiguration('volcArkAfp');
}

function firstEnv(...names: string[]): string {
    for (const name of names) {
        const value = process.env[name];
        if (value?.trim()) return value.trim();
    }
    return '';
}

export function resolveCredentials(): Credentials {
    const cfg = config();
    return {
        accessKeyId: (cfg.get<string>('accessKeyId') || '').trim() || firstEnv('VOLC_ACCESSKEY', 'VOLC_ACCESS_KEY_ID', 'VOLC_ACCESS_KEY'),
        secretAccessKey: (cfg.get<string>('secretAccessKey') || '').trim() || firstEnv('VOLC_SECRETKEY', 'VOLC_SECRET_ACCESS_KEY', 'VOLC_SECRET_KEY'),
        sessionToken: (cfg.get<string>('sessionToken') || '').trim() || firstEnv('VOLC_SESSION_TOKEN') || undefined
    };
}

export function missingCredential(credentials: Credentials): string | undefined {
    if (!credentials.accessKeyId) return '未配置 Access Key ID';
    if (!credentials.secretAccessKey) return '未配置 Secret Access Key';
    return undefined;
}

function toNumber(value: string | number | undefined): number {
    if (value === undefined || value === null || value === '') return 0;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

function toWindow(raw: RawWindow | undefined): AfpWindowUsage | undefined {
    if (!raw) return undefined;
    return {
        quota: toNumber(raw.Quota),
        used: toNumber(raw.Used),
        resetTime: raw.ResetTime,
        subscribeTime: raw.SubscribeTime
    };
}

function recordWindows(source: Record<string, unknown>): AfpUsageRecord['windows'] {
    const result: AfpUsageRecord['windows'] = {};
    const mapping: Array<[WindowKey, string[]]> = [
        ['fiveHour', ['AFPFiveHour', 'FiveHour']],
        ['weekly', ['AFPWeekly', 'Weekly']],
        ['monthly', ['AFPMonthly', 'Monthly']]
    ];
    for (const [key, names] of mapping) {
        for (const name of names) {
            const w = toWindow(source[name] as RawWindow | undefined);
            if (w) result[key] = w;
        }
    }
    return result;
}

function normalizePersonal(payload: any): NormalizedUsage {
    const result = payload?.Result ?? payload?.result ?? payload;
    const windows = recordWindows(result ?? {});
    const record: AfpUsageRecord = {
        id: 'personal',
        label: '个人版 Agent Plan',
        planType: result?.PlanType,
        windows
    };
    return { action: 'GetAFPUsage', records: [record], raw: payload };
}

function normalizeEnterprise(payload: any): NormalizedUsage {
    const result = payload?.Result ?? payload?.result ?? {};
    const rawList: RawSeatUsage[] = result.SeatAFPUsages ?? result.SeatAFPUsageList ?? result.SeatUsages ?? [];
    const records = rawList.map((item, index) => ({
        id: item.SeatID ?? item.SeatId ?? String(index + 1),
        label: item.SeatName || item.Name || item.SeatID || item.SeatId || `席位 ${index + 1}`,
        planType: item.PlanType,
        windows: recordWindows(item as Record<string, unknown>)
    }));
    return { action: 'GetSeatAFPUsage', records, raw: payload };
}

export async function fetchUsage(credentials: Credentials, accountType: AccountType, seatIds: string[]): Promise<NormalizedUsage> {
    const endpoint = config().get<string>('endpoint') || 'https://ark.cn-beijing.volcengineapi.com';
    const url = new URL(endpoint);
    const action = accountType === 'enterprise' ? 'GetSeatAFPUsage' : 'GetAFPUsage';
    const query = new URLSearchParams({ Action: action, Version: VERSION });

    if (accountType === 'enterprise' && seatIds.length === 0) {
        throw new ArkApiError('企业版查询需要先在 volcArkAfp.seatIds 中填写至少一个席位 ID。');
    }
    if (seatIds.length > 1000) {
        throw new ArkApiError('单次最多查询 1000 个席位 ID。');
    }

    const body = accountType === 'enterprise' ? JSON.stringify({ SeatIDs: seatIds }) : '{}';
    const signed = signVolcRequest({
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
        method: 'POST',
        path: url.pathname || '/',
        query,
        body,
        host: url.host,
        region: REGION,
        service: SERVICE
    });

    const response = await fetch(`${url.origin}${url.pathname || '/'}?${query.toString()}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...signed
        },
        body
    });

    const text = await response.text();
    let payload: any;
    try {
        payload = text ? JSON.parse(text) : {};
    } catch {
        payload = { rawText: text };
    }

    const apiError = payload?.ResponseMetadata?.Error;
    if (!response.ok || apiError) {
        const message = apiError?.Message || apiError?.Code || `HTTP ${response.status} ${response.statusText}`;
        throw new ArkApiError(message, response.status, payload);
    }

    return accountType === 'enterprise' ? normalizeEnterprise(payload) : normalizePersonal(payload);
}
