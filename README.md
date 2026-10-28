# Finplot · 个人财务分析

当前版本：**v0.1.0** · [版本记录](CHANGELOG.md)

一个采用 Apple 风格的个人财务分析交互原型，使用示例数据。包含年度／月度总览、收支分类、日历、投资记录和设置，以及 CSV 导出、卡片排序和面板宽度调整。

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

- 测试包括日历短月、闰年和跨年边界，以及发布版本资料的一致性。
- 构建产物位于 `dist/`，可部署到静态网站服务；`npm run preview` 用于本地检查生产构建。
- 版本号以 `package.json` 为来源，页面直接引用；构建自动生成 `dist/version.json` 和两个入口的版本元数据。JS/CSS 资源使用 Vite 内容哈希，无需手工维护资源版本。

## 设计系统

- 规范与扩展规则：[`docs/design-system.md`](docs/design-system.md)
- 视觉样张：本地运行后访问 `/design-system.html`
- 公共令牌和业务组合：`src/design-system/`、`src/components/ui.jsx`；shadcn/ui 本地源码：`src/components/ui/`

## 技术说明

- React + Vite；本地可控的 shadcn/ui 官方组件源码（Radix 基础）与 Tailwind CSS 工具类
- Apple 系统字体 SF Pro 与 PingFang SC；其他平台使用系统备用字体
- Lucide 图标、shadcn Chart（基于 Recharts）；组件自带动效优先，Motion 用于额外页面与业务动效
- react-resizable-panels 调整图表面板；dnd-kit 排序；Zustand 管理界面状态
- 所有财务数据均为虚构样例。SQLite 文件选择和版本更新是原型交互，不读取数据库、不上传文件，也不连接真实更新服务。

## 发布约定

- 普通推送只更新指定分支，不自动升级版本或创建标签。
- 指定版本发布时，同步 `package.json`、锁文件、本文版本号和 `CHANGELOG.md`；基于上一发布标签至本次的完整变化记录 `feat`、`improve`、`fix`。首次发布以完整项目历史为基线。
- 先获取远端状态，再验证受影响部分；已通过且代码未变化的检查不机械重复。使用简体中文提交信息，提交前审查实际暂存内容。
- 发布前再次获取远端状态，整合远端新增提交；需要整合时重新验证受影响部分，不强制覆盖。
- 将经过验证的提交整合到 `main`，创建同版本的附注标签，并原子推送两个引用：`git push --atomic origin main refs/tags/vX.Y.Z`。发布标签创建后不移动、不覆盖。
- 推送后核对远端 `main` 和标签解引用后的提交哈希，再次获取状态并确认没有待推送提交。
- Git 标签标记源码版本，当前原型没有自动更新器；已有静态站点需要部署对应构建才会更新。设计系统的规范修订号独立于应用版本。
