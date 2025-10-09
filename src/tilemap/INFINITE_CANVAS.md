# 无限画布 TileMap 工具

基于 WebGPU 的无限画布网格绘制工具，提供高性能的网格渲染和交互功能。

## 功能特性

### 1. 无限画布
- 等距分布的网格系统
- 无限延伸的画布空间
- 支持大范围的视图平移和缩放

### 2. 背景设置
- **预设颜色**：
  - 纯黑 (`#000000`)
  - 纯白 (`#ffffff`)
- **自定义颜色**：通过颜色选择器选择任意颜色

### 3. 网格设置
- **显示/隐藏**：可以切换网格的显示状态
- **网格尺寸**：
  - 列宽度：8-256 像素 (默认 32px)
  - 行高度：8-256 像素 (默认 32px)
- **网格外观**：
  - 边框宽度：0.5-5 像素 (默认 1px)
  - 边框颜色：任意自定义颜色 (默认半透明白色)

### 4. 交互操作

#### 缩放
- **鼠标滚轮**：向上滚动放大，向下滚动缩小
- **缩放范围**：10% ~ 500%
- 平滑的缩放过渡动画

#### 平移
- **Alt + 左键拖动**：按住 Alt 键并用鼠标左键拖动画布
- **中键拖动**：直接按住鼠标中键拖动画布
- 实时更新视图位置

#### 网格高亮
- **鼠标悬浮**：鼠标悬停时自动高亮当前网格单元
- **坐标显示**：在信息面板中显示当前悬浮的网格坐标

## 技术实现

### WebGPU 渲染管线
- 使用 WebGPU API 进行高性能图形渲染
- 完全在 GPU 上完成网格的绘制和高亮计算
- 支持大规模网格的流畅渲染

### 着色器架构
- **顶点着色器**：处理全屏四边形的顶点变换
- **片段着色器**：
  - 坐标系转换（屏幕 → 世界 → 网格）
  - 网格线渲染
  - 单元格高亮效果

### 坐标系统
- **屏幕坐标**：Canvas 上的像素坐标
- **世界坐标**：考虑视图变换后的虚拟世界坐标
- **网格坐标**：世界坐标映射到的网格单元坐标

## 使用方法

### 在应用中集成

```tsx
import { InfiniteCanvas } from '@/tilemap';

function App() {
  return <InfiniteCanvas />;
}
```

### 通过主应用访问

在主应用中，选择 "TileMap 编辑器" → "无限画布" 标签页。

## 浏览器兼容性

需要支持 WebGPU 的现代浏览器：
- Chrome 113+
- Edge 113+
- Safari 17.4+ (macOS Sonoma)
- Opera 99+

## 性能特点

- **GPU 加速**：所有渲染计算在 GPU 上完成
- **高帧率**：保持 60 FPS 的流畅渲染
- **低延迟**：实时响应用户交互
- **内存高效**：使用 uniform buffer 传递少量数据

## 未来扩展

可以在此基础上添加的功能：
- 绘制工具（画笔、橡皮擦等）
- 图层系统
- 瓦片素材库
- 导出/导入功能
- 撤销/重做
- 选区工具
- 填充工具

## 文件结构

```
src/tilemap/
├── InfiniteCanvas.tsx          # React 组件
├── InfiniteCanvas.css          # 组件样式
├── InfiniteCanvasRenderer.ts   # WebGPU 渲染器
└── INFINITE_CANVAS.md          # 本文档
```

## API 参考

### InfiniteCanvasRenderer

#### 构造函数
```typescript
constructor(
  canvas: HTMLCanvasElement,
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat
)
```

#### 方法

**setViewTransform(transform: ViewTransform)**
- 设置视图变换（位置和缩放）

**setGridSettings(settings: GridSettings)**
- 设置网格参数

**setBackgroundColor(color: string)**
- 设置背景颜色（十六进制格式）

**setHoveredCell(cell: {x: number, y: number} | null)**
- 设置当前悬浮的网格单元

**screenToGrid(screenX: number, screenY: number)**
- 将屏幕坐标转换为网格坐标

**render()**
- 执行一次渲染

**destroy()**
- 销毁渲染器，释放资源

## 故障排除

### WebGPU 不可用
如果浏览器不支持 WebGPU，会显示提示信息。请使用支持的浏览器版本。

### 性能问题
如果遇到性能问题：
1. 检查浏览器是否启用了硬件加速
2. 关闭其他占用 GPU 的应用程序
3. 尝试降低画布分辨率

### 渲染异常
如果网格显示不正常：
1. 刷新页面重新初始化
2. 检查浏览器控制台是否有错误信息
3. 确认 WebGPU 设备初始化成功

## 许可证

与项目主体保持一致。

