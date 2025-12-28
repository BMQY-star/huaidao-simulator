# Repository Guidelines

## 项目结构与模块组织
- `src/` 存放 React + TypeScript 应用。入口：`src/main.tsx`；主界面：`src/App.tsx`；样式在 `src/index.css` 与 `src/App.css`。
- 静态资源：`public/`（原样发布）与 `src/assets/`（由 Vite 打包）。
- 工具与配置：`vite.config.ts`、`eslint.config.js`、`tsconfig*.json`。

## 构建、测试与开发命令
- `npm install`：安装依赖。
- `npm run dev`：启动 Vite 开发服务器（HMR）。
- `npm run build`：执行 `tsc -b` 类型检查并生成生产包。
- `npm run preview`：本地预览生产构建。
- `npm run lint`：运行 ESLint 校验。

## 代码风格与命名规范
- 缩进：2 空格。
- 语言与文件：业务代码使用 TypeScript，JSX 写在 `.tsx` 文件中。
- 命名：组件用 PascalCase（如 `App.tsx`），变量/函数用 camelCase。
- `src/` 内使用显式相对路径导入。

## 测试指南
- 当前未配置自动化测试框架。
- 若新增测试，请放在 `src/` 下（如 `src/components/__tests__/Button.test.tsx`）。
- 在 `package.json` 中注明测试运行器与命令，并在本文更新对应说明。

## 提交与拉取请求规范
- 目前无固定提交历史约定；建议使用简短、祈使句式（如“Add landing layout”）。
- PR 需说明目的、列出手动验证步骤，涉及 UI 变更请附截图。
- 提交 PR 前建议运行 `npm run lint` 与 `npm run build`。
