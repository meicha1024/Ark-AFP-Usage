import * as vscode from 'vscode';
import { ArkApiError, fetchUsage, missingCredential, resolveCredentials } from './api';
import { DashboardPanel } from './dashboard';
import { AfpUsageRecord, AfpWindowUsage, NormalizedUsage, WindowKey } from './types';

type UsageLevel = 'ok' | 'warn' | 'danger' | 'muted';

interface WindowMeta {
    key: WindowKey;
    label: string;
    short: string;
    configName: string;
}

const WINDOWS: WindowMeta[] = [
    { key: 'fiveHour', label: '近 5 小时', short: '5H', configName: 'showFiveHour' },
    { key: 'weekly', label: '近 1 周', short: '周', configName: 'showWeekly' },
    { key: 'monthly', label: '近 1 月', short: '月', configName: 'showMonthly' }
];

function cfg() {
    return vscode.workspace.getConfiguration('volcArkAfp');
}

function percent(window: AfpWindowUsage): number {
    if (!window.quota || window.quota <= 0) return 0;
    return Math.min(100, (window.used / window.quota) * 100);
}

function levelFor(window: AfpWindowUsage): UsageLevel {
    const pct = percent(window);
    const danger = cfg().get<number>('dangerThresholdPercent', 90);
    const warn = cfg().get<number>('warnThresholdPercent', 70);
    if (pct >= danger) return 'danger';
    if (pct >= warn) return 'warn';
    return 'ok';
}

function icon(level: UsageLevel): string {
    if (level === 'danger') return '🔴';
    if (level === 'warn') return '🟠';
    if (level === 'muted') return '⚪';
    return '🟢';
}

function formatPercent(window: AfpWindowUsage | undefined): string {
    if (!window) return '—';
    return `${percent(window).toFixed(1)}%`;
}

function formatNumber(value: number): string {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(1)}K`;
    return String(Math.round(value));
}

function formatTime(timestamp: number | undefined): string {
    if (!timestamp || timestamp <= 0) return '—';
    return new Date(timestamp).toLocaleString();
}

function formatCountdown(timestamp: number | undefined): string {
    if (!timestamp || timestamp <= 0) return '—';
    let seconds = Math.max(0, Math.floor((timestamp - Date.now()) / 1000));
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${minutes}分`;
    return `${minutes}分钟`;
}

function escapeMarkdownCell(value: string | number | undefined): string {
    return String(value ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function progressBar(windowUsage: AfpWindowUsage): string {
    const pct = percent(windowUsage);
    const filled = Math.round(pct / 10);
    const empty = Math.max(0, 10 - filled);
    const fill = levelFor(windowUsage) === 'danger' ? '█' : levelFor(windowUsage) === 'warn' ? '▓' : '█';
    return `${fill.repeat(filled)}░${'░'.repeat(empty)}`;
}

function aggregate(records: AfpUsageRecord[]): AfpUsageRecord['windows'] {
    const aggregateWindows: AfpUsageRecord['windows'] = {};
    for (const meta of WINDOWS) {
        const windows = records.map((r) => r.windows[meta.key]).filter((w): w is AfpWindowUsage => Boolean(w));
        if (windows.length === 0) continue;
        const used = windows.reduce((sum, w) => sum + w.used, 0);
        const quota = windows.reduce((sum, w) => sum + w.quota, 0);
        const nextReset = windows.map((w) => w.resetTime).filter((t): t is number => Boolean(t && t > Date.now())).sort((a, b) => a - b)[0];
        aggregateWindows[meta.key] = { used, quota, resetTime: nextReset ?? windows[0]?.resetTime };
    }
    return aggregateWindows;
}

class AfpUsageExtension {
    private statusBar!: vscode.StatusBarItem;
    private timer: ReturnType<typeof setInterval> | undefined;
    private usage: NormalizedUsage | undefined;
    private lastUpdated: Date | undefined;
    private dashboard: DashboardPanel | undefined;
    private refreshing = false;

    constructor(private readonly context: vscode.ExtensionContext) {}

    activate(): void {
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 120);
        this.statusBar.command = 'volcArkAfp.showUsage';
        this.context.subscriptions.push(this.statusBar);

        this.context.subscriptions.push(
            vscode.commands.registerCommand('volcArkAfp.refresh', () => this.refresh(true)),
            vscode.commands.registerCommand('volcArkAfp.showUsage', () => this.showUsage()),
            vscode.commands.registerCommand('volcArkAfp.configure', () =>
                vscode.commands.executeCommand('workbench.action.openSettings', 'volcArkAfp')
            )
        );

        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (event.affectsConfiguration('volcArkAfp')) {
                    this.setupTimer();
                    void this.refresh(false);
                }
            })
        );

        this.setupTimer();
        this.renderLoading();
        this.statusBar.show();
        void this.refresh(false);
    }

    private setupTimer(): void {
        if (this.timer) clearInterval(this.timer);
        const minutes = cfg().get<number>('refreshIntervalMinutes', 5);
        if (minutes > 0) {
            this.timer = setInterval(() => void this.refresh(false), minutes * 60_000);
        }
    }

    private renderLoading(): void {
        this.statusBar.text = '$(sync~spin) AFP';
        this.statusBar.tooltip = '正在查询火山方舟 Agent Plan AFP 用量…';
        this.statusBar.backgroundColor = undefined;
    }

    private renderError(message: string): void {
        this.statusBar.text = '$(error) AFP';
        this.statusBar.tooltip = new vscode.MarkdownString(`**火山方舟 AFP 查询失败**\n\n${message}\n\n点击查看详情；运行「火山方舟 AFP: 刷新用量」重试。`, true);
        this.statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    private renderUsage(): void {
        if (!this.usage || this.usage.records.length === 0) {
            this.renderError('接口未返回用量数据。');
            return;
        }

        const windows = aggregate(this.usage.records);
        const visibleWindows = WINDOWS.filter((meta) => cfg().get<boolean>(meta.configName, true) && windows[meta.key]);
        const parts = visibleWindows.map((meta) => {
            const windowUsage = windows[meta.key]!;
            return `${icon(levelFor(windowUsage))}${meta.short} ${formatPercent(windowUsage)}`;
        });

        this.statusBar.text = parts.length > 0 ? `$(sparkle) AFP ${parts.join(' ')}` : '$(sparkle) AFP';
        this.statusBar.backgroundColor = undefined;

        const md = new vscode.MarkdownString(undefined, true);
        md.isTrusted = true;
        md.supportThemeIcons = true;
        md.appendMarkdown('### 火山方舟 Agent Plan AFP 用量\n\n');
        md.appendMarkdown(`**接口**：\`${this.usage.action}\`　　**更新时间**：${this.lastUpdated?.toLocaleTimeString() ?? '—'}\n\n`);

        for (const record of this.usage.records) {
            md.appendMarkdown(`**${record.planType ? `${record.label} · ${record.planType}` : record.label}**\n\n`);
            md.appendMarkdown('| 窗口 | 用量进度 | 使用率 | 已用 / 总额度 | 重置倒计时 |\n');
            md.appendMarkdown('| --- | --- | ---: | ---: | ---: |\n');
            for (const meta of WINDOWS) {
                const w = record.windows[meta.key];
                if (!w) continue;
                md.appendMarkdown(
                    `| ${escapeMarkdownCell(meta.label)} | \`${progressBar(w)}\` | **${formatPercent(w)}** | ${escapeMarkdownCell(formatNumber(w.used))} / ${escapeMarkdownCell(formatNumber(w.quota))} | ${escapeMarkdownCell(formatCountdown(w.resetTime))} |\n`
                );
            }
            md.appendMarkdown('\n');
        }
        md.appendMarkdown('---\n点击状态栏打开可视化仪表盘。');
        this.statusBar.tooltip = md;
    }

    async refresh(notify: boolean): Promise<void> {
        if (this.refreshing) return;
        this.refreshing = true;
        this.renderLoading();
        this.updateDashboard(true);
        try {
            const credentials = resolveCredentials();
            const missing = missingCredential(credentials);
            if (missing) throw new ArkApiError(`${missing}。请运行「火山方舟 AFP: 打开插件设置」配置 AK/SK，或设置 VOLC_ACCESSKEY / VOLC_SECRETKEY 环境变量。`);

            const accountType = cfg().get<'personal' | 'enterprise'>('accountType', 'personal');
            const seatIds = cfg().get<string[]>('seatIds', []).map((id) => id.trim()).filter(Boolean);
            this.usage = await fetchUsage(credentials, accountType, seatIds);
            this.lastUpdated = new Date();
            this.renderUsage();
            this.updateDashboard();
            if (notify) void vscode.window.showInformationMessage('火山方舟AFP用量已刷新。');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.renderError(message);
            this.dashboard?.showError(message);
            if (notify) {
                const choice = await vscode.window.showErrorMessage(`AFP 用量查询失败：${message}`, '打开设置');
                if (choice === '打开设置') await vscode.commands.executeCommand('volcArkAfp.configure');
            }
        } finally {
            this.refreshing = false;
        }
    }

    private dashboardPayload() {
        return {
            usage: this.usage,
            updatedAt: this.lastUpdated?.getTime(),
            accountType: cfg().get<'personal' | 'enterprise'>('accountType', 'personal'),
            warnThreshold: cfg().get<number>('warnThresholdPercent', 70),
            dangerThreshold: cfg().get<number>('dangerThresholdPercent', 90)
        };
    }

    private updateDashboard(loading = false): void {
        this.dashboard?.update({ ...this.dashboardPayload(), loading });
    }

    private async showUsage(): Promise<void> {
        this.dashboard = DashboardPanel.createOrShow(
            this.context,
            { ...this.dashboardPayload(), loading: !this.usage },
            {
                refresh: () => void this.refresh(true),
                configure: () => void vscode.commands.executeCommand('volcArkAfp.configure')
            }
        );

        if (!this.usage) {
            await this.refresh(true);
        }
    }

}

export function activate(context: vscode.ExtensionContext): void {
    new AfpUsageExtension(context).activate();
}

export function deactivate(): void {}
