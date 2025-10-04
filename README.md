## 资源包

位于 `src/sprites` 中，它包含（字符、图块集、对象等）PNG 格式的精灵图。

- Player或Enemy目录中有子目录，每个子目录中按顺序存放了角色的序列帧图片。
- 所有动画以 20 FPS 或 50 MS 运行。


## 任务

在 `src/scenes` 中基于WebGPU实现加载资源包的角色并按要求可以播放、暂停动画。并整理好说明文档放置于docs/PirateBomb/README.md

✅ **任务已完成** - 查看 [技术文档](docs/PirateBomb/README.md) 了解详细信息。

## 功能特性

- ✅ 基于 WebGPU 的高性能渲染引擎
- ✅ 精灵序列帧动画系统 (20 FPS / 50ms)
- ✅ 支持多角色切换 (Player, Bald Pirate, Cucumber)
- ✅ 支持多动画播放 (Idle, Run, Jump, Attack 等)
- ✅ 完整的播放控制 (播放、暂停、停止)
- ✅ 实时动画状态显示
- ✅ 现代化的用户界面

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开浏览器访问显示的地址，确保浏览器支持 WebGPU (Chrome 113+, Edge 113+, Firefox 115+, Safari 17+)。

## 项目结构

```
src/
├── main.tsx                          # 应用入口
└── scenes/
    ├── App.tsx                       # 主应用组件
    ├── App.css                       # 样式文件
    └── webgpu/                       # WebGPU 渲染引擎
        ├── Renderer.ts               # WebGPU 渲染器核心
        ├── TextureLoader.ts          # 纹理加载和管理
        ├── SpriteAnimation.ts        # 精灵动画系统
        ├── SpriteRenderer.ts         # 精灵渲染器
        └── CharacterController.ts    # 角色控制器
```

