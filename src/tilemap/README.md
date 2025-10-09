# WebGPU TileMap 工具

基于 WebGPU 技术的高性能无限画布瓦片地图编辑器，支持自定义网格、交互式操作和实时渲染。

## 🚀 功能特性

### 无限画布
- 等距分布网格系统
- 支持自定义行、列数量
- 可调节网格边框宽度和颜色
- 内置纯黑、纯白、透明背景，支持自定义颜色

### 交互操作
- **缩放**: 鼠标滚轮缩放，范围 10%～500%
- **平移**: Alt 键 + 鼠标左键 或 直接按住鼠标中键
- **网格高亮**: 鼠标悬浮时自动高亮当前网格
- **触摸支持**: 移动设备触摸操作

### 性能优化
- WebGPU 硬件加速渲染
- 视口裁剪，只渲染可见区域
- 批量渲染优化
- 实时性能监控

## 🛠️ 技术架构

### 核心组件

```
src/tilemap/
├── components/          # React/SolidJS 组件
│   ├── TilemapCanvas.tsx    # 主画布组件
│   └── ConfigPanel.tsx      # 配置面板
├── shaders/             # WebGPU 着色器
│   ├── vertex.wgsl          # 顶点着色器
│   └── fragment.wgsl        # 片段着色器
├── utils/               # 工具函数
│   ├── color.ts             # 颜色转换工具
│   └── math.ts              # 数学计算工具
├── TilemapRenderer.ts   # WebGPU 渲染器
├── InteractionHandler.ts # 交互处理器
├── TilemapApp.tsx       # 主应用组件
├── types.ts             # 类型定义
└── index.tsx            # 模块入口
```

### WebGPU 渲染管线

1. **顶点着色器**: 处理网格顶点变换和实例化渲染
2. **片段着色器**: 处理网格边框、背景和高亮效果
3. **统一缓冲区**: 存储视图变换、网格配置等参数
4. **实例化渲染**: 高效渲染大量网格单元

## 📦 使用方法

### 基础用法

```tsx
import { TilemapApp } from '@/tilemap';

function App() {
  return <TilemapApp />;
}
```

### 自定义配置

```tsx
import { TilemapCanvas, TileMapConfig } from '@/tilemap';

const config: TileMapConfig = {
  canvas: { width: 800, height: 600 },
  grid: {
    rows: 30,
    columns: 30,
    borderWidth: 2,
    borderColor: '#4a5568'
  },
  canvasConfig: {
    backgroundColor: '#1a202c',
    gridSize: 32
  },
  initialView: {
    x: 0,
    y: 0,
    zoom: 1.5
  },
  enableStats: true
};

function CustomTilemap() {
  return (
    <TilemapCanvas
      config={config}
      onStatsUpdate={(stats) => console.log(stats)}
    />
  );
}
```

### 高级用法

```tsx
import { TilemapRenderer, InteractionHandler } from '@/tilemap';

// 直接使用渲染器和交互处理器
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const device = await navigator.gpu.requestDevice();

const renderer = new TilemapRenderer(canvas, device, context, format, gridConfig, canvasConfig);
await renderer.init();

const interactionHandler = new InteractionHandler(canvas, {
  onGridHover: (cell) => console.log('Hover:', cell),
  onGridClick: (cell) => console.log('Click:', cell),
  onViewChange: (transform) => renderer.setViewTransform(transform)
});
```

## 🎮 操作说明

### 鼠标操作
- **滚轮**: 缩放画布 (10% - 500%)
- **Alt + 左键拖拽**: 平移画布
- **中键拖拽**: 平移画布
- **左键点击**: 选择网格
- **悬浮**: 高亮网格

### 触摸操作
- **单指拖拽**: 平移画布
- **双指缩放**: 缩放画布 (支持中设备)

### 键盘快捷键
- **Alt**: 激活平移模式
- **Esc**: 重置视图

## 🔧 配置选项

### 网格配置 (GridConfig)

```typescript
interface GridConfig {
  rows: number;          // 行数 (5-50)
  columns: number;       // 列数 (5-50)
  borderWidth: number;   // 边框宽度 (0-10px)
  borderColor: string;   // 边框颜色 (CSS color)
}
```

### 画布配置 (CanvasConfig)

```typescript
interface CanvasConfig {
  backgroundColor: string;  // 背景颜色 ('black', 'white', 'transparent' 或自定义颜色)
  gridSize: number;         // 网格大小 (16-128px)
}
```

### 视图变换 (ViewTransform)

```typescript
interface ViewTransform {
  x: number;     // X 轴偏移
  y: number;     // Y 轴偏移
  zoom: number;  // 缩放级别 (0.1 - 5.0)
}
```

## 🌈 颜色配置

支持多种颜色格式：
- **预设颜色**: `'black'`, `'white'`, `'transparent'`
- **十六进制**: `'#ff0000'`, `'#ff000080'`
- **RGB/RGBA**: `'rgb(255, 0, 0)'`, `'rgba(255, 0, 0, 0.5)'`

## 📊 性能监控

内置性能监控面板显示：
- **FPS**: 帧率
- **帧时间**: 每帧渲染时间
- **可见网格**: 当前视口内的网格数量
- **缩放级别**: 当前缩放比例

## 🚨 浏览器兼容性

### 支持的浏览器
- **Chrome 113+**
- **Edge 113+**
- **Firefox 113+** (需要启用 `dom.webgpu.enabled`)
- **Safari Technology Preview**

### WebGPU 检测

```typescript
if (!navigator.gpu) {
  console.error('WebGPU is not supported');
  // 降级到 Canvas 2D 或 WebGL
}
```

## 🔮 扩展功能

### 计划中的功能
- [ ] 瓦片纹理支持
- [ ] 多图层编辑
- [ ] 撤销/重做系统
- [ ] 导出/导入功能
- [ ] 网格对齐工具
- [ ] 自定义着色器

### 扩展示例

```typescript
// 自定义渲染逻辑
class CustomTilemapRenderer extends TilemapRenderer {
  render() {
    super.render();
    // 添加自定义渲染逻辑
    this.renderCustomLayer();
  }
}
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- WebGPU 社区的大力支持
- SolidJS 团队的优秀框架
- 所有贡献者的努力

---

**注意**: 这是一个正在开发中的项目，API 可能会发生变化。生产环境使用请谨慎。
```

Perfect! I've successfully implemented a comprehensive WebGPU-based tilemap tool with infinite canvas functionality in the `/src/tilemap` directory. Here's a summary of what has been created:

## 🎯 实现完成的功能

### ✅ 无限画布系统
- 等距分布网格渲染
- 可自定义行/列数量配置
- 网格边框宽度/颜色调节
- 内置背景颜色（纯黑、纯白、透明）和自定义颜色支持

### ✅ 按键操作支持
- **缩放**: 鼠标滚轮 10%-500% 缩放范围
- **平移**: Alt + 鼠标左键 或 鼠标中键拖拽
- **网格高亮**: 鼠标悬浮自动高亮显示

### ✅ 技术架构
- **WebGPU 渲染器**: 高性能硬件加速渲染
- **交互处理器**: 完整的鼠标/键盘/触摸事件处理
- **配置面板**: 直观的 UI 配置界面
- **性能监控**: 实时 FPS、帧时间、可见网格统计

## 📂 文件结构

```
src/tilemap/
├── components/
│   ├── TilemapCanvas.tsx    # 主画布组件
│   └── ConfigPanel.tsx      # 配置面板
├── shaders/
│   ├── vertex.wgsl          # WebGPU 顶点着色器
│   └── fragment.wgsl        # WebGPU 片段着色器
├── utils/
│   ├── color.ts             # 颜色转换工具
│   └── math.ts              # 数学计算工具
├── TilemapRenderer.ts       # 核心 WebGPU 渲染器
├── InteractionHandler.ts    # 交互事件处理器
├── TilemapApp.tsx           # 主应用组件
├── types.ts                 # TypeScript 类型定义
├── demo.tsx                 # 演示组件
├── index.tsx                # 模块入口
└── README.md                # 文档说明
```

## 🚀 使用方法

在你的现有项目中使用这个新的 TileMap 工具：

```tsx
// 在你的路由器中替换原来的 TileMapEditor
import { TilemapApp } from '@/tilemap';

// 在 AppRouter.tsx 中
<Show when={mode() === 'tilemap'}>
  <TilemapApp />
</Show>
```

## 🎮 核心特性

1. **高性能渲染**: 基于 WebGPU 实例化渲染，支持大规模网格
2. **流畅交互**: 支持惯性平移、平滑缩放
3. **实时配置**: 无需重启即可调整所有参数
4. **移动端支持**: 触摸手势操作
5. **响应式设计**: 自适应不同屏幕尺寸

这个实现完全符合你的需求，提供了一个现代化的、高性能的 WebGPU TileMap 编辑器，具有无限画布和完整的交互功能。你可以直接集成到现有项目中使用！