# Finplot 设计系统

版本 1.2 · 面向个人财务分析及后续功能。此系统从当前 Apple 风格原型提炼而来：**安静、清晰、精确、有温度**。它是项目自己的设计语言，并非 Apple 官方设计系统。

## 入口与维护

- 可交互的视觉样张：本地运行后打开 `/design-system.html`。它与应用使用同一份令牌、基础组件与图表配色。
- 令牌唯一来源：`src/design-system/tokens.css`；图表在 JS 中通过 `src/design-system/chart.js` 引用这些 CSS 变量。
- shadcn/ui 本地源码：`src/components/ui/`，来自官方 registry；`src/components/ui.jsx` 负责导出和组合财务业务组件。Finplot 的组件样式在 `src/design-system/components.css`，页面组合和图表在 `src/App.jsx`。
- `src/design-system/shadcn.css` 将 shadcn 的语义色映射到 Finplot 令牌，并接入 Tailwind 工具类；`components.json` 和 `jsconfig.json` 记录项目配置。
- 独立入口需引入 `src/design-system/index.css`；主应用已通过 `src/styles.css` 引入。
- 使用方法：先查找现有令牌、组件和页面模式；只有无法表达新需求时才扩展。新增公共组件或令牌后，同步更新本规范与视觉样张。标准控件优先采用官方 shadcn/ui 源码并适配现有令牌；`components.json` 配置了源码、样式和别名；更新已有官方源码前，先检查本地 Finplot 适配，避免覆盖定制。

## 设计原则

1. **让布局说明关系。** 用分组、位置、对齐、间距与层级表达结构，避免重复的次级标签和描述。一个卡片只负责一件清楚的事。
2. **先理解，再装饰。** 数字、周期、单位和状态优先于装饰。中性画布、白色卡片、细边框与少量柔和蓝色保持层次稳定；避免重阴影、大面积渐变和无意义的彩色模块。
3. **从容而不含糊。** 给予留白，但不要牺牲可读性。描述财务状况时使用中性、具体且不评判的语言。
4. **优先复用 shadcn/ui。** 沿用本地官方组件和既有页面模式，再按财务场景组合；需要新基础组件时先查找官方 registry。
5. **一致服务真实任务。** 新功能沿用现有导航、周期筛选、状态提示与空状态；不要为了展示技术而增加操作。

### 信息层级与文案

> Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.

- 默认只展示有助于识别内容或完成操作的标题、数值和控件；用相邻位置、分组、对齐及留白传达它们之间的关系。
- 标题或控件已表达的意思，不再用副标题、英文眉题、重复标签、装饰性徽章或说明文字复述。次级文案仅在它提供新增信息时出现，不作为卡片或页面的默认配置。
- 精简不能省略理解财务信息或操作所必需的内容：保留适用的周期、金额单位、正负、比较基准、状态、数据来源、示例标识，以及错误、空状态或操作后果。图标按钮仍须有可访问名称；关系不能只依靠颜色或视觉位置传达。
- 例如：指标卡只需“总收入”、金额，以及有意义的周期或比较数据；无需再加“查看你的收入情况”等重复说明。日期或单位已由共同标题明确时，不必在每个相邻数值旁重复。

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
- 英文眉题或其他次级标签只在提供独立信息时使用，不作为装饰性标配。

### 间距、圆角与层次

- 标准间距：`--space-1` 至 `--space-10`，常用值为 4、8、12、16、20、24、32、40px；组合布局优先使用 12–24px。
- 控件圆角 `--radius-control` 为 8px，标准卡片 `--radius` 为 14px。卡片使用 `--border` 和轻微 `--shadow`；只有当前重点指标使用 `--hero-bg`。
- 控件应有正常、悬停、聚焦、禁用和必要的加载状态；键盘焦点不可移除。图标按钮必须有可访问名称。

## 组件与用法

标准基础组件使用 shadcn/ui 官方 registry 的本地源码，位于 `src/components/ui/`，基于 Radix 并由项目控制；视觉类名为 Finplot 令牌做了适配。当前 Button、Card、Badge、Dialog、DropdownMenu、Avatar、Table、Chart、Resizable、Toggle 和 ToggleGroup 使用官方 `new-york` registry。各文件开头保留来源地址与本地适配说明，MIT 许可保存在 `src/components/ui/LICENSE.shadcn.md`。`src/components/ui.jsx` 导出基础组件并组合业务模式，不另造基础控件。不要并行引入另一套 UI 组件库。

选择组件时依次查找现有的本地 shadcn 组件、官方 registry 的对应组件，再组合财务业务模式。引入源码时保留来源与许可、只添加必需依赖，并使用现有令牌适配 Apple 风格；官方组件不适合特定业务需求时，可以在其基础上组合或实现业务部分。不要把业务组合误称为未经修改的官方组件。

| 组件 | 用途与约束 |
| --- | --- |
| `Button` | `default` 为主要操作；`outline` 为次要操作；`ghost` / `subtle` 为低强调操作；`sm` 和 `icon` 为紧凑尺寸。普通按钮默认 `type="button"`，图标按钮须有 `aria-label`。`asChild` 可用于链接。 |
| `Card` | 内容容器；通过组合业务类名设置内容，不把页面逻辑塞入基础组件。 |
| `Badge` | 非交互的简短状态或版本信息。需要操作时用按钮，不要把标签伪装成按钮。 |
| `SegmentedControl` | 受控的单选按钮组，提供 `label`、`value`、`onValueChange`、`options`；`compact` 用于卡片内部。基于 shadcn `ToggleGroup`，通过单选语义暴露选中状态；方向键移动焦点，空格键选择。 |
| `PeriodDropdown` | 基于 shadcn `DropdownMenu`、`DropdownMenuRadioGroup` 和 `Button` 组合周期选择，提供 `label`、`value`、`onValueChange`、`options`；选中状态、方向键与 Escape 由 Radix 管理。 |
| `Dialog` / `Avatar` / `Table` | 使用对应 shadcn 组件组合弹窗、头像与语义表格。 |
| `ChartContainer` / `ChartTooltipContent` / `ChartLegendContent` | shadcn 图表容器、提示和图例（基于 Recharts）；业务组件仍需组合图形和坐标轴。提示组件本地增加 `valueFormatter` 以显示货币及零值。 |
| `SectionHeading` | 页面区块标题，可传 `title`、`meta` 和 `action`；`meta` 仅用于提供必要上下文，不默认添加装饰性标签。 |
| `MetricCard` | 格式化后的 `label`、`value`、`icon`、`change`、`comparison`、`status` 和 `tone`；仅提供有实际意义的可选信息，拖动等操作通过 `action` 注入。业务数据和计算留在调用方。 |

```jsx
import { Button, MetricCard, PeriodDropdown, SegmentedControl } from './components/ui'
import { Download, Wallet } from 'lucide-react'

<Button variant="outline"><Download size={15} />导出报表</Button>
<SegmentedControl label="时间范围" value={mode} onValueChange={setMode}
  options={[{ value: 'year', label: '年度' }, { value: 'month', label: '月度' }]} />
<PeriodDropdown label="选择年份" value={year} onValueChange={setYear}
  options={[{ value: '2025', label: '2025 年' }, { value: '2024', label: '2024 年' }]} />
<MetricCard label="收支结余" value="¥129,500.00" icon={Wallet} tone="balance"
  change="+16.1%" comparison="去年同期" status="盈余" />
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
- 日历的年月与选中日期由 Zustand 一起更新；下拉筛选与前后月按钮使用同一周期操作。目标月份存在该日期时保留，否则调整到该月最后一天；跨年时一次更新年月，避免经过临时月份。返回较长月份仍保留调整后的日期。回归检查覆盖 31→30、31→2 月、闰年 2 月 29 日→平年，以及年末/年初。
- 图标只用 Lucide，常用尺寸 15–18px、描边约 1.7–2px。图标应辅助文字；仅图标的操作必须有 `aria-label`。
- 复杂弹窗使用 shadcn Dialog（基于 Radix），提供标题、关闭与焦点管理；需要解释操作或后果时再提供描述。破坏性操作、空状态、错误和加载状态应明确说明结果和下一步。

### 动效归属与优先级

**组件自带动效优先，已有动画不重复制作、不叠加第二层。** 统一的是动效原则与适用边界，不要求所有动画由同一个库执行。

| 场景 | 负责实现 | 约束 |
| --- | --- | --- |
| 图表入场、数据变化、提示位置 | Recharts 自带动画 | 保留默认节奏；不套 Motion 重写曲线、扇区、柱形或提示动画。 |
| 按钮、菜单等组件的状态反馈 | shadcn/Radix 组件自身 CSS 或内置动效 | 优先保留组件实现；不另包 `motion` 元素重复动画。 |
| 拖拽与排序 | dnd-kit | 复用内置位移和排序过渡；不让 Motion 接管同一元素的 transform。 |
| 额外页面切换或业务动效 | Motion | 仅在现有组件没有负责该动效时使用；页面切换约 200ms，轻微位移与淡入淡出，避免弹跳和长时间循环。 |

`src/design-system/motion.js` 只订阅系统的 `prefers-reduced-motion` 偏好，不实现动画。主应用和设计系统样张使用同一偏好：Recharts 图形及 Tooltip 通过自身 `isAnimationActive` 开关关闭动画；dnd-kit 关闭排序过渡，直接拖动仍可用；Motion 页面取消位移与过渡；组件 CSS 由现有媒体查询缩短过渡。偏好改变后立即生效，无需刷新。尊重减少动态效果属于组件配置，不应因此增加另一套动画实现。

## 文案与扩展检查

使用简短、具体、温和的中文；不要因用户支出或盈亏作价值判断。按钮写动作（如“导出报表”），状态写事实（如“暂无交易”），演示与真实数据必须可区分。

交付新功能前确认：

1. 是否优先使用本地或官方 shadcn 组件、现有令牌和布局模式；是否避免了重复依赖？
2. 分组和层级能否解释关系；次级标签、眉题和描述是否提供了不可缺少的新信息？
3. 周期、单位、正负、空值、比较基准和必要状态是否准确且可见？
4. 键盘、焦点、可访问名称、颜色对比、减少动态效果及小屏是否检查过？
5. 是否复用组件自带动效、避免重复叠加；额外动效是否仅在需要时使用 Motion？
6. 新增或修改的公共组件、令牌与图表语义，是否同步到本文档和 `/design-system.html`？
