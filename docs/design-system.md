# Finplot 设计系统

版本 1.0 · 面向个人财务分析及后续功能。此系统从当前 Apple 风格原型提炼而来：**安静、清晰、精确、有温度**。它是项目自己的设计语言，并非 Apple 官方设计系统。

## 入口与维护

- 可交互的视觉样张：本地运行后打开 `/design-system.html`。它与应用使用同一份令牌、基础组件与图表配色。
- 令牌唯一来源：`src/design-system/tokens.css`；图表在 JS 中通过 `src/design-system/chart.js` 引用这些 CSS 变量。
- shadcn/ui 本地源码：`src/components/ui/`，来自官方 registry；`src/components/ui.jsx` 负责导出和组合财务业务组件。Finplot 的组件样式在 `src/design-system/components.css`，页面组合和图表在 `src/App.jsx`。
- `src/design-system/shadcn.css` 将 shadcn 的语义色映射到 Finplot 令牌，并接入 Tailwind 工具类；`components.json` 和 `jsconfig.json` 记录项目配置。
- 独立入口需引入 `src/design-system/index.css`；主应用已通过 `src/styles.css` 引入。
- 使用方法：先查找现有令牌、组件和页面模式；只有无法表达新需求时才扩展。新增公共组件或令牌后，同步更新本规范与视觉样张。标准控件优先采用官方 shadcn/ui 源码并适配现有令牌；`components.json` 配置了源码、样式和别名；更新已有官方源码前，先检查本地 Finplot 适配，避免覆盖定制。

## 设计原则

1. **先理解，再装饰。** 数字、周期、单位和状态优先于装饰。一个卡片只负责一件清楚的事。
2. **层次轻，结构稳。** 中性画布、白色卡片、细边框、少量柔和蓝色；避免重阴影、大面积渐变和无意义的彩色模块。
3. **从容而不含糊。** 给予留白，但不要牺牲可读性。描述财务状况时使用中性、具体且不评判的语言。
4. **一致服务真实任务。** 新功能沿用现有导航、周期筛选、状态提示与空状态；不要为了展示技术而增加操作。

## 基础令牌

所有新界面通过 `var(--token)` 使用令牌，不在业务组件内复制固定色值。以下是常用项；完整定义以 `tokens.css` 为准。

| 用途 | 令牌 | 当前值 |
| --- | --- | --- |
| 页面 / 侧栏 | `--bg` / `--sidebar` | `#f7f8f7` |
| 卡片 / 导航选中 | `--card` / `--nav-active` | `#ffffff` |
| 主文字 / 次要文字 | `--text` / `--soft-text` | `#252d2b` / `#6e7975` |
| 边框 / 悬停 | `--border` / `--hover` | `#e8ece9` / `#f4f6f4` |
| 强调 / 可交互文字 | `--accent` / `--interactive-text` | `#678be2` / `#4868aa` |
| 重点卡片底色 / 边框 | `--hero-bg` / `--hero-border` | `#f0f5ff` / `#e5edfc` |
| 收入 / 支出曲线 | `--income` / `--expense` | `#7095ea` / `#bcc9db` |
| 分类图表 | `--chart-1` 至 `--chart-6` | 由深至浅的蓝灰系列 |
| 键盘焦点 | `--focus-ring` | 由收入蓝生成的半透明焦点色 |

`--muted` 保留给弱化的装饰和历史界面；新增可读文字优先用 `--text` 或 `--soft-text`，链接优先用 `--interactive-text`。已有原型中部分小字和浅色文字仍需逐步提升对比度，不应把它们当作无障碍合格范例。新增内容须在实际前景与背景组合上检查对比度：普通文字目标至少 4.5:1，大号文字至少 3:1。颜色不能是传达信息的唯一方式。

### 字体与排版

- `--font-ui` 使用 Apple 系统字体（SF Pro）与 PingFang SC；头像等中文专用位置可使用 `--font-cjk`。系统字体不随项目打包；不可用时按字体栈回退。
- 页面标题通常约 29px、指标金额约 22px、卡片标题约 13–14px。具体字号随断点调整；正文优先保证可读，新增正文一般不小于 12px。
- 金额使用 `font-variant-numeric: tabular-nums`，保持列和变化值稳定对齐；金额、百分比、日期采用一致格式，不靠颜色表示正负。
- 大写英文眉题只做简短辅助标签，不代替中文标题或说明。

### 间距、圆角与层次

- 标准间距：`--space-1` 至 `--space-10`，常用值为 4、8、12、16、20、24、32、40px；组合布局优先使用 12–24px。
- 控件圆角 `--radius-control` 为 8px，标准卡片 `--radius` 为 14px。卡片使用 `--border` 和轻微 `--shadow`；只有当前重点指标使用 `--hero-bg`。
- 控件应有正常、悬停、聚焦、禁用和必要的加载状态；键盘焦点不可移除。图标按钮必须有可访问名称。

## 组件与用法

标准基础组件使用 shadcn/ui 官方 registry 的本地源码，位于 `src/components/ui/`，基于 Radix 并由项目控制；视觉类名为 Finplot 令牌做了适配。当前 Button、Card、Badge、Dialog、DropdownMenu、Avatar、Table、Chart、Resizable、Toggle 和 ToggleGroup 使用官方 `new-york` registry。各文件开头保留来源地址与本地适配说明，MIT 许可保存在 `src/components/ui/LICENSE.shadcn.md`。`src/components/ui.jsx` 导出基础组件并组合业务模式，不另造基础控件。不要并行引入另一套 UI 组件库。

| 组件 | 用途与约束 |
| --- | --- |
| `Button` | `default` 为主要操作；`outline` 为次要操作；`ghost` / `subtle` 为低强调操作；`sm` 和 `icon` 为紧凑尺寸。普通按钮默认 `type="button"`，图标按钮须有 `aria-label`。`asChild` 可用于链接。 |
| `Card` | 内容容器；通过组合业务类名设置内容，不把页面逻辑塞入基础组件。 |
| `Badge` | 非交互的简短状态或版本信息。需要操作时用按钮，不要把标签伪装成按钮。 |
| `SegmentedControl` | 受控的单选按钮组，提供 `label`、`value`、`onValueChange`、`options`；`compact` 用于卡片内部。基于 shadcn `ToggleGroup`，通过单选语义暴露选中状态；方向键移动焦点，空格键选择。 |
| `PeriodDropdown` | 基于 shadcn `DropdownMenu`、`DropdownMenuRadioGroup` 和 `Button` 组合周期选择，提供 `label`、`value`、`onValueChange`、`options`；选中状态、方向键与 Escape 由 Radix 管理。 |
| `Dialog` / `Avatar` / `Table` | 使用对应 shadcn 组件组合弹窗、头像与语义表格。 |
| `ChartContainer` / `ChartTooltipContent` / `ChartLegendContent` | shadcn 图表容器、提示和图例（基于 Recharts）；业务组件仍需组合图形和坐标轴。提示组件本地增加 `valueFormatter` 以显示货币及零值。 |
| `SectionHeading` | 页面区块标题，可传 `title`、`meta` 和 `action`；保持标题层级清晰。 |
| `MetricCard` | 格式化后的 `label`、`value`、`icon`、`change`、`comparison`、`status` 和 `tone`；拖动等可选操作通过 `action` 注入。业务数据和计算留在调用方。 |

```jsx
import { Button, MetricCard, PeriodDropdown, SegmentedControl } from './components/ui'
import { Download, Wallet } from 'lucide-react'

<Button variant="outline"><Download size={15} />导出报表</Button>
<SegmentedControl label="时间范围" value={mode} onValueChange={setMode}
  options={[{ value: 'year', label: '年度' }, { value: 'month', label: '月度' }]} />
<PeriodDropdown label="选择年份" value={year} onValueChange={setYear}
  options={[{ value: '2025', label: '2025 年' }, { value: '2024', label: '2024 年' }]} />
<MetricCard label="收支结余" value="¥129,500.00" icon={Wallet} tone="balance"
  change="+16.1%" comparison="去年同期" status="盈余 · 收支健康" />
```

上述路径以 `src` 为相对位置。组件呈现样式，不负责数据计算；调用方负责真实数值、货币单位、比较基准和状态含义。不要把缺失数据显示为零。

## 财务数据与图表

- 总览先呈现收入、支出、结余和状态，再展示趋势、构成与明细。任何比较都必须标出周期与基准。
- 保持金额符号和语义：收入、支出、盈利、亏损和结余是不同概念；盈余、超支、平衡用文字明确表达。百分比变化与百分点变化不能混用。
- 收入曲线使用 `--income`，支出曲线使用 `--expense`；分类使用 `withChartColors(items)`，不要另建重复调色板。顺序、标签和图例要稳定；给图表提供单位及可读取的数据或文字说明。
- 图表使用 shadcn `ChartContainer`、`ChartTooltipContent` 和适用的 `ChartLegendContent`，底层复用 Recharts；财务分类列表等特定业务内容由页面组合。空数据、负值、长标签、小屏和颜色相近情况都需检查。图形是辅助，不替代准确数值。
- 示例数据、模拟文件接入或模拟更新必须明确标记；不得将演示行为呈现为真实连接。

## 布局与交互

- 桌面使用侧栏、页面标题、周期筛选和卡片网格；`1020px` 以下压缩侧栏，`760px` 以下主要内容单列，`480px` 以下进一步收紧间距。新增页面应检查这些断点及键盘访问。
- 工作区尺寸调整使用 shadcn `Resizable`（基于 `react-resizable-panels`）；拖动排序使用 `dnd-kit`，提供可见手柄和键盘操作；跨组件状态使用 Zustand。不要为同一职责引入第二套库。
- 图标只用 Lucide，常用尺寸 15–18px、描边约 1.7–2px。图标应辅助文字；仅图标的操作必须有 `aria-label`。
- 动效使用 Motion，页面切换约 200ms、轻微位移与淡入淡出；避免弹跳和长时间循环。遵循 `prefers-reduced-motion`，减少动态效果时跳过位移和过渡。
- 复杂弹窗使用 shadcn Dialog（基于 Radix），提供标题、描述、关闭与焦点管理。破坏性操作、空状态、错误和加载状态应明确说明结果和下一步。

## 文案与扩展检查

使用简短、具体、温和的中文；不要因用户支出或盈亏作价值判断。按钮写动作（如“导出报表”），状态写事实（如“暂无交易”），演示与真实数据必须可区分。

交付新功能前确认：

1. 是否复用了令牌、基础组件、Lucide 和既有布局模式；是否避免了重复依赖？
2. 周期、单位、正负、空值与比较基准是否准确且可见？
3. 键盘、焦点、可访问名称、颜色对比、减少动态效果及小屏是否检查过？
4. 新增或修改的公共组件、令牌与图表语义，是否同步到本文档和 `/design-system.html`？
