# Finplot · 个人财务分析

一个采用 Apple 风格的个人财务分析交互原型，使用示例数据。包含年度／月度总览、收支分类、日历、投资记录和设置，以及 CSV 导出、卡片排序和面板宽度调整。

## 本地运行

```bash
npm install
npm run dev
```

## 设计系统

- 规范与扩展规则：[`docs/design-system.md`](docs/design-system.md)
- 视觉样张：本地运行后访问 `/design-system.html`
- 公共令牌和业务组合：`src/design-system/`、`src/components/ui.jsx`；shadcn/ui 本地源码：`src/components/ui/`

## 技术说明

- React + Vite；本地可控的 shadcn/ui 官方组件源码（Radix 基础）与 Tailwind CSS 工具类
- Apple 系统字体 SF Pro 与 PingFang SC；其他平台使用系统备用字体
- Lucide 图标、Motion 动效、shadcn Chart（基于 Recharts）
- react-resizable-panels 调整图表面板；dnd-kit 排序；Zustand 管理界面状态
- 所有财务数据均为虚构样例。SQLite 文件选择和版本更新是原型交互，不读取数据库、不上传文件，也不连接真实更新服务。
