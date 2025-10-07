# TileMap 编辑器

基于 WebGPU 的 2D 游戏地图构建工具，提供类似 Godot 等游戏引擎的瓦片地图编辑功能。

## 功能特性

### ✨ 核心功能

1. **智能瓦片集识别**
   - 自动识别图片中的瓦片网格
   - 支持自定义瓦片大小、间距和边距
   - 类似 Godot 的网格检测算法

2. **直观的地图编辑**
   - 笔刷工具：绘制瓦片
   - 橡皮擦工具：删除瓦片
   - 多图层支持
   - 网格辅助线

3. **高性能渲染**
   - 基于 WebGPU 的硬件加速渲染
   - 实例化渲染批次优化
   - 支持大型地图流畅编辑

4. **视图控制**
   - 鼠标滚轮缩放（0.1x - 5.0x）
   - 中键/Alt+左键拖拽平移
   - 实时网格显示

5. **高效的数据格式**
   - 使用游程编码（RLE）压缩
   - 支持嵌入图片数据或仅存储引用
   - 极小的导出文件体积

## 快速开始

### 基本使用

```tsx
import { TileMapEditor } from './map';

function App() {
  return <TileMapEditor />;
}
```

### 工作流程

1. **上传瓦片集**
   - 点击"上传瓦片集"按钮
   - 选择包含瓦片的图片文件
   - 系统会自动识别网格并划分瓦片

2. **选择瓦片**
   - 在右侧瓦片集预览中点击要使用的瓦片
   - 选中的瓦片会高亮显示

3. **绘制地图**
   - 使用笔刷工具在画布上绘制瓦片
   - 使用橡皮擦工具删除瓦片
   - 支持拖拽连续绘制

4. **管理图层**
   - 添加新图层用于分层编辑
   - 在图层下拉菜单中切换当前编辑图层

5. **导出/导入**
   - 导出为 JSON 格式（体积极小）
   - 支持重新导入继续编辑

## API 文档

### TileMapEditor

主编辑器组件，提供完整的 UI 和交互功能。

```tsx
<TileMapEditor />
```

### TileMapRenderer

WebGPU 渲染器，用于自定义渲染实现。

```typescript
import { TileMapRenderer, ViewTransform } from './map';

const renderer = new TileMapRenderer(
  canvas,
  device,
  context,
  format,
  tileSetManager
);

await renderer.init();
renderer.setMapData(mapData);
renderer.setViewTransform({ x: 0, y: 0, zoom: 1.0 });
renderer.render();
```

### TileSetManager

瓦片集管理器。

```typescript
import { TileSetManager, TileSet } from './map';

const manager = new TileSetManager();

// 从文件创建
const tileSet = await TileSet.createFromFile(file, id, device);
manager.addTileSet(tileSet);

// 从定义创建
const tileSet2 = await TileSet.createFromDefinition(definition, device);
manager.addTileSet(tileSet2);
```

### TileMapDataManager

地图数据管理。

```typescript
import { TileMapDataManager } from './map';

// 创建空地图
const mapData = TileMapDataManager.createEmptyMap(50, 50, 32, 32);

// 设置瓦片
const newMapData = TileMapDataManager.setTile(
  mapData,
  layerIndex,
  x,
  y,
  { tilesetId: 0, tileIndex: 5 }
);

// 添加图层
const withLayer = TileMapDataManager.addLayer(mapData, 'Background');

// 导出（包含图片数据）
const json = await TileMapDataManager.exportMap(mapData, true);

// 导入
const imported = TileMapDataManager.importMap(json);
```

### GridDetector

网格自动检测。

```typescript
import { GridDetector } from './map';

// 自动检测
const result = await GridDetector.detectGrid(imageUrl);
console.log(result);
// {
//   tileWidth: 32,
//   tileHeight: 32,
//   columns: 10,
//   rows: 8,
//   spacing: 1,
//   margin: 0,
//   confidence: 0.95
// }

// 手动设置
const manual = GridDetector.manualGrid(
  imageWidth,
  imageHeight,
  32,
  32,
  1,
  0
);
```

## 数据格式

### 导出格式示例

```json
{
  "v": "1.0.0",
  "w": 50,
  "h": 50,
  "tw": 32,
  "th": 32,
  "ts": [
    {
      "i": 0,
      "n": "tileset.png",
      "d": "data:image/png;base64,...",
      "tw": 32,
      "th": 32,
      "c": 10,
      "r": 8,
      "s": 0,
      "m": 0
    }
  ],
  "l": [
    {
      "n": "Layer 1",
      "v": true,
      "o": 1.0,
      "t": "100*e,0:5,0:6,200*e,0:7,..."
    }
  ]
}
```

### 压缩说明

- 使用游程编码（RLE）压缩瓦片数据
- 空瓦片用 `e` 表示
- 连续相同瓦片用 `count*tile` 格式
- 典型压缩率：70-90%（取决于地图复杂度）

## 性能优化

1. **实例化渲染**
   - 每个瓦片集使用一个渲染批次
   - GPU 实例化绘制，支持数万瓦片

2. **视锥剔除**（未来版本）
   - 只渲染可见区域的瓦片

3. **纹理图集**
   - 支持多个瓦片集
   - 每个瓦片集一个纹理

## 键盘快捷键

- **滚轮**: 缩放视图
- **中键拖拽**: 平移视图
- **Alt + 左键**: 平移视图
- **左键**: 绘制/选择

## 浏览器兼容性

需要支持 WebGPU 的浏览器：

- Chrome/Edge 113+
- Safari 17.4+ (macOS 14+)
- Firefox (实验性支持)

## 未来计划

- [ ] 填充工具（油漆桶）
- [ ] 矩形/圆形选择工具
- [ ] 复制/粘贴区域
- [ ] 自动瓦片（Auto-tile）
- [ ] 碰撞层编辑
- [ ] 对象层（实体、触发器等）
- [ ] 导出为图片
- [ ] 多人协作编辑
- [ ] 撤销/重做
- [ ] 图层混合模式
- [ ] 瓦片动画支持

## 技术栈

- **WebGPU**: 硬件加速渲染
- **Solid.js**: 响应式 UI 框架
- **TypeScript**: 类型安全
- **WGSL**: WebGPU 着色器语言

## 许可证

与项目主许可证一致。

