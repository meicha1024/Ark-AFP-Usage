# 火山方舟 AFP 用量（VS Code 插件）

在 VS Code 状态栏查看火山方舟 **Agent Plan** 套餐的 AFP（Agent Frame Point）额度使用率，支持个人版和企业版席位查询。

> ⚠️ **非官方社区项目**：本扩展并非火山引擎/字节跳动官方出品，也未与其存在任何隶属、背书或担保关系。“火山引擎”“火山方舟”“Volcengine”等名称及商标归其各自权利人所有，本插件仅用于调用官方公开 OpenAPI 查询本人账号的套餐用量。


该插件按照最新管控面 API 实现：

- 个人版：`POST https://ark.cn-beijing.volcengineapi.com/?Action=GetAFPUsage&Version=2024-01-01`
- 企业版：`POST https://ark.cn-beijing.volcengineapi.com/?Action=GetSeatAFPUsage&Version=2024-01-01`
- Service：`ark`
- Region：`cn-beijing`
- 鉴权：火山引擎 V4 HMAC-SHA256 Access Key 签名

参考插件仍在调用旧的 `GetCodingPlanUsage` / `GetAgentPlanUsage`，而当前文档中的 Agent Plan 用量接口已调整为 `GetAFPUsage` / `GetSeatAFPUsage`，这很可能是其请求失败的原因。

## 功能

- 状态栏显示近 5 小时、近 1 周、近 1 月使用率
- 鼠标悬停查看已用 / 总额度、重置时间与倒计时
- 点击状态栏打开用量详情
- 支持个人版 Agent Plan
- 支持企业版一个或多个席位 ID 查询（单次最多 1000 个）
- 自定义刷新间隔、显示窗口、警告/危险阈值
- 支持长期 AK/SK 和临时 `Session Token`

## 配置

打开 VS Code 设置，搜索 `火山方舟 AFP` 或 `volcArkAfp`：

| 设置 | 说明 |
| --- | --- |
| `volcArkAfp.accessKeyId` | 火山引擎 Access Key ID |
| `volcArkAfp.secretAccessKey` | 火山引擎 Secret Access Key |
| `volcArkAfp.sessionToken` | 临时凭证 Token，可留空 |
| `volcArkAfp.accountType` | `personal` 个人版，或 `enterprise` 企业版 |
| `volcArkAfp.seatIds` | 企业版席位 ID 数组；个人版留空 |
| `volcArkAfp.refreshIntervalMinutes` | 自动刷新间隔，默认 5 分钟 |
| `volcArkAfp.showFiveHour` | 是否显示近 5 小时 |
| `volcArkAfp.showWeekly` | 是否显示近 1 周 |
| `volcArkAfp.showMonthly` | 是否显示近 1 月 |
| `volcArkAfp.warnThresholdPercent` | 警告阈值，默认 70% |
| `volcArkAfp.dangerThresholdPercent` | 严重阈值，默认 90% |

也可以使用环境变量：

```bash
VOLC_ACCESSKEY=你的 AK
VOLC_SECRETKEY=你的 SK
# 可选
VOLC_SESSION_TOKEN=临时 Token
```

兼容的环境变量名还包括 `VOLC_ACCESS_KEY_ID`、`VOLC_ACCESS_KEY`、`VOLC_SECRET_ACCESS_KEY`、`VOLC_SECRET_KEY`。

### settings.json 示例

```json
{
  "volcArkAfp.accessKeyId": "AKLT...",
  "volcArkAfp.secretAccessKey": "********",
  "volcArkAfp.accountType": "personal",
  "volcArkAfp.refreshIntervalMinutes": 5
}
```

企业版示例：

```json
{
  "volcArkAfp.accessKeyId": "AKLT...",
  "volcArkAfp.secretAccessKey": "********",
  "volcArkAfp.accountType": "enterprise",
  "volcArkAfp.seatIds": ["seat-001", "seat-002"]
}
```

## 命令

在命令面板（`Cmd/Ctrl + Shift + P`）搜索：

- `火山方舟 AFP: 刷新用量`
- `火山方舟 AFP: 查看用量详情`
- `火山方舟 AFP: 打开插件设置`

## 隐私与数据安全

- 插件仅读取你在设置或环境变量中配置的访问凭证（AK/SK/可选 Session Token）。
- 所有网络请求**仅**发往火山方舟 OpenAPI：`https://ark.cn-beijing.volcengineapi.com`，用于查询套餐用量。
- **不收集**任何分析数据、使用遥测或错误上报，**不向任何第三方服务器**发送数据。
- 凭证保存在你本机的 VS Code 设置或环境变量中，不会随插件分发；请确认不要把含密钥的 `settings.json` 提交到代码仓库。
- 建议使用仅授予方舟管控面只读权限的 IAM 子用户密钥，而非主账号密钥。

## 权限与安全建议

建议不要使用主账号 AK/SK，而是在 IAM 中创建仅具备方舟管控面只读权限的子用户。设置中的密钥是明文存储；如果使用团队共享设备，优先从环境变量注入。


## 本地开发

```bash
npm install
npm run compile
```

在 VS Code 中按 `F5` 启动扩展开发宿主。

打包 VSIX：

```bash
npm run package
```

生成文件位于：

```text
outputs/volcengine-ark-afp-usage.vsix
```

## 文档依据

- [获取套餐 AFP 额度（GetAFPUsage）](https://docs.volcengine.com/docs/82379/2479847?lang=zh)
- [获取单个/多个席位的 AFP 额度（GetSeatAFPUsage）](https://docs.volcengine.com/docs/82379/2479851?lang=zh)
- [火山方舟 Base URL 及鉴权](https://docs.volcengine.com/docs/82379/1298459?lang=zh)

## 更新日志

详见随插件附带的 `CHANGELOG.md`（发布到公开仓库后将在此提供在线链接）。

## 许可证

MIT（详见随插件附带的 `LICENSE`）
