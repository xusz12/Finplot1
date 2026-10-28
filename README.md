# Finplot · 五种财务视角

一个基于同一套示例数据的个人财务分析交互原型，可以在 Apple、Arc、Claude、GitHub 和 OpenAI 风格之间切换。包含年度／月度总览、收支分类、日历、投资记录和设置，以及 CSV 导出、卡片排序和面板宽度调整。

## 本地运行

```bash
npm install
npm run dev
```

## 技术说明

- React + Vite；本地可控的 shadcn 风格基础组件、Radix UI
- Lucide 图标、Motion 动效、Recharts 图表
- react-resizable-panels 调整图表面板；dnd-kit 排序；Zustand 管理界面状态
- 所有财务数据均为虚构样例。SQLite 文件选择和版本更新是原型交互，不读取数据库、不上传文件，也不连接真实更新服务。
