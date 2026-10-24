# Focus

一个帮你一次只专注一件事的番茄钟桌面应用，支持 Windows 和 macOS，基于 [Tauri 2](https://tauri.app)。

## 功能

- [x] 专注 / 短休息 / 长休息计时，开始、暂停、重置、跳过（空格键开始/暂停）
- [x] 每轮开始前写下“这一轮专注在什么事上”
- [x] 窗口标题实时显示剩余时间
- [x] 自定义时长（专注、短休息、长休息、长休息间隔），设置会保存
- [x] 阶段结束时的系统通知和提示音（可分别关闭）
- [x] 休息时在每块屏幕上显示全屏遮罩，休息自动开始、结束后自动消失（可设置是否允许紧急跳过）
- [ ] 本地记录 + 统计页面

## 本地开发

需要 [Node.js 22+](https://nodejs.org) 和 [Rust](https://rustup.rs)，以及 Tauri 的[系统依赖](https://tauri.app/start/prerequisites/)。

```bash
npm install
npm run tauri dev     # 启动桌面应用（热更新）
npm test              # 运行计时逻辑的单元测试
npm run tauri build   # 打包安装程序
```

## 下载安装包

每次推送到 `main` 后，GitHub Actions 会构建 macOS（`.dmg`，同时支持 Intel 和 Apple 芯片）和 Windows（`.msi` / `.exe`）安装包，可以在对应运行记录的 Artifacts 里下载。

> 安装包目前没有签名：macOS 首次打开时需要右键点“打开”，Windows 可能会弹出 SmartScreen 提示，点“仍要运行”即可。
