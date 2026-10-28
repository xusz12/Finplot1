# Finplot · 个人财务分析

当前版本：**v0.1.2** · [版本记录](CHANGELOG.md)

单一账本、无需用户登录的个人财务分析应用。支持 StaffX SQLite 账本、年度／月度总览、分类分析、收支日历和投资记录。设置位于左下角，版本号替换标志下方的 PERSONAL FINANCE，窄屏显示在侧栏底部。未接入账本时明确显示示例数据。

## 安装与启动

需要 Node.js 22+ 和 Git。首次安装：

```bash
npm ci
npm run build
npm start
```

默认本机地址为 `http://127.0.0.1:3210`。启动器管理服务子进程，异常退出后自动拉起；端口被其他程序占用时会报错，不结束其他程序。macOS 也可双击 `启动Finplot.command`。

### macOS 守护进程

完成依赖安装与构建、停止前台 `npm start` 后执行：

```bash
npm run daemon:install
npm run daemon:status
npm run daemon:stop
npm run daemon:start
npm run daemon:uninstall
```

`daemon:install` 注册当前用户的 LaunchAgent 并立即启动，之后登录自动启动、关闭终端仍运行。安装位置为 `~/Library/LaunchAgents/com.finplot.service.plist`；日志位于数据目录的 `logs/service.log` 与 `logs/error.log`。卸载只移除守护进程，保留账本及更新历史。启动器路径与 Node 路径固定在安装配置中，移动项目或更换 Node 安装位置后重新执行安装命令。

其他系统可通过 `npm start` 前台运行，再交给系统进程管理器托管；内置守护进程安装脚本目前只支持 macOS。

### Tailscale

安装并连接 Tailscale 后，默认启动方式自动检测 `tailscale ip -4`，同时监听本机和 Tailscale IPv4。设置页显示实际访问地址，手机或其他设备连接同一 tailnet 后即可打开。Tailscale 尚未连接时仅启动本机监听；连接状态变化后重启服务。

应用没有账号、密码或用户登录。允许访问这台设备和端口的 tailnet 成员可读写同一账本、安装程序更新，请用 Tailscale ACL 限定访问成员。服务仅接受本机和 Tailscale IPv4 监听地址，不绑定所有网卡、不启用公网 Funnel；有请求 Host、Origin 与会话令牌检查。

可用环境变量（安装守护进程时会保存这些配置）：

| 变量 | 默认值／用途 |
| --- | --- |
| `FINPLOT_HOST` | `auto`；可设 `127.0.0.1` 仅本机，或指定 Tailscale IPv4 |
| `FINPLOT_PORT` | `3210` |
| `FINPLOT_DATA_DIR` | macOS：`~/Library/Application Support/Finplot`；其他系统：`~/.local/share/finplot` |
| `FINPLOT_TAILSCALE` | 可选的 Tailscale 可执行文件路径 |

```bash
FINPLOT_HOST=127.0.0.1 FINPLOT_PORT=3211 npm start
```

## 单一账本

1. 在「设置 → 选择文件」选择完整的 `.sqlite3`、`.sqlite` 或 `.db` 快照（最大 100 MB）。JSON 备份清单不能代替数据库。
2. 服务校验成功后保存唯一当前账本，所有设备读取同一份数据。更换后当前页面立即更新；其他打开的页面每 30 秒或回到窗口时同步。新快照仍需手动选择，不监控原文件。
3. 原始文件保持不变，应用将副本保存在运行服务的电脑。账本不上传第三方云服务，也不写入项目或发布包。
4. 保存时先写入完整快照，再原子切换当前指针。异常文件不覆盖原账本；并发更换会提示刷新，避免后一次操作无意覆盖其他设备刚保存的内容。
5. 移除账本会让所有设备回到示例数据；原文件与服务端历史快照保留。`ledger/current.json` 指向当前快照，`ledger/<revision>.sqlite3` 是历史副本；恢复时在设置中重新选择所需副本。历史副本含财务数据，需清理时可停止服务后自行管理，勿删除当前指针引用的文件。

### 从 v0.1.1 迁移

旧版账本保存在原浏览器、原站点的 IndexedDB。如果在相同站点打开新版且服务尚无账本，设置页会显示「迁移浏览器账本」；点击后才把副本保存到本机服务，原浏览器副本保留。**站点地址或端口变化时无法读取旧站点的浏览器存储**，请在新服务的设置中重新选择原 SQLite 快照。

`npm run dev` 和 `npm run preview` 是独立的前端预览，仍可使用浏览器本地账本，但不提供跨设备共享和自动安装更新；完整服务请使用 `npm start`。API 连接故障会明确报错，不会静默退回示例数据。

## 自动更新

参考 [NewsReader2](https://github.com/xusz12/NewsReader2) 的受管进程、稳定标签及健康检查方式，使用本项目独立的更新源 `https://github.com/xusz12/Finplot1.git`（由 `package.json` 的 `repository.url` 指定）。

- 服务启动后以及每 6 小时自动检查稳定标签，设置页也可「检查更新」。只识别 `vX.Y.Z`，按数字比较版本，不安装预发布版或降级版本。
- 发现版本后点击「安装更新 → 更新并重启」。自动检查不会未经确认安装或打断使用。
- 安装固定到检查时的标签提交；标签移动、清单或构建版本不一致会拒绝安装。
- 在数据目录 `releases/` 内单独下载、安装锁定依赖并构建，不修改源码工作区，不覆盖未提交改动。联网或构建失败时当前服务继续运行。
- 候选版本准备完成后短暂停止旧服务，验证新进程身份、版本、页面健康；成功后原子保存 `active.json` 并刷新页面，失败时恢复旧版本。服务下次启动沿用成功更新的版本。
- 账本、历史快照、日志和版本目录彼此独立；升级期间不变更账本格式。`update.json` 记录最近检查和安装结果。断电或停止导致安装中断时，下次启动报告中断并沿用已提交的版本。
- 保留旧发布目录供恢复；需要手动恢复时先停止服务，备份 `active.json`，将其恢复为其中 `previous` 的 `root`、`version` 后启动。恢复原工作区版本可移走 `active.json`。不移动或覆盖已发布标签。

## 账本数据口径

解析支持 `metadata.schema_version = 3`：`transactions`、`categories`、`category_groups`、`tags` 与 `transaction_tags`。使用基础表关联，保留分类、分组、性质、备注、来源编号及标签；检查结构、完整性、外键、日期、收支方向和金额。

- 金额从 `amount_cents` 读取，以整数分汇总，展示人民币元并保留两位小数。
- 默认包含全部性质，可筛选日常、投资、往来、调整；历史停用分类仍计入记录。
- 分类与分组两级分析；多标签不会重复计算交易。
- 日历合并同一天全部交易的收入与支出；明细保留时间、备注和标签。
- 投资页仅汇总 `nature = '投资'` 的收支，不推断持仓、成本、买卖类型或收益率。
- 快照范围外月份为空值，范围内无交易月份为零；无收入时结余率不适用。去年同期按截止日期对齐，缺少基期不产生虚构比较。

## 开发与验证

```bash
npm run dev
npm test
npm run build
npm run preview
```

应用入口 `/`，可交互设计样张 `/design-system.html`。规范见 [`docs/design-system.md`](docs/design-system.md)。采用 React、Vite、shadcn/ui、Recharts、dnd-kit、Zustand、sql.js 与 Node.js 原生 HTTP 服务；无需额外 UI 或服务器框架。字体为 SF Pro／PingFang SC 系统字体栈。

测试覆盖账本解析与金额对账、日历边界、版本一致性、共享账本持久化与冲突、请求保护、稳定标签识别、更新失败恢复和受管服务重启。测试只使用临时目录和虚构数据。可额外指定自己的快照进行只读对账与哈希校验：

```bash
FINPLOT_LEDGER_FILE='/absolute/path/to/ledger.sqlite3' \
FINPLOT_LEDGER_MANIFEST='/absolute/path/to/ledger.json' npm test
```

`FINPLOT_LEDGER_MANIFEST` 可省略；未提供快照时跳过此项。

版本号以 `package.json` 为唯一来源，构建生成 `dist/version.json` 以及 HTML 版本元数据，JS/CSS 使用内容哈希。账本和运行数据不得提交 Git。

## 发布约定

- 普通推送只更新指定分支，不自动升级版本或创建标签。
- 指定版本发布时，同步 `package.json`、锁文件、本文版本号和 `CHANGELOG.md`；基于上一发布标签至本次的完整变化记录 `feat`、`improve`、`fix`。
- 先获取远端状态，验证受影响部分；通过且代码未变化的检查不机械重复。使用简体中文提交信息，提交前审查实际暂存内容。
- 发布前再次获取远端状态，整合远端新增提交；需要整合时重新验证受影响部分，不强制覆盖。
- 将经过验证的提交整合到 `main`，创建同版本附注标签，并原子推送：`git push --atomic origin main refs/tags/vX.Y.Z`。标签创建后不移动、不覆盖。
- 推送后核对远端 `main` 和标签解引用后的提交哈希，再次获取状态并确认没有待推送提交。
- 新版更新服务以稳定标签为发布来源，标签必须包含可构建的完整服务、前端和锁文件；静态部署仍需独立部署构建。
