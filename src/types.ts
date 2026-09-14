export type AccountType = 'personal' | 'enterprise';
export type WindowKey = 'fiveHour' | 'weekly' | 'monthly';

export interface AfpWindowUsage {
    quota: number;
    used: number;
    resetTime?: number;
    subscribeTime?: number;
}

export interface AfpUsageRecord {
    id: string;
    label: string;
    planType?: string;
    windows: Partial<Record<WindowKey, AfpWindowUsage>>;
}

export interface NormalizedUsage {
    action: string;
    records: AfpUsageRecord[];
    raw: unknown;
}

export interface Credentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
}

export interface RequestOptions {
    endpoint: string;
    region: string;
    service: string;
    action: string;
    version: string;
    body: string;
    credentials: Credentials;
}
