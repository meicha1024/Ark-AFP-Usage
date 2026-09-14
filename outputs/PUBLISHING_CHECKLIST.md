# 火山方舟 AFP 用量 —— VS Code Marketplace 上架清单

> 当前版本：`0.1.0`　｜　包名：`volcengine-ark-afp-usage`
> 本文件是发布到 [Visual Studio Marketplace](https://marketplace.visualstudio.com/) 的操作手册。

---

## 一、发布信息（已确定）

- **Publisher ID**：`meicha`（已写入 package.json）
- **GitHub 仓库**：https://github.com/meicha1024/Ark-AFP-Usage
- 扩展完整 ID（上架后）：`meicha.volcengine-ark-afp-usage`
- 市场地址（发布成功后可访问）：
  https://marketplace.visualstudio.com/items?itemName=meicha.volcengine-ark-afp-usage
- repository / homepage / bugs 链接已配置，打包脚本已恢复为标准命令（无需 `--allow-missing-repository`）。

剩余建议补充（非阻塞）：

- 上传 3 张截图（状态栏 / 悬停表格 / Webview 仪表盘）到仓库 `images/`，并在 README 用 raw 链接引用。
- 将代码推送到上述 GitHub 仓库。

---

## 二、已为你准备好的上架物料

| 项目 | 文件 / 状态 |
| --- | --- |
| 扩展图标 128×128 PNG | `media/icon.png`，已在 package.json 配置 `"icon"` |
| 市场分类 / 关键字 | `categories`、`keywords` 已配置 |
| 横幅配色 | `galleryBanner` 已配置（`#1664FF` / dark） |
| 运行位置 | `"extensionKind": ["ui"]` |
| 更新日志 | `CHANGELOG.md` |
| 许可证 | `LICENSE`（MIT） |
| 隐私与数据说明 | README「隐私与数据安全」章节 |
| 非官方声明 | README 顶部提示 |
| 打包忽略规则 | `.vscodeignore`（已排除源码/依赖/work/.DS_Store 等） |

---

## 三、发布步骤

### 1. 修改发布者并自检

```bash
cd /Users/lemon/Documents/Codex/2026-09-14/negn
# 编辑 package.json，将 publisher 改为你的 Publisher ID
```

### 2. 编译 + 本地打包验证

```bash
npm run compile
npm run package
```

产物：`outputs/volcengine-ark-afp-usage.vsix`
可先在 VS Code 里「从 VSIX 安装」做最后一次真机验证。

### 3. 获取 Personal Access Token（PAT）

- 打开 <https://dev.azure.com> 登录（与 Marketplace 同一微软账号）。
- User settings → Personal access tokens → New Token。
- Scopes 选 **Custom defined**，勾选 **Marketplace > Manage**。
- 复制并妥善保存 Token（只显示一次）。**不要把 PAT 发给任何人或提交到仓库。**

### 4. 登录并发布

```bash
npx @vscode/vsce login <你的-Publisher-ID>
npx @vscode/vsce publish --no-dependencies
```

或一步发布（Token 仅用于本机命令，注意不要留在 shell 历史里）：

```bash
npx @vscode/vsce publish --no-dependencies -p <PAT>
```

### 5. 发布后

- 一般几分钟内在 Marketplace 可搜索到；首次发布可能需要审核。
- 之后升级版本：修改 `package.json` 的 `version` 与 `CHANGELOG.md`，再次执行 publish。

---

## 四、审核常见被拒原因（对照自查）

- [x] `publisher` 已改为真实 ID（`meicha`）
- [ ] 图标为 128×128 PNG，清晰、无侵权素材
- [ ] README 含使用说明、配置说明、隐私说明
- [ ] 名称/描述不冒充官方，已加非官方声明
- [ ] 凭证仅发往官方域名、README 已如实说明
- [ ] 无遥测/统计外发（本插件确实没有）
- [ ] LICENSE 与 package.json `license` 一致（MIT）
- [ ] 版本号符合规范，`CHANGELOG.md` 已更新
- [ ] （若提供仓库）repository/homepage/bugs 链接可访问

---

## 五、合规要点（AK/SK 类插件尤其注意）

- 请求仅发往 `https://ark.cn-beijing.volcengineapi.com`。
- 不收集、不上传任何用户数据到第三方。
- 建议用户使用 IAM 子用户只读密钥（README 已写明）。
- 品牌名为各自权利人商标，插件定位为“非官方工具”。
