# 项目设计与实现约定

- 涉及界面或新增功能时，先阅读 `docs/design-system.md`，并参考 `/design-system.html` 的实际样张。
- 复用 `src/design-system/tokens.css`、`src/components/ui.jsx` 和既有页面模式；扩展公共组件或令牌时同步更新规范与样张。
- 界面组件优先复用 `src/components/ui/` 中的 shadcn/ui 官方源码；缺少合适组件时先考虑引入官方 registry 源码，再适配现有令牌并组合业务组件。避免为同一职责自建基础控件或引入重复 UI 库。图标、动效、可调面板、拖拽、状态和图表分别使用 Lucide、Motion、react-resizable-panels、dnd-kit、Zustand、shadcn Chart（Recharts）。
- 避免不必要的次级标签和描述，让分组、对齐、间距和层级说明关系；保留理解财务数据、操作结果和无障碍所必需的信息。
- 字体使用 Apple 系统 SF Pro 与 PingFang SC 栈，未安装时回退系统字体；不擅自添加远程字体或打包系统字体。
- 财务数值必须清楚标明周期、单位、正负与状态；示例或模拟行为必须明确标记。新增交互应检查键盘、可访问名称、对比度、减少动态效果和窄屏布局。
- 遵守会话中的全局 Git 规则：提交信息使用简体中文。
