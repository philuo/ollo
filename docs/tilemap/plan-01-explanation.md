# Godot 级别 2D TileMap 编辑器 Web 实现方案详解

## 📋 文档概述

本文档详细讲解如何在 Web 端实现一个功能完整、性能优异的 2D TileMap 编辑器，达到 Godot 引擎的水平。方案采用现代 Web 技术栈：**AssemblyScript + WebAssembly + WebGPU + TypeScript**。

---

## 🎯 第一部分：项目目标与功能范围

### 核心功能清单

该方案旨在实现以下 7 大核心功能模块：

#### 1. **TileSet 管理器**
- **功能**：负责加载图片资源、自动裁切成瓦片网格、分类管理精灵
- **应用场景**：导入一张 tileset 图片（如 32x32 的瓦片集），自动识别行列数，生成可用的瓦片库
- **类比 Godot**：相当于 Godot 的 TileSet 资源编辑器

#### 2. **TileMap 编辑器**
- **功能**：提供可视化绘制工具（笔刷、填充、矩形框选、橡皮擦）
- **交互方式**：鼠标点击绘制单个瓦片，拖拽绘制矩形区域，flood fill 填充连续区域
- **用户体验**：实时预览、网格对齐、即时反馈

#### 3. **多层级管理**
- **功能**：支持不同 Z 轴层级的独立编辑
- **典型图层**：
  - 地表层（Ground Layer）：基础地形
  - 装饰层（Decoration Layer）：花草、石头等
  - 碰撞层（Collision Layer）：物理碰撞区域
  - 遮罩层（Mask Layer）：光照遮挡、视野遮罩
- **操作**：图层显示/隐藏、锁定/解锁、透明度调整、Z 顺序调整

#### 4. **存档与序列化**
- **功能**：将地图数据保存为可读的 JSON 格式或高性能的二进制格式
- **应用场景**：
  - JSON：适合版本管理、人工阅读、跨平台编辑
  - Binary：适合游戏运行时快速加载（减少解析开销）

#### 5. **高效渲染**
- **功能**：支持地图的缩放、平移、批量渲染
- **性能目标**：流畅渲染数万个瓦片（60fps）
- **技术手段**：视口裁剪、GPU instancing、分块渲染

#### 6. **插件化逻辑**
- **功能**：支持扩展自定义图层类型
- **示例**：
  - 碰撞层：标记可通行/不可通行区域
  - 导航层：用于 AI 寻路的成本地图
  - 交互层：标记可交互的物体位置

#### 7. **资源预览与工具栏 UI**
- **功能**：缩略图预览、拖放操作、工具面板
- **组件**：瓦片选择器、图层面板、属性检查器

---

## 🏗️ 第二部分：系统架构分层设计

### 架构核心思想

采用**分层解耦**的设计理念，各层职责清晰，便于维护和扩展。

### 五层架构详解

| 层级 | 职责 | 技术选型 | 说明 |
|------|------|----------|------|
| **UI 层** | 用户界面、交互响应 | SolidJS | 处理工具栏、图层面板、资源浏览器等 UI 组件 |
| **渲染层** | 图形显示、视口管理 | WebGPU | 将 TileMap 数据转换为屏幕像素 |
| **逻辑层** | 核心编辑逻辑、数据管理 | AssemblyScript | 使用 ECS 管理世界数据、处理编辑命令 |
| **资源层** | 资源加载、图集管理 | TS | 加载图片、解析 TileSet、管理纹理图集 |
| **存档层** | 数据持久化 | JSON + Binary | 实现序列化/反序列化、Undo/Redo 栈 |

### 数据流动路径

```
用户操作 (UI层)
    ↓
编辑命令 (逻辑层)
    ↓
数据更新 (ECS系统)
    ↓
渲染更新 (渲染层)
    ↓
屏幕显示
```

### 为什么选择 AssemblyScript + WASM？

1. **高性能**：编辑大地图时需要频繁修改大型数组，WASM 的内存操作比 JS 快 3-10 倍
2. **类型安全**：TypeScript 语法，编译为 WASM，避免 JS 的类型不确定性
3. **内存控制**：可以精确控制内存布局，使用 `Uint32Array` 等紧凑结构
4. **可预测性能**：没有 GC 停顿，适合实时编辑场景

---

## 📊 第三部分：核心数据结构设计

### 为什么数据结构如此重要？

良好的数据结构决定了：
- 内存占用大小（影响加载速度）
- 序列化效率（影响存档速度）
- 渲染性能（影响遍历速度）

### 数据结构定义

#### 1. TileMap 主结构

```typescript
interface TileMap {
  width: number;        // 地图宽度（单位：瓦片数）
  height: number;       // 地图高度（单位：瓦片数）
  tileSize: number;     // 单个瓦片尺寸（像素，如 32px）
  layers: TileLayer[];  // 图层数组
}
```

**设计说明**：
- `width × height` 定义了地图的逻辑尺寸
- 实际像素尺寸 = `width × tileSize`
- 示例：256×256 的地图，32px 瓦片 = 8192×8192 像素

#### 2. TileLayer 图层结构

```typescript
interface TileLayer {
  name: string;         // 图层名称（如 "ground", "decoration"）
  zIndex: number;       // Z 轴顺序（用于渲染排序）
  tiles: Uint32Array;   // 瓦片 ID 数组，长度 = width × height
  visible: boolean;     // 是否可见
  opacity: number;      // 不透明度（0.0 - 1.0）
}
```

**关键设计点**：

1. **Uint32Array 的选择**
   - 每个元素占 4 字节
   - 可表示 0 到 4,294,967,295 个不同的瓦片
   - 0 表示空（透明）
   - 1 到 N 表示 TileSet 中的瓦片索引

2. **一维数组映射**
   ```typescript
   // 从 (x, y) 坐标转换为数组索引
   const index = y * width + x;

   // 从索引反推坐标
   const x = index % width;
   const y = Math.floor(index / width);
   ```

3. **内存占用计算**
   - 256×256 地图 = 65,536 个瓦片
   - 65,536 × 4 字节 = 262KB（单层）
   - 10 个图层 = 2.62MB（可接受范围）

#### 3. TileSet 瓦片集结构

```typescript
interface TileSet {
  imageUrl: string;     // 图片资源路径
  tileWidth: number;    // 单个瓦片宽度
  tileHeight: number;   // 单个瓦片高度
  columns: number;      // 列数
  rows: number;         // 行数
  tiles: TileMeta[];    // 瓦片元数据数组
}
```

**示例说明**：
- 一张 512×512 的图片，32×32 的瓦片
- `columns = 512 / 32 = 16`
- `rows = 512 / 32 = 16`
- 总共 256 个瓦片

#### 4. TileMeta 瓦片元数据

```typescript
interface TileMeta {
  id: number;           // 全局唯一 ID
  name?: string;        // 可选的名称（如 "grass_01"）
  collision?: boolean;  // 是否有碰撞
  navigation?: boolean; // 是否可导航
}
```

**扩展性**：
- 可添加 `animation` 属性支持动画瓦片
- 可添加 `properties` 对象存储自定义数据（如 walkCost、damage 等）

---

## 🎨 第四部分：渲染层实现方案

### 为什么选择 WebGPU？

| 对比项 | Canvas2D | WebGL | WebGPU |
|--------|----------|-------|--------|
| 性能 | 低（CPU 绘制） | 中（GPU，旧 API） | 高（现代 GPU API） |
| 批量渲染 | 差 | 好 | 优秀 |
| 实例化支持 | 无 | 有限 | 原生支持 |
| 学习曲线 | 简单 | 中等 | 较陡 |
| 浏览器支持 | 全部 | 全部 | Chrome/Edge 113+ |

### WebGPU 渲染原理

#### 核心概念：GPU Instancing

**传统方式**（低效）：
```
for each tile:
  - 设置位置
  - 设置纹理坐标
  - 绘制 4 个顶点

// 10,000 个瓦片 = 10,000 次绘制调用 → 慢！
```

**Instancing 方式**（高效）：
```
准备：
  - 1 个矩形网格（4 顶点，2 三角形）
  - 1 个实例缓冲区（包含所有瓦片的位置和 ID）

绘制：
  - 一次绘制调用，指定实例数 = 10,000
  - GPU 并行处理所有实例

// 10,000 个瓦片 = 1 次绘制调用 → 快！
```

### 实例数据结构

```typescript
struct TileInstance {
  worldX: f32;      // 世界坐标 X
  worldY: f32;      // 世界坐标 Y
  tileIndex: u32;   // 瓦片在 TileSet 中的索引
  layerIndex: u32;  // 图层索引（用于分层渲染）
}
```

### 顶点着色器伪代码解析

```wgsl
@vertex
fn vs_main(
  in: VertexInput,           // 基础矩形顶点（0,0 到 1,1）
  instance: InstanceInput    // 实例数据（每个瓦片不同）
) -> VertexOutput {
  var out: VertexOutput;

  // 1. 计算世界空间位置
  let worldPos = vec2<f32>(
    instance.worldX + in.position.x * tileSize,
    instance.worldY + in.position.y * tileSize
  );

  // 2. 应用相机变换（平移 + 缩放）
  out.position = cameraMatrix * vec4<f32>(worldPos, 0.0, 1.0);

  // 3. 计算纹理坐标
  // 从 tileIndex 计算在图集中的位置
  let col = instance.tileIndex % atlasColumns;
  let row = instance.tileIndex / atlasColumns;
  let uvX = (col + in.uv.x) / atlasColumns;
  let uvY = (row + in.uv.y) / atlasRows;
  out.uv = vec2<f32>(uvX, uvY);

  return out;
}
```

**关键点解释**：
1. `in.position` 是基础矩形的 4 个顶点（共享）
2. `instance.*` 是每个瓦片特有的数据
3. `cameraMatrix` 处理缩放和平移（zoom + pan）
4. UV 坐标计算将瓦片索引映射到图集的正确区域

### 片段着色器

```wgsl
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // 从纹理图集采样颜色
  return textureSample(atlasTexture, atlasSampler, in.uv);
}
```

### 渲染流程

```typescript
// 伪代码
function render(tilemap: TileMap, camera: Camera) {
  // 1. 遍历所有图层（按 zIndex 排序）
  for (const layer of sortedLayers) {
    if (!layer.visible) continue;

    // 2. 收集可见区域内的瓦片
    const visibleTiles = getVisibleTiles(layer, camera);

    // 3. 更新实例缓冲区
    updateInstanceBuffer(visibleTiles);

    // 4. 发起绘制调用
    drawInstanced(visibleTiles.length);
  }
}
```

---

## 🛠️ 第五部分：编辑器功能详解

### 1. 笔刷工具（Brush Tool）

**功能**：鼠标点击绘制单个瓦片

**实现逻辑**：
```typescript
function onMouseDown(event: MouseEvent) {
  // 1. 屏幕坐标转世界坐标
  const worldPos = screenToWorld(event.x, event.y, camera);

  // 2. 世界坐标转瓦片坐标
  const tileX = Math.floor(worldPos.x / tileSize);
  const tileY = Math.floor(worldPos.y / tileSize);

  // 3. 检查边界
  if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) return;

  // 4. 更新数据
  const index = tileY * width + tileX;
  currentLayer.tiles[index] = selectedTileId;

  // 5. 标记需要重新渲染
  markDirty(currentLayer);
}
```

### 2. 矩形工具（Rectangle Tool）

**功能**：拖动鼠标填充矩形区域

**实现逻辑**：
```typescript
let startTile = null;

function onMouseDown(event: MouseEvent) {
  startTile = screenToTile(event);
}

function onMouseUp(event: MouseEvent) {
  const endTile = screenToTile(event);

  // 计算矩形范围
  const minX = Math.min(startTile.x, endTile.x);
  const maxX = Math.max(startTile.x, endTile.x);
  const minY = Math.min(startTile.y, endTile.y);
  const maxY = Math.max(startTile.y, endTile.y);

  // 填充矩形区域
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const index = y * width + x;
      currentLayer.tiles[index] = selectedTileId;
    }
  }

  markDirty(currentLayer);
}
```

### 3. 填充工具（Flood Fill）

**功能**：点击一个区域，填充所有相邻的相同瓦片

**算法**：广度优先搜索（BFS）

```typescript
function floodFill(startX: number, startY: number, newTileId: number) {
  const startIndex = startY * width + startX;
  const targetId = currentLayer.tiles[startIndex];

  // 如果目标颜色和新颜色相同，无需填充
  if (targetId === newTileId) return;

  const queue = [{x: startX, y: startY}];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const {x, y} = queue.shift()!;
    const index = y * width + x;

    // 边界检查
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited.has(index)) continue;
    if (currentLayer.tiles[index] !== targetId) continue;

    // 填充当前瓦片
    currentLayer.tiles[index] = newTileId;
    visited.add(index);

    // 将相邻 4 个方向加入队列
    queue.push({x: x+1, y}, {x: x-1, y}, {x, y: y+1}, {x, y: y-1});
  }

  markDirty(currentLayer);
}
```

### 4. 橡皮擦工具（Eraser）

**功能**：清除瓦片（设置为 0）

```typescript
// 实际上就是将 selectedTileId 设为 0 的笔刷
function eraseTile(x: number, y: number) {
  const index = y * width + x;
  currentLayer.tiles[index] = 0; // 0 表示透明/空白
}
```

### 5. 撤销/重做（Undo/Redo）

**设计模式**：命令模式（Command Pattern）

```typescript
interface Command {
  execute(): void;
  undo(): void;
}

class SetTileCommand implements Command {
  constructor(
    private layer: TileLayer,
    private index: number,
    private oldValue: number,
    private newValue: number
  ) {}

  execute() {
    this.layer.tiles[this.index] = this.newValue;
  }

  undo() {
    this.layer.tiles[this.index] = this.oldValue;
  }
}

class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  execute(cmd: Command) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = []; // 清空重做栈
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) {
      cmd.undo();
      this.redoStack.push(cmd);
    }
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) {
      cmd.execute();
      this.undoStack.push(cmd);
    }
  }
}
```

### 6. 图层管理

**功能列表**：
- 显示/隐藏：`layer.visible = true/false`
- 锁定/解锁：阻止编辑操作
- 透明度调整：`layer.opacity = 0.0 ~ 1.0`
- Z 顺序调整：重新排序 `layers` 数组

```typescript
function moveLayerUp(layerIndex: number) {
  if (layerIndex === 0) return;
  [layers[layerIndex], layers[layerIndex - 1]] =
  [layers[layerIndex - 1], layers[layerIndex]];
}
```

### 7. 相机控制

```typescript
class Camera {
  x: number = 0;        // 相机位置 X
  y: number = 0;        // 相机位置 Y
  zoom: number = 1.0;   // 缩放级别（1.0 = 100%）

  // 鼠标滚轮缩放
  onWheel(delta: number) {
    const zoomSpeed = 0.1;
    this.zoom *= (1 + delta * zoomSpeed);
    this.zoom = Math.max(0.1, Math.min(10, this.zoom)); // 限制范围
  }

  // 鼠标拖拽平移
  onDrag(dx: number, dy: number) {
    this.x -= dx / this.zoom; // 缩放影响平移速度
    this.y -= dy / this.zoom;
  }

  // 生成变换矩阵
  getMatrix(): Matrix4x4 {
    return Matrix4x4
      .translation(-this.x, -this.y, 0)
      .scale(this.zoom, this.zoom, 1);
  }
}
```

---

## 💾 第六部分：数据存储方案

### JSON 格式（可读性优先）

**优点**：
- 人类可读，便于调试
- 易于版本控制（Git diff 友好）
- 跨语言支持

**示例**：
```json
{
  "width": 256,
  "height": 256,
  "tileSize": 32,
  "layers": [
    {
      "name": "ground",
      "zIndex": 0,
      "visible": true,
      "opacity": 1.0,
      "tiles": [0,0,1,1,2,3,0,1,1,...]
    },
    {
      "name": "decoration",
      "zIndex": 1,
      "visible": true,
      "opacity": 1.0,
      "tiles": [0,0,0,5,0,0,0,6,...]
    }
  ]
}
```

**适用场景**：
- 编辑器保存/加载
- 地图资源管理
- 配置文件

### Binary 格式（性能优先）

**优点**：
- 加载速度快（无需 JSON 解析）
- 文件更小（无字段名开销）
- 内存对齐友好

**格式设计**：
```
[Header Section - 16 bytes]
  - Magic Number: 4 bytes ('TMAP')
  - Version: 2 bytes (1)
  - Width: 4 bytes
  - Height: 4 bytes
  - Tile Size: 2 bytes

[Layer Count - 1 byte]

[Layer 1 Header - variable]
  - Name Length: 1 byte
  - Name: N bytes (UTF-8)
  - Z Index: 2 bytes
  - Visible: 1 byte (0/1)
  - Opacity: 1 byte (0-255)

[Layer 1 Data]
  - Tiles: width × height × 4 bytes (Uint32Array)

[Layer 2...]
...
```

**AssemblyScript 实现示例**：
```typescript
export function serializeTileMap(map: TileMap): ArrayBuffer {
  const buffer = new ArrayBuffer(calculateSize(map));
  const view = new DataView(buffer);
  let offset = 0;

  // Header
  view.setUint32(offset, 0x544D4150); offset += 4; // 'TMAP'
  view.setUint16(offset, 1); offset += 2;          // Version
  view.setUint32(offset, map.width); offset += 4;
  view.setUint32(offset, map.height); offset += 4;
  view.setUint16(offset, map.tileSize); offset += 2;

  // Layer count
  view.setUint8(offset, map.layers.length); offset += 1;

  // Layers
  for (let i = 0; i < map.layers.length; i++) {
    const layer = map.layers[i];

    // Layer header
    const nameBytes = String.UTF8.encode(layer.name);
    view.setUint8(offset, nameBytes.byteLength); offset += 1;
    // ... copy name bytes ...

    view.setInt16(offset, layer.zIndex); offset += 2;
    view.setUint8(offset, layer.visible ? 1 : 0); offset += 1;
    view.setUint8(offset, layer.opacity * 255); offset += 1;

    // Tile data
    const tiles = layer.tiles;
    for (let j = 0; j < tiles.length; j++) {
      view.setUint32(offset, tiles[j]); offset += 4;
    }
  }

  return buffer;
}
```

**适用场景**：
- 游戏运行时加载
- 大地图资源
- 网络传输

---

## ⚡ 第七部分：性能优化策略

### 问题 1：大地图加载慢

**症状**：256×256 的地图需要 2-3 秒加载

**解决方案：分块加载（Chunking）**

```typescript
// 将地图划分为 16×16 的块
const CHUNK_SIZE = 16;

interface MapChunk {
  x: number;           // 块的 X 坐标
  y: number;           // 块的 Y 坐标
  tiles: Uint32Array;  // CHUNK_SIZE × CHUNK_SIZE 个瓦片
  loaded: boolean;
}

// 只加载视口附近的块
function loadVisibleChunks(camera: Camera) {
  const minChunkX = Math.floor(camera.left / (CHUNK_SIZE * tileSize));
  const maxChunkX = Math.ceil(camera.right / (CHUNK_SIZE * tileSize));
  const minChunkY = Math.floor(camera.top / (CHUNK_SIZE * tileSize));
  const maxChunkY = Math.ceil(camera.bottom / (CHUNK_SIZE * tileSize));

  for (let cy = minChunkY; cy <= maxChunkY; cy++) {
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      const chunk = getChunk(cx, cy);
      if (!chunk.loaded) {
        loadChunk(chunk); // 异步加载
      }
    }
  }
}
```

### 问题 2：滚动时绘制卡顿

**症状**：平移相机时帧率下降到 30fps

**解决方案：视口裁剪（Frustum Culling）**

```typescript
function getVisibleTiles(layer: TileLayer, camera: Camera): TileInstance[] {
  const result: TileInstance[] = [];

  // 计算可见范围（瓦片坐标）
  const minX = Math.max(0, Math.floor(camera.left / tileSize));
  const maxX = Math.min(width - 1, Math.ceil(camera.right / tileSize));
  const minY = Math.max(0, Math.floor(camera.top / tileSize));
  const maxY = Math.min(height - 1, Math.ceil(camera.bottom / tileSize));

  // 只收集可见区域的瓦片
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const index = y * width + x;
      const tileId = layer.tiles[index];

      if (tileId === 0) continue; // 跳过空瓦片

      result.push({
        worldX: x * tileSize,
        worldY: y * tileSize,
        tileIndex: tileId
      });
    }
  }

  return result;
}
```

**效果**：
- 全屏 1920×1080，32px 瓦片 = 约 2000 个可见瓦片
- 相比渲染整个 256×256 地图（65536 个瓦片），性能提升 30 倍

### 问题 3：笔刷绘制延迟

**症状**：快速拖动鼠标时，瓦片绘制不连续

**解决方案：插值填充**

```typescript
let lastDrawPos = null;

function onMouseMove(event: MouseEvent) {
  const currentPos = screenToTile(event);

  if (lastDrawPos) {
    // Bresenham 直线算法填充两点之间的瓦片
    drawLine(lastDrawPos, currentPos, selectedTileId);
  } else {
    drawTile(currentPos, selectedTileId);
  }

  lastDrawPos = currentPos;
}

function onMouseUp() {
  lastDrawPos = null;
}
```

### 问题 4：WebGPU 缓冲区更新慢

**症状**：每次编辑后需要 50ms 更新 GPU 缓冲区

**解决方案：差分更新**

```typescript
// 不要每次都上传整个实例缓冲区
// ❌ 慢方式
function updateFull() {
  const instances = getAllInstances(); // 65536 个
  device.queue.writeBuffer(instanceBuffer, 0, instances);
}

// ✅ 快方式
function updateDirty() {
  const dirtyRegions = getDirtyRegions(); // 只有修改的部分

  for (const region of dirtyRegions) {
    const offset = region.startIndex * instanceSize;
    const data = region.instances;
    device.queue.writeBuffer(instanceBuffer, offset, data);
  }

  clearDirtyFlags();
}
```

### 问题 5：大量图层时渲染慢

**解决方案：图层合并（Layer Baking）**

```typescript
// 对于不经常修改的图层，预渲染到纹理
function bakeStaticLayers(layers: TileLayer[]): GPUTexture {
  const renderTarget = createOffscreenTexture(width * tileSize, height * tileSize);

  // 将多个静态图层渲染到一张纹理
  for (const layer of layers) {
    if (layer.static) {
      renderToTexture(layer, renderTarget);
    }
  }

  return renderTarget;
}

// 运行时只需渲染：
// 1. 合并后的静态图层纹理（1 次绘制调用）
// 2. 动态图层（各 1 次绘制调用）
```

---

## 🔧 第八部分：与 Godot 的对比与扩展

### 功能对比表

| 功能 | Godot 实现 | Web 实现建议 | 难度 |
|------|-----------|-------------|------|
| **TileSet 管理** | .tres 资源文件 | JSON + PNG 图集 | ⭐️ 简单 |
| **自动地形连接** | 内置 AutoTile + 规则 | 自定义邻接检测算法 | ⭐️⭐️⭐️ 中等 |
| **碰撞层** | 内嵌物理形状 | 单独图层 + 元数据 | ⭐️⭐️ 简单 |
| **动画瓦片** | AnimatedTile 节点 | 纹理数组 + 时间插值 | ⭐️⭐️ 简单 |
| **自定义笔刷** | 多瓦片 Pattern | 保存矩形选区为模板 | ⭐️⭐️⭐️ 中等 |
| **导航层** | NavigationPolygon | A* 成本地图 | ⭐️⭐️⭐️⭐️ 困难 |
| **Z-as-Relative** | 父子节点层级 | 手动 Z 排序 | ⭐️ 简单 |
| **导出格式** | .tscn 场景文件 | JSON / Binary | ⭐️⭐️ 简单 |

### 扩展功能实现指南

#### 1. 自动地形连接（AutoTile）

**原理**：根据周围 8 个瓦片的情况，自动选择合适的瓦片变体

```typescript
// 3×3 邻接检测
function getAutoTileVariant(x: number, y: number): number {
  let mask = 0;
  const dirs = [
    [-1,-1], [0,-1], [1,-1],
    [-1, 0],         [1, 0],
    [-1, 1], [0, 1], [1, 1]
  ];

  for (let i = 0; i < 8; i++) {
    const [dx, dy] = dirs[i];
    const nx = x + dx, ny = y + dy;

    if (hasSameTile(nx, ny)) {
      mask |= (1 << i); // 设置对应位
    }
  }

  // 根据 mask 查找对应的瓦片变体
  return autoTileMapping[mask];
}

// 预定义的映射表（示例）
const autoTileMapping = {
  0b00000000: 0,  // 孤立瓦片
  0b01010000: 1,  // 左右连接
  0b00010100: 2,  // 上下连接
  0b01010100: 3,  // 十字连接
  // ... 256 种组合
};
```

#### 2. 动画瓦片

```typescript
interface AnimatedTile {
  frames: number[];      // 瓦片 ID 序列
  frameTime: number;     // 每帧持续时间（毫秒）
  loop: boolean;
}

function updateAnimations(deltaTime: number) {
  for (const animTile of animatedTiles) {
    animTile.currentTime += deltaTime;

    if (animTile.currentTime >= animTile.frameTime) {
      animTile.currentFrame = (animTile.currentFrame + 1) % animTile.frames.length;
      animTile.currentTime = 0;

      // 更新所有使用这个动画的瓦片
      updateTileInstances(animTile);
    }
  }
}
```

#### 3. 多瓦片笔刷（Pattern Brush）

```typescript
class PatternBrush {
  pattern: number[][];  // 2D 数组存储图案

  constructor(selection: Selection) {
    // 从选区创建图案
    this.pattern = extractPattern(selection);
  }

  paint(x: number, y: number) {
    const rows = this.pattern.length;
    const cols = this.pattern[0].length;

    for (let py = 0; py < rows; py++) {
      for (let px = 0; px < cols; px++) {
        const tileId = this.pattern[py][px];
        const tx = x + px;
        const ty = y + py;

        if (isInBounds(tx, ty)) {
          setTile(tx, ty, tileId);
        }
      }
    }
  }
}
```

---

## 📚 第九部分：技术选型总结

### 推荐技术栈

| 模块 | 选择 | 理由 |
|------|------|------|
| **前端框架** | SolidJS | 细粒度响应式，性能优于 React |
| **渲染层** | WebGPU | 最佳性能，原生 instancing 支持 |
| **核心逻辑** | AssemblyScript | TypeScript 语法 + WASM 性能 |
| **资源管理** | JS/TS | 利用浏览器 API（fetch, Image, Canvas） |
| **序列化** | JSON + Binary | 开发用 JSON，发布用 Binary |
| **状态管理** | Zustand/Nano Stores | 轻量、简单 |
| **UI 组件** | 自定义 + DaisyUI | 灵活控制 + 快速原型 |

### 架构图

```
┌─────────────────────────────────────────┐
│           UI Layer (SolidJS)            │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │ Toolbar  │ │  Layers  │ │ Preview │  │
│  └──────────┘ └──────────┘ └─────────┘  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       Rendering Layer (WebGPU)          │
│  - Instanced Rendering                  │
│  - Viewport Culling                     │
│  - Texture Atlas Management             │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│    Logic Layer (AssemblyScript/WASM)    │
│  - TileMap ECS                          │
│  - Edit Commands                        │
│  - History Stack                        │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Data Layer (TypedArrays)           │
│  - Uint32Array (tile data)              │
│  - Float32Array (instance buffer)       │
│  - JSON/Binary Serialization            │
└─────────────────────────────────────────┘
```

---

## 🎯 第十部分：实现路线图

### Phase 1: 核心渲染（2-3 周）
- [ ] WebGPU 基础渲染管线
- [ ] TileSet 加载与图集管理
- [ ] 相机控制（缩放、平移）
- [ ] 单层 TileMap 渲染

### Phase 2: 基础编辑（2-3 周）
- [ ] 笔刷工具
- [ ] 橡皮擦工具
- [ ] 矩形工具
- [ ] 屏幕坐标转换
- [ ] 撤销/重做系统

### Phase 3: 多层支持（1-2 周）
- [ ] 图层管理 UI
- [ ] 图层显示/隐藏
- [ ] 图层锁定
- [ ] Z 排序

### Phase 4: 高级工具（2-3 周）
- [ ] 填充工具（Flood Fill）
- [ ] 选区工具
- [ ] 多瓦片笔刷
- [ ] 快捷键系统

### Phase 5: 性能优化（1-2 周）
- [ ] 视口裁剪
- [ ] 分块加载
- [ ] 差分更新
- [ ] 图层合并

### Phase 6: 存档系统（1 周）
- [ ] JSON 导出/导入
- [ ] Binary 序列化
- [ ] 自动保存
- [ ] 版本管理

### Phase 7: 扩展功能（可选）
- [ ] 自动地形连接
- [ ] 动画瓦片
- [ ] 碰撞层编辑
- [ ] 导航层生成
- [ ] 小地图预览

---

## 💡 关键要点总结

### 1. 数据驱动设计
- 使用紧凑的类型化数组（Uint32Array）
- 一维数组存储，行主序映射
- 分离数据和视图（MVC 模式）

### 2. GPU 加速渲染
- 利用 instancing 批量渲染
- 视口裁剪减少绘制数量
- 纹理图集减少状态切换

### 3. 响应式交互
- 实时坐标转换反馈
- 插值保证绘制连续性
- 命令模式实现撤销功能

### 4. 可扩展架构
- 插件化图层类型
- 元数据系统支持自定义属性
- 模块化工具系统

### 5. 性能优先
- WASM 处理密集计算
- 差分更新减少数据传输
- 分块加载支持超大地图

---

## 🔗 相关资源

### 学习资源
- [WebGPU Fundamentals](https://webgpufundamentals.org/)
- [AssemblyScript Book](https://www.assemblyscript.org/introduction.html)
- [Godot TileMap Documentation](https://docs.godotengine.org/en/stable/classes/class_tilemap.html)

### 工具推荐
- [Tiled Map Editor](https://www.mapeditor.org/) - 参考实现
- [Aseprite](https://www.aseprite.org/) - TileSet 制作
- [GPU Buffer Visualizer](https://github.com/gfx-rs/wgpu) - 调试工具

---

## ⚠️ 常见陷阱

1. **坐标系混淆**
   - 屏幕坐标、世界坐标、瓦片坐标要清晰区分
   - 注意 Y 轴方向（屏幕向下 vs 世界向上）

2. **内存泄漏**
   - 及时释放 GPU 缓冲区和纹理
   - 撤销栈要设置大小限制

3. **精度问题**
   - 缩放时使用双精度浮点数
   - 避免累积误差（定期重新计算）

4. **性能瓶颈**
   - 不要在每帧遍历所有瓦片
   - 避免频繁的 GPU 缓冲区更新

5. **浏览器兼容性**
   - WebGPU 需要 Chrome 113+
   - 提供 Canvas2D 降级方案

---

## 结语

这份方案提供了一个完整的 Web 2D TileMap 编辑器实现路径。通过合理的架构设计、高效的渲染策略和精心的性能优化，完全可以在 Web 平台达到 Godot 级别的编辑体验。

关键是：**分层解耦、GPU 加速、数据紧凑、工具完善**。

祝开发顺利！🚀
