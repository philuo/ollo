# WebGPU 精灵动画播放器 - 技术文档

## 项目概述

本项目基于 **WebGPU** 技术实现了一个精灵动画播放器，可以加载和播放《Pirate Bomb》游戏资源包中的角色序列帧动画。项目采用现代化的架构设计，使用 Solid.js 作为前端框架，TypeScript 作为开发语言。

## 技术栈

- **WebGPU**: 新一代图形API，提供高性能的GPU渲染能力
- **Solid.js**: 响应式UI框架
- **TypeScript**: 类型安全的JavaScript超集
- **Vite**: 现代化的构建工具

## 项目结构

```
src/scenes/
├── App.tsx                           # 主应用组件
├── App.css                           # 样式文件
└── webgpu/
    ├── Renderer.ts                   # WebGPU 渲染器核心类
    ├── TextureLoader.ts              # 纹理加载和管理
    ├── SpriteAnimation.ts            # 精灵动画系统
    ├── SpriteRenderer.ts             # 精灵渲染器
    └── CharacterController.ts        # 角色控制器（统一管理）
```

## 核心模块说明

### 1. Renderer（渲染器）

**位置**: `src/scenes/webgpu/Renderer.ts`

**职责**:
- 初始化和管理 WebGPU 上下文
- 配置 Canvas 渲染环境
- 提供渲染管线创建接口
- 管理 GPU 设备和上下文

**关键方法**:
- `async init()`: 初始化 WebGPU，请求 GPU 适配器和设备
- `getDevice()`: 获取 GPU 设备实例
- `getContext()`: 获取 Canvas WebGPU 上下文
- `clear()`: 清除画布
- `createRenderPipeline()`: 创建渲染管线

**技术要点**:
- 使用 `navigator.gpu.requestAdapter()` 请求 GPU 适配器
- 配置 Canvas 上下文格式为首选格式 `navigator.gpu.getPreferredCanvasFormat()`
- 支持透明度混合模式 `alphaMode: 'premultiplied'`

### 2. TextureLoader（纹理加载器）

**位置**: `src/scenes/webgpu/TextureLoader.ts`

**职责**:
- 加载图片资源并转换为 GPU 纹理
- 管理纹理缓存，避免重复加载
- 创建纹理采样器和绑定组

**关键方法**:
- `async loadTexture(url)`: 加载单个纹理
- `async loadTextures(urls)`: 批量加载纹理
- `createTextureBindGroup()`: 创建纹理绑定组
- `clearCache()`: 清理缓存

**技术要点**:
- 使用 `createImageBitmap()` 创建位图
- 使用 `copyExternalImageToTexture()` 将图片数据拷贝到 GPU
- 纹理格式为 `rgba8unorm`
- 采样器设置为 `nearest` 以保持像素风格

### 3. SpriteAnimation（精灵动画系统）

**位置**: `src/scenes/webgpu/SpriteAnimation.ts`

**职责**:
- 管理序列帧动画配置
- 控制动画播放、暂停、停止
- 按照 20 FPS (50ms/帧) 更新动画帧
- 提供当前帧纹理

**关键方法**:
- `addAnimation(config)`: 添加动画配置
- `async loadAnimation(name)`: 加载动画资源
- `play(name)`: 播放动画
- `pause()`: 暂停动画
- `stop()`: 停止动画
- `update(currentTime)`: 更新动画状态
- `getCurrentTexture()`: 获取当前帧纹理

**技术要点**:
- 帧率固定为 20 FPS，即每帧间隔 50ms
- 使用 `performance.now()` 获取高精度时间戳
- 循环播放动画序列
- 独立管理每个动画的纹理序列

### 4. SpriteRenderer（精灵渲染器）

**位置**: `src/scenes/webgpu/SpriteRenderer.ts`

**职责**:
- 在屏幕上绘制精灵
- 管理顶点和索引缓冲区
- 创建和配置渲染管线

**关键技术**:

#### WGSL 着色器
项目使用 WebGPU 的着色器语言 WGSL (WebGPU Shading Language)：

**顶点着色器**:
```wgsl
@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  output.texCoord = input.texCoord;
  return output;
}
```

**片段着色器**:
```wgsl
@fragment
fn fs_main(@location(0) texCoord: vec2f) -> @location(0) vec4f {
  return textureSample(myTexture, mySampler, texCoord);
}
```

#### 顶点数据
- 使用矩形网格 (4个顶点, 2个三角形)
- 每个顶点包含: 位置 (x, y) 和纹理坐标 (u, v)
- 使用索引缓冲区优化渲染

**关键方法**:
- `init()`: 初始化缓冲区和管线
- `render(texture)`: 渲染精灵纹理

### 5. CharacterController（角色控制器）

**位置**: `src/scenes/webgpu/CharacterController.ts`

**职责**:
- 统一管理所有角色和动画
- 整合 Renderer、TextureLoader、SpriteAnimation、SpriteRenderer
- 提供简单的 API 接口
- 管理渲染循环

**关键方法**:
- `async init()`: 初始化所有子系统
- `registerCharacter(config)`: 注册角色配置
- `async loadCharacter(name)`: 加载角色所有动画
- `playAnimation(name)`: 播放指定动画
- `pauseAnimation()`: 暂停当前动画
- `stopAnimation()`: 停止动画
- `getAnimationStatus()`: 获取动画状态信息

**工作流程**:
1. 创建 Renderer 实例
2. 调用 `init()` 初始化 WebGPU
3. 初始化成功后创建 TextureLoader、SpriteAnimation、SpriteRenderer
4. 注册角色配置（包含所有动画信息）
5. 加载角色资源（批量加载所有动画帧）
6. 播放动画时启动渲染循环
7. 每帧更新动画状态并渲染当前帧

**重要提示**: 必须先调用 `init()` 初始化 WebGPU 后，才能创建依赖 GPU 设备的组件（如 TextureLoader）。

## 资源包结构

### 角色目录结构
```
src/sprites/
├── 1-Player-Bomb Guy/
│   ├── 1-Idle/          # 待机动画 (26帧)
│   ├── 2-Run/           # 跑步动画 (14帧)
│   ├── 3-Jump Anticipation/  # 跳跃准备 (1帧)
│   ├── 4-Jump/          # 跳跃动画 (4帧)
│   └── ...
├── 2-Enemy-Bald Pirate/
│   ├── 1-Idle/          # 待机动画 (34帧)
│   ├── 2-Run/           # 跑步动画 (14帧)
│   └── ...
└── 3-Enemy-Cucumber/
    ├── 1-Idle/          # 待机动画 (36帧)
    └── ...
```

### 动画配置

每个角色包含多个动画，每个动画包含：
- **name**: 动画名称
- **folderName**: 资源文件夹名称
- **frameCount**: 帧数
- **fps**: 帧率 (固定为 20 FPS)

## 使用说明

### 1. 安装依赖

```bash
npm install
# 或
bun install
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 浏览器要求

- **Chrome/Edge**: 版本 113+ (推荐)
- **Firefox**: 版本 115+
- **Safari**: 版本 17+

必须使用支持 WebGPU 的现代浏览器。

### 4. 使用界面

应用界面分为两部分：

#### 左侧 - Canvas 渲染区域
- 800x800 像素的画布
- 黑色背景
- 显示当前播放的动画

#### 右侧 - 控制面板

**1. 选择角色**
- Player (Bomb Guy)
- Enemy (Bald Pirate)
- Enemy (Cucumber)

**2. 选择动画**
- 点击任意动画按钮开始播放
- 当前选中的动画会高亮显示

**3. 播放控制**
- ▶ 播放: 开始/继续播放动画
- ⏸ 暂停: 暂停当前动画
- ⏹ 停止: 停止动画并重置到第一帧

**4. 动画信息**
- 当前动画名称
- 当前帧/总帧数
- 帧率: 20 FPS
- 播放状态

## API 接口说明

### CharacterController 主要 API

```typescript
// 1. 创建控制器
const canvas = document.querySelector('canvas');
const controller = new CharacterController(canvas);

// 2. 初始化 WebGPU（必须先初始化！）
const success = await controller.init();
if (!success) {
  console.error('WebGPU 初始化失败');
  return;
}

// 3. 注册角色
controller.registerCharacter({
  name: 'Player',
  basePath: '/src/sprites/1-Player-Bomb Guy',
  animations: [
    { name: 'Idle', folderName: '1-Idle', frameCount: 26 }
  ]
});

// 4. 加载角色
await controller.loadCharacter('Player');

// 5. 播放动画
controller.playAnimation('Idle');

// 6. 暂停动画
controller.pauseAnimation();

// 7. 停止动画
controller.stopAnimation();

// 8. 获取状态
const status = controller.getAnimationStatus();
// {
//   isPlaying: true,
//   currentAnimation: 'Player_Idle',
//   currentFrame: 5,
//   totalFrames: 26
// }
```

## 性能优化

### 1. 纹理缓存
- 所有加载的纹理都会被缓存
- 避免重复加载相同资源
- 支持手动清理缓存

### 2. 渲染优化
- 使用 requestAnimationFrame 同步刷新率
- 只在动画播放时渲染
- 暂停时自动停止渲染循环

### 3. GPU 资源管理
- 使用索引缓冲区减少顶点数据
- 纹理采样器使用 nearest 过滤（像素风格）
- 顶点缓冲区预创建，避免每帧重建

## 技术亮点

### 1. 现代图形 API
- 使用最新的 WebGPU 技术
- 完全利用 GPU 硬件加速
- 支持高性能渲染

### 2. 架构设计
- 清晰的模块分层
- 单一职责原则
- 易于扩展和维护

### 3. 类型安全
- 完整的 TypeScript 类型定义
- 编译时类型检查
- 更好的 IDE 支持

### 4. 响应式 UI
- 使用 Solid.js 实现高性能 UI
- 细粒度响应式更新
- 流畅的用户体验

## 常见问题

### Q: 报错 "Cannot read properties of undefined (reading 'createTexture')"
A: 这是因为在 WebGPU 初始化之前尝试使用 GPU 设备。请确保：
1. 先调用 `await controller.init()` 初始化 WebGPU
2. 确认 `init()` 返回 `true` 表示初始化成功
3. 只有在初始化成功后才能调用其他方法（如注册角色、加载角色等）

### Q: 为什么动画不显示？
A: 检查以下几点：
1. 浏览器是否支持 WebGPU
2. 图片资源路径是否正确
3. 是否成功加载了角色
4. 控制台是否有错误信息
5. 是否先调用了 `init()` 初始化

### Q: 如何添加新角色？
A: 在 `App.tsx` 的 `characters` 数组中添加新配置：
```typescript
{
  name: 'NewCharacter',
  displayName: '新角色',
  basePath: '/src/sprites/NewCharacter',
  animations: [
    { name: 'Idle', folderName: '1-Idle', frameCount: 20 }
  ]
}
```

### Q: 如何修改动画帧率？
A: 在 `SpriteAnimation.ts` 中修改 `fps` 参数，或在动画配置中指定：
```typescript
{
  name: 'FastAnimation',
  frames: [...],
  fps: 30  // 30 FPS
}
```

### Q: 如何调整精灵大小？
A: 在 `SpriteRenderer.ts` 的顶点数据中调整顶点坐标：
```typescript
const vertices = new Float32Array([
  -0.8, 0.8, 0.0, 0.0,  // 修改这些值可以改变精灵大小
  0.8, 0.8, 1.0, 0.0,
  0.8, -0.8, 1.0, 1.0,
  -0.8, -0.8, 0.0, 1.0,
]);
```

## 扩展方向

### 1. 多精灵支持
- 支持同时渲染多个精灵
- 实现精灵层级管理
- 添加变换矩阵（位置、缩放、旋转）

### 2. 动画过渡
- 实现动画之间的平滑过渡
- 支持动画混合

### 3. 特效系统
- 添加粒子效果
- 实现后处理效果（滤镜、光照等）

### 4. 交互增强
- 支持鼠标/键盘控制
- 实现精灵拖拽
- 添加动画速度控制

### 5. 资源管理
- 实现资源预加载进度显示
- 添加资源按需加载
- 支持资源热重载

## 技术参考

- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [WebGPU Shading Language (WGSL)](https://www.w3.org/TR/WGSL/)
- [Solid.js Documentation](https://www.solidjs.com/docs/latest)
- [MDN WebGPU Guide](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

## 许可证

MIT License

---

**开发者**: Perfumere
**创建日期**: 2025-10-04
**版本**: 1.0.0
