# 项目设计与实现约定

- 涉及界面或新增功能时，先阅读 `docs/design-system.md`，并参考 `/design-system.html` 的实际样张。
- 复用 `src/design-system/tokens.css`、`src/components/ui.jsx` 和既有页面模式；扩展公共组件或令牌时同步更新规范与样张。
- UI 使用 `src/components/ui/` 中基于 shadcn/ui 官方 registry 的本地组件源码；业务组件通过组合这些组件实现；图标、动效、可调面板、拖拽、状态和图表分别使用 Lucide、Motion、react-resizable-panels、dnd-kit、Zustand、shadcn Chart（Recharts），避免同职责重复依赖。
- 字体使用 Apple 系统 SF Pro 与 PingFang SC 栈，未安装时回退系统字体；不擅自添加远程字体或打包系统字体。
- 财务数值必须清楚标明周期、单位、正负与状态；示例或模拟行为必须明确标记。新增交互应检查键盘、可访问名称、对比度、减少动态效果和窄屏布局。
- 遵守会话中的全局 Git 规则：提交信息使用简体中文。
