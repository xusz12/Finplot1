# Finplot · 个人财务分析

当前版本：**v0.1.1** · [版本记录](CHANGELOG.md)

一个采用 Apple 风格的个人财务分析应用，支持在浏览器本地读取 StaffX SQLite 账本。包含年度／月度总览、收支分类、日历、投资记录和设置，以及 CSV 导出、卡片排序和面板宽度调整。未导入账本时显示明确标记的示例数据。

## 本地运行

```bash
npm ci
npm run dev
```

使用 Node.js 22 或更新的受支持版本。应用入口为 `/`，设计系统样张为 `/design-system.html`。

## 验证与构建

```bash
npm test
npm run build
npm run preview
```

- 测试包括 SQLite v3 解析、整数分汇总、分类／分组／性质、同日多笔交易、多标签去重、历史停用分类、零收入、空账本、同期截止日期、CSV、异常文件，以及日历边界和发布版本资料的一致性。
- 构建产物位于 `dist/`，可部署到静态网站服务；`npm run preview` 用于本地检查生产构建。
- 版本号以 `package.json` 为来源，页面直接引用；构建自动生成 `dist/version.json` 和两个入口的版本元数据。JS/CSS 资源使用 Vite 内容哈希，无需手工维护资源版本。

## 接入 StaffX 账本

1. 打开「设置 → 选择文件」，选择完整的 `.sqlite3`、`.sqlite` 或 `.db` 快照（最大 100 MB）。`manifests/ledger_*.json` 只是备份清单，不能替代数据库。
2. 读取成功后显示文件名、收支笔数和最新交易时间，周期自动定位至最新交易所在年月。年份范围来自数据库。
3. 账本副本保存在当前浏览器、当前站点的 IndexedDB 中，刷新后恢复；更换浏览器或站点地址时需要重新选择。浏览器存储不可用时会提示仅本次页面有效。
4. 新快照通过「更换账本」重新读取。应用不会监控源文件；「移除本机副本，返回示例」只移除浏览器副本。读取失败保留当前账本。

解析支持 `metadata.schema_version = 3`：`transactions`、`categories`、`category_groups`、`tags` 与 `transaction_tags`。使用基础表关联，保留分类、分组、性质、备注、来源编号及标签；`category_aliases`、`import_batches` 和视图不参与金额聚合。检查结构、完整性、外键、日期、收支方向和金额。

- 金额从 `amount_cents` 读取，以整数分汇总，展示／导出时转换为人民币元并保留两位小数。
- 默认总览包括全部性质，投资、往来、调整均计入收支；可筛选「日常／投资／往来／调整」。历史停用分类仍计入历史记录。
- 分类页支持分类和分组两级；标签单独读取，多标签不会使交易重复计数。
- 日历显示当天所有交易的收入与支出合计，明细保留时间、备注和标签；窄屏日历以标记提示，选中日期查看精确金额。
- 投资页仅汇总 `nature = '投资'` 的收支，不推断证券名称、买卖类型、持仓、成本或收益率。
- 快照日期范围以外的月份保留空值；范围内无交易的月份为零。无收入时结余率不适用。去年同期按快照截止日对齐，缺少基期时不显示虚构比较。
- CSV 导出遵循当前年月与性质，附交易数、数据状态及金额单位。年度趋势和逐月结余仍明确显示全年。

可对自己的快照执行只读对账（实际路径仅通过环境变量传入，不应将个人账本加入仓库）：

```bash
FINPLOT_LEDGER_FILE='/absolute/path/to/ledger.sqlite3' \
FINPLOT_LEDGER_MANIFEST='/absolute/path/to/ledger.json' npm test
```

`FINPLOT_LEDGER_MANIFEST` 可省略。集成测试使用 Python 3 的原生 SQLite 与前端解析结果逐月、分类、性质、每日对账，并核对原文件哈希；没有传入快照时跳过该项。测试用的小型账本在内存生成，不含个人记录。

## 设计系统

- 规范与扩展规则：[`docs/design-system.md`](docs/design-system.md)
- 视觉样张：本地运行后访问 `/design-system.html`
- 公共令牌和业务组合：`src/design-system/`、`src/components/ui.jsx`；shadcn/ui 本地源码：`src/components/ui/`

## 技术说明

- React + Vite；本地可控的 shadcn/ui 官方组件源码（Radix 基础）与 Tailwind CSS 工具类
- Apple 系统字体 SF Pro 与 PingFang SC；其他平台使用系统备用字体
- Lucide 图标、shadcn Chart（基于 Recharts）；组件自带动效优先，Motion 用于额外页面与业务动效
- react-resizable-panels 调整图表面板；dnd-kit 排序；Zustand 管理界面状态
- sql.js / WebAssembly 在浏览器中只读解析所选数据库，WASM 随应用构建，不从外部 CDN 加载。数据库及交易记录不上传、不打包入源码或静态资源，也不修改原始文件。
- 界面偏好使用 localStorage；财务快照仅使用 IndexedDB。设计系统样张始终使用虚构数据。应用未接入自动更新服务。

## 发布约定

- 普通推送只更新指定分支，不自动升级版本或创建标签。
- 指定版本发布时，同步 `package.json`、锁文件、本文版本号和 `CHANGELOG.md`；基于上一发布标签至本次的完整变化记录 `feat`、`improve`、`fix`。首次发布以完整项目历史为基线。
- 先获取远端状态，再验证受影响部分；已通过且代码未变化的检查不机械重复。使用简体中文提交信息，提交前审查实际暂存内容。
- 发布前再次获取远端状态，整合远端新增提交；需要整合时重新验证受影响部分，不强制覆盖。
- 将经过验证的提交整合到 `main`，创建同版本的附注标签，并原子推送两个引用：`git push --atomic origin main refs/tags/vX.Y.Z`。发布标签创建后不移动、不覆盖。
- 推送后核对远端 `main` 和标签解引用后的提交哈希，再次获取状态并确认没有待推送提交。
- Git 标签标记源码版本，当前原型没有自动更新器；已有静态站点需要部署对应构建才会更新。设计系统的规范修订号独立于应用版本。
