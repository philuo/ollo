# 无限画布 TileMap 工具

> 基于 WebGPU 的高性能无限画布网格绘制工具

## 📖 概述

这是一个专为游戏开发和像素艺术设计打造的无限画布工具，使用最新的 WebGPU 技术实现高性能的网格渲染和交互。

## ✨ 核心特性

### 🎨 有限网格画布
- 512 × 512 网格系统
- 等距分布的网格单元
- 流畅的 60 FPS 渲染
- 默认居中显示

### 🖌️ 背景设置
- 预设颜色：黑 / 白
- 自定义颜色选择器
- 实时颜色预览

### 📐 网格自定义
- 网格范围：512 × 512 单元
- 可调节单元尺寸（16-128px，默认64px）
- 自定义边框宽度（0.5-5px）
- 自定义边框颜色
- 显示/隐藏切换

### 🎮 丰富的交互
- 鼠标滚轮缩放（20%-400%，默认75%）
- Alt+拖动 或 中键拖动平移
- 鼠标悬浮高亮网格
- 实时坐标显示

## 🚀 快速开始

详见 [QUICK_START.md](./QUICK_START.md)

```bash
# 1. 启动开发服务器
npm run dev

# 2. 访问 http://localhost:5173

# 3. 选择 "TileMap 编辑器" → "无限画布"
```

## 📚 文档

- **[QUICK_START.md](./QUICK_START.md)** - 快速启动指南
- **[INFINITE_CANVAS.md](./INFINITE_CANVAS.md)** - 详细功能文档
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - 技术实现总结

## 🏗️ 架构

```
src/tilemap/
├── InfiniteCanvas.tsx          # React UI 组件
├── InfiniteCanvas.css          # 样式文件
├── InfiniteCanvasRenderer.ts   # WebGPU 渲染引擎
├── TilemapApp.tsx              # 应用入口
├── TilemapApp.css              # 应用样式
└── index.ts                    # 模块导出
```

## 🔧 技术栈

- **前端框架**: Solid.js
- **渲染技术**: WebGPU
- **着色器语言**: WGSL
- **类型支持**: TypeScript

## 🎯 使用场景

- 🎮 游戏地图设计
- 🖼️ 像素艺术创作
- 📊 网格布局规划
- 🏗️ 瓦片地图编辑

## 🌐 浏览器支持

| 浏览器 | 版本 | 状态 |
|--------|------|------|
| Chrome | 113+ | ✅ |
| Edge   | 113+ | ✅ |
| Safari | 17.4+ | ✅ |
| Opera  | 99+  | ✅ |
| Firefox | -   | ⚠️ |

## 📊 性能指标

- **帧率**: 60 FPS
- **缩放范围**: 20% - 400%（默认75%）
- **网格范围**: 512 × 512 单元
- **单元尺寸**: 16px - 128px（默认64px）
- **响应延迟**: < 16ms

## 🔮 未来计划

- [ ] 绘制工具（画笔、橡皮擦）
- [ ] 图层系统
- [ ] 撤销/重做
- [ ] 导出为图片
- [ ] 瓦片素材库
- [ ] 选区工具
- [ ] 填充工具
- [ ] 键盘快捷键

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

与项目主体保持一致。

---

**Made with ❤️ using WebGPU**

