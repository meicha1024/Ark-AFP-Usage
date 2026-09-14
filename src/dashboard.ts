import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { NormalizedUsage } from './types';

export interface DashboardPayload {
    loading?: boolean;
    usage?: NormalizedUsage;
    updatedAt?: number;
    accountType: 'personal' | 'enterprise';
    warnThreshold: number;
    dangerThreshold: number;
}

interface DashboardCallbacks {
    refresh: () => void;
    configure: () => void;
}

export class DashboardPanel {
    private static current: DashboardPanel | undefined;
    private static readonly viewType = 'volcArkAfp.dashboard';

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        private readonly context: vscode.ExtensionContext,
        private readonly callbacks: DashboardCallbacks,
        private pendingPayload?: DashboardPayload
    ) {
        this.panel.webview.html = this.getHtml();
        this.panel.onDidDispose(() => this.dispose(), null, context.subscriptions);
        this.panel.webview.onDidReceiveMessage(
            (message: { type?: string }) => {
                if (message.type === 'ready' && this.pendingPayload) {
                    this.post(this.pendingPayload);
                    this.pendingPayload = undefined;
                }
                if (message.type === 'refresh') callbacks.refresh();
                if (message.type === 'configure') callbacks.configure();
            },
            null,
            context.subscriptions
        );
    }

    static createOrShow(
        context: vscode.ExtensionContext,
        payload: DashboardPayload,
        callbacks: DashboardCallbacks
    ): DashboardPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.Beside
            : vscode.ViewColumn.Active;

        if (DashboardPanel.current) {
            DashboardPanel.current.panel.reveal(column);
            DashboardPanel.current.post(payload);
            return DashboardPanel.current;
        }

        const panel = vscode.window.createWebviewPanel(
            DashboardPanel.viewType,
            '火山方舟AFP用量',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );
        panel.iconPath = new vscode.ThemeIcon('sparkle');

        DashboardPanel.current = new DashboardPanel(panel, context, callbacks, payload);
        return DashboardPanel.current;
    }

    update(payload: DashboardPayload): void {
        this.post(payload);
    }

    showError(message: string): void {
        void this.panel.webview.postMessage({ type: 'error', message });
    }

    private dispose(): void {
        this.panel.dispose();
        DashboardPanel.current = undefined;
    }

    private post(payload: DashboardPayload): void {
        void this.panel.webview.postMessage({ type: 'update', payload });
    }

    private getHtml(): string {
        const nonce = randomUUID().replace(/-/g, '');
        const cspSource = this.panel.webview.cspSource;
        const csp = [
            `default-src 'none'`,
            `img-src ${cspSource} data: https:`,
            `style-src ${cspSource} 'unsafe-inline'`,
            `script-src 'nonce-${nonce}'`,
            `font-src ${cspSource}`
        ].join('; ');

        return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>火山方舟AFP用量</title>
<style>
:root {
  --bg: #f5f7fb;
  --panel: rgba(255,255,255,.88);
  --panel-solid: #ffffff;
  --text: #111827;
  --muted: #667085;
  --subtle: #98a2b3;
  --border: rgba(15,23,42,.09);
  --shadow: 0 18px 50px rgba(15,23,42,.09), 0 2px 10px rgba(15,23,42,.04);
  --blue: #2563eb;
  --indigo: #4f46e5;
  --violet: #7c3aed;
  --cyan: #06b6d4;
  --green: #12b76a;
  --warn: #f79009;
  --danger: #f04438;
  --track: #eef2f7;
}
body.vscode-dark, body.vscode-high-contrast {
  --bg: #080d19;
  --panel: rgba(17,24,39,.82);
  --panel-solid: #111827;
  --text: #f9fafb;
  --muted: #b7c0d2;
  --subtle: #7d89a0;
  --border: rgba(255,255,255,.10);
  --shadow: 0 22px 60px rgba(0,0,0,.38), 0 2px 12px rgba(0,0,0,.25);
  --track: rgba(255,255,255,.10);
}
* { box-sizing: border-box; }
html, body { margin:0; min-height:100%; }
body {
  color: var(--text);
  background:
    radial-gradient(circle at 8% -10%, rgba(37,99,235,.20), transparent 34rem),
    radial-gradient(circle at 92% 0%, rgba(124,58,237,.18), transparent 32rem),
    var(--bg);
  font-family: var(--vscode-font-family), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: var(--vscode-font-size, 13px);
  padding: 28px;
}
.app { max-width: 1180px; margin: 0 auto; }
.hero {
  position: relative;
  overflow: hidden;
  border-radius: 28px;
  padding: 30px 32px;
  color: white;
  background: linear-gradient(135deg, #155eef 0%, #4f46e5 48%, #7c3aed 100%);
  box-shadow: 0 24px 70px rgba(79,70,229,.28);
}
.hero::after {
  content: "";
  position: absolute;
  inset: auto -90px -150px auto;
  width: 430px; height: 430px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,.22), transparent 68%);
}
.hero-top, .summary, .records, .toolbar { position: relative; z-index: 1; }
.hero-top { display:flex; align-items:flex-start; justify-content:space-between; gap:22px; }
.eyebrow { display:flex; align-items:center; gap:8px; font-size:12px; letter-spacing:.12em; text-transform:uppercase; opacity:.82; font-weight:700; }
.eyebrow-dot { width:8px; height:8px; border-radius:50%; background:#7ef7c1; box-shadow:0 0 18px #7ef7c1; }
h1 { margin: 10px 0 8px; font-size: 30px; line-height:1.18; letter-spacing:-.02em; }
.hero-desc { margin:0; color:rgba(255,255,255,.78); line-height:1.7; max-width: 680px; }
.chip-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
.chip { padding:6px 11px; border-radius:999px; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.18); backdrop-filter: blur(10px); font-weight:600; }
.actions { display:flex; gap:10px; flex-shrink:0; }
button {
  border: 0; cursor:pointer; border-radius: 12px; padding: 10px 14px;
  font: inherit; font-weight:700; color:white;
  background: rgba(255,255,255,.16);
  border:1px solid rgba(255,255,255,.20);
  transition: transform .16s ease, background .16s ease, box-shadow .16s ease;
}
button:hover { transform: translateY(-1px); background: rgba(255,255,255,.23); }
button.secondary { color: var(--text); background: var(--panel-solid); border-color: var(--border); box-shadow: var(--shadow); }
.summary { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:14px; margin: -24px 8px 22px; }
.stat, .record-card {
  border: 1px solid var(--border);
  background: var(--panel);
  backdrop-filter: blur(18px);
  border-radius: 22px;
  box-shadow: var(--shadow);
}
.stat { padding: 18px; }
.stat-label { display:flex; align-items:center; gap:8px; color:var(--muted); font-weight:600; font-size:12px; }
.stat-icon { width:28px; height:28px; display:grid; place-items:center; border-radius:10px; color:white; background:linear-gradient(135deg,var(--blue),var(--violet)); }
.stat-value { margin-top:10px; font-size:25px; line-height:1.15; font-weight:800; letter-spacing:-.02em; }
.stat-note { margin-top:5px; color:var(--subtle); font-size:12px; }
.toolbar { display:flex; justify-content:space-between; align-items:center; gap:16px; margin: 4px 2px 14px; }
.toolbar h2 { margin:0; font-size:18px; letter-spacing:-.01em; }
.toolbar p { margin:4px 0 0; color:var(--muted); font-size:12px; }
.records { display:grid; gap:16px; }
.record-card { padding: 22px; }
.record-head { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:18px; }
.record-title { display:flex; align-items:center; gap:12px; }
.plan-mark { width:42px; height:42px; border-radius:15px; display:grid; place-items:center; color:#fff; font-weight:900; background:linear-gradient(135deg,#06b6d4,#2563eb 55%,#7c3aed); box-shadow:0 10px 25px rgba(37,99,235,.22); }
.record-name { font-size:17px; font-weight:800; }
.record-sub { color:var(--muted); font-size:12px; margin-top:3px; }
.plan-badge { padding:7px 11px; border-radius:999px; color:#4f46e5; background:rgba(79,70,229,.10); border:1px solid rgba(79,70,229,.14); font-weight:800; }
body.vscode-dark .plan-badge { color:#c7d2fe; background:rgba(99,102,241,.16); }
.metrics { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:14px; }
.metric { position:relative; overflow:hidden; border:1px solid var(--border); border-radius:18px; padding:18px; background:var(--panel-solid); }
.metric::before { content:""; position:absolute; inset:0 auto auto 0; width:100%; height:3px; background:var(--accent); opacity:.9; }
.metric.ok { --accent: var(--green); }
.metric.warn { --accent: var(--warn); }
.metric.danger { --accent: var(--danger); }
.metric-top { display:flex; align-items:center; justify-content:space-between; color:var(--muted); font-weight:700; font-size:12px; }
.ring-wrap { display:flex; justify-content:center; margin:14px 0 10px; }
.ring {
  width: 128px; height: 128px; border-radius:50%;
  background: conic-gradient(var(--accent) calc(var(--pct)*1%), var(--track) 0);
  display:grid; place-items:center;
  position: relative;
}
.ring::before { content:""; position:absolute; inset:12px; border-radius:50%; background:var(--panel-solid); box-shadow: inset 0 0 0 1px var(--border); }
.ring-content { position:relative; text-align:center; }
.ring-pct { font-size:22px; font-weight:850; letter-spacing:-.02em; }
.ring-label { color:var(--muted); font-size:11px; margin-top:2px; }
.usage-line { display:flex; justify-content:space-between; gap:10px; padding-top:10px; border-top:1px solid var(--border); }
.usage-num { font-weight:800; }
.usage-quota { color:var(--subtle); font-size:12px; text-align:right; }
.reset { margin-top:10px; display:flex; align-items:center; gap:7px; color:var(--muted); font-size:12px; }
.dot-pulse { width:7px; height:7px; border-radius:50%; background:var(--accent); box-shadow:0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent); }
.empty, .error-box { margin-top: 20px; border:1px dashed var(--border); border-radius:20px; padding:34px; text-align:center; color:var(--muted); background:var(--panel); }
.error-box { color:var(--danger); border-color: color-mix(in srgb, var(--danger) 35%, transparent); }
.loading { display:flex; align-items:center; gap:10px; color:var(--muted); }
.spinner { width:16px; height:16px; border-radius:50%; border:2px solid var(--track); border-top-color:var(--blue); animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
@media (max-width: 980px) { .summary, .metrics { grid-template-columns: repeat(2, minmax(0,1fr)); } .hero { padding:24px; } }
@media (max-width: 620px) { body { padding:16px; } .summary, .metrics { grid-template-columns: 1fr; } .hero-top, .record-head { flex-direction:column; align-items:flex-start; } .actions { width:100%; } .actions button { flex:1; } }
</style>
</head>
<body>
<div class="app">
  <section class="hero">
    <div class="hero-top">
      <div>
        <div class="eyebrow"><span class="eyebrow-dot"></span>Volcengine Ark · Agent Plan</div>
        <h1>AFP 套餐用量总览</h1>
        <p class="hero-desc">聚合展示 5 小时、周、月三个滚动窗口的配额、使用率与重置时间，帮助你提前识别额度风险。</p>
        <div class="chip-row">
          <span class="chip" id="accountChip">加载中</span>
          <span class="chip" id="actionChip">—</span>
          <span class="chip" id="updatedChip">等待数据</span>
        </div>
      </div>
      <div class="actions">
        <button id="refreshBtn" type="button">刷新用量</button>
        <button id="settingsBtn" type="button">设置</button>
      </div>
    </div>
  </section>

  <section class="summary" id="summary"></section>
  <section class="toolbar">
    <div><h2>套餐与席位</h2><p>颜色会根据设置中的警告和严重阈值自动变化。</p></div>
  </section>
  <section class="records" id="records"></section>
  <div class="empty" id="empty">暂无数据，点击右上角“刷新用量”。</div>
  <div class="error-box" id="error" hidden></div>
</div>
<script nonce="${nonce}">
(() => {
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const windows = [
    { key: 'fiveHour', label: '近 5 小时', short: '5H' },
    { key: 'weekly', label: '近 1 周', short: '周' },
    { key: 'monthly', label: '近 1 月', short: '月' }
  ];
  let state = { loading: false, error: '' };
  let timer = null;

  const numberFmt = new Intl.NumberFormat('zh-CN');
  const compactFmt = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });

  function pctOf(w) {
    if (!w || !w.quota) return 0;
    return Math.max(0, Math.min(100, (Number(w.used) || 0) / Number(w.quota) * 100));
  }
  function level(w) {
    const p = pctOf(w);
    if (p >= state.dangerThreshold) return 'danger';
    if (p >= state.warnThreshold) return 'warn';
    return 'ok';
  }
  function text(node, value) { node.textContent = value; }
  function levelText(w) { return level(w) === 'danger' ? '高用量' : level(w) === 'warn' ? '需关注' : '运行正常'; }
  function formatTime(t) { return t ? new Date(t).toLocaleString() : '—'; }
  function countdown(t) {
    if (!t) return '暂无重置时间';
    let s = Math.max(0, Math.floor((t - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60);
    if (d > 0) return d + ' 天 ' + h + ' 小时后重置';
    if (h > 0) return h + ' 小时 ' + m + ' 分后重置';
    return m + ' 分钟后重置';
  }
  function allWindows() {
    return (state.usage?.records || []).flatMap(r => windows.map(w => r.windows[w.key]).filter(Boolean));
  }
  function renderSummary() {
    const root = $('summary'); root.replaceChildren();
    const ws = allWindows();
    const highest = ws.reduce((a,b) => pctOf(a) >= pctOf(b) ? a : b, null);
    const used = ws.reduce((s,w) => s + (Number(w.used) || 0), 0);
    const quota = ws.reduce((s,w) => s + (Number(w.quota) || 0), 0);
    const nextReset = ws.map(w => w.resetTime).filter(Boolean).filter(t => t > Date.now()).sort((a,b)=>a-b)[0];
    const stats = [
      { icon:'📈', label:'最高窗口使用率', value: highest ? pctOf(highest).toFixed(1) + '%' : '—', note: highest ? levelText(highest) : '等待数据' },
      { icon:'⚡', label:'累计已用 AFP', value: compactFmt.format(used), note: numberFmt.format(used) + ' AFP' },
      { icon:'💎', label:'可见总额度', value: compactFmt.format(quota), note: numberFmt.format(quota) + ' AFP' },
      { icon:'⏱️', label:'最近额度重置', value: nextReset ? countdown(nextReset).replace('后重置','') : '—', note: nextReset ? formatTime(nextReset) : '暂无重置时间' }
    ];
    for (const s of stats) {
      const card = document.createElement('div'); card.className = 'stat';
      const label = document.createElement('div'); label.className = 'stat-label';
      const icon = document.createElement('span'); icon.className = 'stat-icon'; text(icon, s.icon);
      label.append(icon, s.label);
      const value = document.createElement('div'); value.className = 'stat-value'; text(value, s.value);
      const note = document.createElement('div'); note.className = 'stat-note'; text(note, s.note);
      card.append(label,value,note); root.appendChild(card);
    }
  }
  function metricCard(w, meta) {
    const card = document.createElement('div'); card.className = 'metric ' + level(w);
    const top = document.createElement('div'); top.className = 'metric-top';
    const name = document.createElement('span'); text(name, meta.label);
    const badge = document.createElement('span'); text(badge, levelText(w));
    top.append(name, badge);
    const ringWrap = document.createElement('div'); ringWrap.className = 'ring-wrap';
    const ring = document.createElement('div'); ring.className = 'ring'; ring.style.setProperty('--pct', pctOf(w).toFixed(2));
    const content = document.createElement('div'); content.className = 'ring-content';
    const p = document.createElement('div'); p.className = 'ring-pct'; text(p, pctOf(w).toFixed(1) + '%');
    const rl = document.createElement('div'); rl.className = 'ring-label'; text(rl, '已使用');
    content.append(p,rl); ring.appendChild(content); ringWrap.appendChild(ring);
    const line = document.createElement('div'); line.className = 'usage-line';
    const left = document.createElement('div');
    const used = document.createElement('div'); used.className = 'usage-num'; text(used, numberFmt.format(Number(w.used)||0));
    const usedLabel = document.createElement('div'); usedLabel.className = 'usage-quota'; text(usedLabel, '已用 AFP');
    left.append(used,usedLabel);
    const right = document.createElement('div');
    const quota = document.createElement('div'); quota.className = 'usage-num'; text(quota, numberFmt.format(Number(w.quota)||0));
    const quotaLabel = document.createElement('div'); quotaLabel.className = 'usage-quota'; text(quotaLabel, '总额度');
    right.append(quota,quotaLabel); line.append(left,right);
    const reset = document.createElement('div'); reset.className = 'reset';
    const dot = document.createElement('span'); dot.className = 'dot-pulse';
    const resetText = document.createElement('span'); resetText.dataset.reset = String(w.resetTime || ''); text(resetText, countdown(w.resetTime));
    reset.append(dot, resetText);
    card.append(top, ringWrap, line, reset);
    return card;
  }
  function renderRecords() {
    const root = $('records'); root.replaceChildren();
    const records = state.usage?.records || [];
    for (const record of records) {
      const card = document.createElement('div'); card.className = 'record-card';
      const head = document.createElement('div'); head.className = 'record-head';
      const title = document.createElement('div'); title.className = 'record-title';
      const mark = document.createElement('div'); mark.className = 'plan-mark'; text(mark, (record.planType || 'AFP').slice(0,1).toUpperCase());
      const titleText = document.createElement('div');
      const name = document.createElement('div'); name.className = 'record-name'; text(name, record.label);
      const sub = document.createElement('div'); sub.className = 'record-sub'; text(sub, 'Seat ID：' + record.id);
      titleText.append(name,sub); title.append(mark,titleText);
      const badge = document.createElement('div'); badge.className = 'plan-badge'; text(badge, record.planType || 'Agent Plan');
      head.append(title,badge);
      const metrics = document.createElement('div'); metrics.className = 'metrics';
      for (const meta of windows) {
        const w = record.windows[meta.key];
        if (w) metrics.appendChild(metricCard(w, meta));
      }
      card.append(head, metrics); root.appendChild(card);
    }
    $('empty').hidden = records.length > 0;
  }
  function render() {
    if (!state) return;
        $('error').hidden = !state.error;
    if (state.error) text($('error'), state.error);
    $('accountChip').textContent = state.accountType === 'enterprise' ? '企业版 Agent Plan' : '个人版 Agent Plan';
    $('actionChip').textContent = state.usage?.action || '—';
    $('updatedChip').textContent = state.updatedAt ? '更新于 ' + new Date(state.updatedAt).toLocaleTimeString() : '尚未更新';
    renderSummary(); renderRecords();
    if (timer) clearInterval(timer);
    timer = setInterval(() => { renderSummary(); renderRecords(); }, 30000);
  }
  $('refreshBtn').addEventListener('click', () => {
    state.loading = true;
    state.error = '';
    vscode.postMessage({ type: 'refresh' });
  });
  $('settingsBtn').addEventListener('click', () => vscode.postMessage({ type: 'configure' }));
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'update') {
      state = { ...msg.payload, loading: false, error: '' };
      vscode.setState(state); render();
    }
    if (msg.type === 'error') {
      state.loading = false;
      state.error = msg.message;
      render();
    }
  });
  const old = vscode.getState();
  if (old) { state = { ...old, loading: false, error: old.error || '' }; }
  render();
  vscode.postMessage({ type: 'ready' });
})();
</script>
</body>
</html>`;
    }
}
