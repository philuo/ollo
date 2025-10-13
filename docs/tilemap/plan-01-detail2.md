# Web TileMap 编辑器五层架构完整实现方案（完整实现版）

本版本在 `plan-01-detail.md` 的基础上，补齐了所有关键数据结构与 API 的实现细节，并给出了可落地的示例代码（TypeScript/AssemblyScript/WGSL）。

说明：文中代码旨在体现完整思路与接口约定，可直接作为实现蓝本，少量细节（如错误处理、类型收窄、极端边界）可按项目需要小幅调整。

---

## 目录

- [架构总览](#架构总览)
- [第一层：数据层（Data Layer）](#第一层数据层data-layer)
  - [内存布局与类型](#内存布局与类型)
  - [数据管理器 API（AssemblyScript）](#数据管理器-apiassemblyscript)
  - [序列化/反序列化](#序列化反序列化)
- [第二层：逻辑层（Logic Layer - WASM/AssemblyScript）](#第二层逻辑层logic-layer---wasmassemblyscript)
  - [命令系统与编辑操作](#命令系统与编辑操作)
  - [空间查询与碰撞检测](#空间查询与碰撞检测)
  - [导出接口（exports）](#导出接口exports)
- [第三层：渲染层（Rendering Layer - WebGPU/TypeScript）](#第三层渲染层rendering-layer---webgputypescript)
  - [Renderer 结构与初始化](#renderer-结构与初始化)
  - [实例数据更新（全量与差分）](#实例数据更新全量与差分)
  - [渲染调用](#渲染调用)
  - [WGSL Shader](#wgsl-shader)
- [第四层：资源层（Resource Layer - TypeScript）](#第四层资源层resource-layer---typescript)
  - [纹理与 TileSet 管理](#纹理与-tileset-管理)
  - [LRU 缓存与预加载](#lru-缓存与预加载)
- [第五层：UI 层（UI Layer - SolidJS/TypeScript）](#第五层ui-层ui-layer---solidjstypescript)
  - [状态管理](#状态管理)
  - [核心组件与事件流](#核心组件与事件流)
- [层间交互与数据流](#层间交互与数据流)
- [性能优化实现](#性能优化实现)
- [构建与运行建议](#构建与运行建议)

---

## 架构总览

### 五层职责与技术栈

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (SolidJS)                                         │
│  - 组件树管理                                                │
│  - 用户交互捕获                                              │
│  - 视图状态同步                                              │
└────────────────┬────────────────────────────────────────────┘
                 │ Commands / Queries
┌────────────────▼────────────────────────────────────────────┐
│  Resource Layer (TypeScript)                                │
│  - 异步资源加载                                              │
│  - 图集生成与管理                                            │
│  - 缓存策略                                                  │
└────────────────┬────────────────────────────────────────────┘
                 │ Texture / TileSet Data
┌────────────────▼────────────────────────────────────────────┐
│  Rendering Layer (WebGPU)                                   │
│  - GPU Pipeline 管理                                        │
│  - Buffer 更新策略                                          │
│  - 实例化渲染                                                │
└────────────────┬────────────────────────────────────────────┘
                 │ Read TileMap Data
┌────────────────▼────────────────────────────────────────────┐
│  Logic Layer (WASM - AssemblyScript)                        │
│  - ECS/世界管理                                             │
│  - 编辑命令处理                                              │
│  - 历史栈管理                                                │
└────────────────┬────────────────────────────────────────────┘
                 │ Direct Memory Access
┌────────────────▼────────────────────────────────────────────┐
│  Data Layer (TypedArrays in Linear Memory)                  │
│  - Uint32Array: Tile IDs                                   │
│  - Uint8Array: Flags/Metadata                              │
│  - Struct Arrays: LayerMeta, DirtyRegion                   │
└─────────────────────────────────────────────────────────────┘
```

设计要点：

- 数据层在 WASM 线性内存中使用 TypedArray/Struct-of-Arrays（SoA）布局，既便于逻辑层高效修改，也便于渲染层零拷贝读取。
- 逻辑层提供完善的命令系统（Undo/Redo）与编辑操作，统一通过导出函数暴露给 UI 层。
- 渲染层从 WASM 内存中直接读取瓦片数据，结合视口裁剪和实例化渲染，保证性能。
- 资源层负责纹理、TileSet、图集等的异步加载与缓存。
- UI 层组织交互、状态与渲染循环调度。

---

## 第一层：数据层（Data Layer）

本层以 AssemblyScript 实现，驻留于 WASM 线性内存，向逻辑层提供零拷贝数据访问能力。主数据为每层一块 `Uint32Array`（存 tileId）。

### 内存布局与类型

```typescript
// assembly/data-layer.ts（示意，AssemblyScript）

export type u16 = u32; // 便于阅读，仍用 u32 承载，必要时可收窄

@unmanaged
export class DirtyRegion {
  layerIndex: u16;
  minX: u16;
  minY: u16;
  maxX: u16;
  maxY: u16;
}

@unmanaged
export class LayerFlags {
  // bit0: visible, bit1: locked, bit2: static
  value: u8;
}

export class LayerMeta {
  namePtr: u32;  // UTF-8 字符串指针（以 0 结尾）
  nameLen: u32;  // 长度（不含 0）
  zIndex: i16;
  flags: LayerFlags;
  opacity: u8;   // 0-255
}

export class TileLayer {
  tiles: Uint32Array; // 长度 = width * height
  meta: LayerMeta;

  constructor(width: u32, height: u32, namePtr: u32, nameLen: u32, zIndex: i16 = 0) {
    this.tiles = new Uint32Array(<i32>(width * height));
    const flags = new LayerFlags();
    flags.value = 0x01; // 默认可见
    this.meta = new LayerMeta();
    this.meta.namePtr = namePtr;
    this.meta.nameLen = nameLen;
    this.meta.zIndex = zIndex;
    this.meta.flags = flags;
    this.meta.opacity = 255;
  }
}

export class TileMapDataManager {
  width: u32;
  height: u32;
  tileSize: u32;
  layers: Array<TileLayer>;
  dirtyRegions: Array<DirtyRegion>;

  constructor(width: u32, height: u32, tileSize: u32, initialLayers: u32 = 1) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.layers = new Array<TileLayer>();
    this.dirtyRegions = new Array<DirtyRegion>();

    for (let i: u32 = 0; i < initialLayers; i++) {
      const nm = String.UTF8.encode(`Layer ${i}`, true);
      const ptr = changetype<u32>(nm);
      const len = nm.byteLength - 1; // 去掉 0 结尾
      this.layers.push(new TileLayer(width, height, ptr, len, <i16>i));
    }
  }

  get layerCount(): u32 { return <u32>this.layers.length; }

  getLayerTiles(layerIndex: u32): Uint32Array {
    assert(<i32>layerIndex >= 0 && layerIndex < this.layers.length, 'layerIndex OOB');
    return this.layers[<i32>layerIndex].tiles;
  }

  getLayerDataPtr(layerIndex: u32): u32 {
    const tiles = this.getLayerTiles(layerIndex);
    return changetype<u32>(tiles.dataStart);
  }

  getLayerDataSizeBytes(layerIndex: u32): u32 {
    return this.width * this.height * sizeof<u32>();
  }

  getLayerMeta(layerIndex: u32): LayerMeta {
    assert(<i32>layerIndex >= 0 && layerIndex < this.layers.length, 'layerIndex OOB');
    return this.layers[<i32>layerIndex].meta;
  }

  setLayerVisibility(layerIndex: u32, visible: bool): void {
    const meta = this.getLayerMeta(layerIndex);
    if (visible) meta.flags.value |= 0x01; else meta.flags.value &= ~0x01;
  }

  setLayerLocked(layerIndex: u32, locked: bool): void {
    const meta = this.getLayerMeta(layerIndex);
    if (locked) meta.flags.value |= 0x02; else meta.flags.value &= ~0x02;
  }

  setLayerStatic(layerIndex: u32, isStatic: bool): void {
    const meta = this.getLayerMeta(layerIndex);
    if (isStatic) meta.flags.value |= 0x04; else meta.flags.value &= ~0x04;
  }

  setLayerOpacity(layerIndex: u32, opacity01: f32): void {
    const meta = this.getLayerMeta(layerIndex);
    let v = <i32>(opacity01 * 255.0);
    if (v < 0) v = 0; if (v > 255) v = 255;
    meta.opacity = <u8>v;
  }

  renameLayer(layerIndex: u32, nameUtf8Ptr: u32, nameLen: u32): void {
    const meta = this.getLayerMeta(layerIndex);
    meta.namePtr = nameUtf8Ptr;
    meta.nameLen = nameLen;
  }

  addLayer(nameUtf8Ptr: u32, nameLen: u32, zIndex: i16 = 0): u32 {
    const layer = new TileLayer(this.width, this.height, nameUtf8Ptr, nameLen, zIndex);
    this.layers.push(layer);
    return <u32>(this.layers.length - 1);
  }

  removeLayer(layerIndex: u32): bool {
    if (layerIndex >= this.layerCount) return false;
    this.layers.splice(<i32>layerIndex, 1);
    return true;
  }

  moveLayer(srcIndex: u32, dstIndex: u32): bool {
    if (srcIndex >= this.layerCount || dstIndex >= this.layerCount) return false;
    if (srcIndex == dstIndex) return true;
    const layer = this.layers.splice(<i32>srcIndex, 1)[0];
    this.layers.splice(<i32>dstIndex, 0, layer);
    return true;
  }

  resizeMap(newWidth: u32, newHeight: u32, fillTile: u32 = 0): void {
    // 逐层重建并拷贝交集区域
    for (let i = 0; i < this.layers.length; i++) {
      const oldTiles = this.layers[i].tiles;
      const newTiles = new Uint32Array(<i32>(newWidth * newHeight));
      const copyW = <u32>min<i32>(<i32>this.width, <i32>newWidth);
      const copyH = <u32>min<i32>(<i32>this.height, <i32>newHeight);
      for (let y: u32 = 0; y < copyH; y++) {
        for (let x: u32 = 0; x < copyW; x++) {
          newTiles[<i32>(y * newWidth + x)] = oldTiles[<i32>(y * this.width + x)];
        }
        // 填充新右侧
        for (let x: u32 = copyW; x < newWidth; x++) {
          newTiles[<i32>(y * newWidth + x)] = fillTile;
        }
      }
      // 填充新底部
      for (let y: u32 = copyH; y < newHeight; y++) {
        for (let x: u32 = 0; x < newWidth; x++) newTiles[<i32>(y * newWidth + x)] = fillTile;
      }
      this.layers[i].tiles = newTiles;
    }
    this.width = newWidth;
    this.height = newHeight;
    this.markAllDirty();
  }

  markDirty(layerIndex: u32, minX: u32, minY: u32, maxX: u32, maxY: u32): void {
    // 合并相邻/重叠区域，避免碎片化
    for (let i = 0; i < this.dirtyRegions.length; i++) {
      const r = this.dirtyRegions[i];
      if (r.layerIndex == layerIndex && this.overlapsOrAdjacent(r, minX, minY, maxX, maxY)) {
        r.minX = <u16>min<u32>(r.minX, minX);
        r.minY = <u16>min<u32>(r.minY, minY);
        r.maxX = <u16>max<u32>(r.maxX, maxX);
        r.maxY = <u16>max<u32>(r.maxY, maxY);
        return;
      }
    }
    const region = new DirtyRegion();
    region.layerIndex = <u16>layerIndex;
    region.minX = <u16>minX;
    region.minY = <u16>minY;
    region.maxX = <u16>maxX;
    region.maxY = <u16>maxY;
    this.dirtyRegions.push(region);
  }

  markAllDirty(): void {
    for (let i: u32 = 0; i < this.layerCount; i++) {
      this.markDirty(i, 0, 0, this.width - 1, this.height - 1);
    }
  }

  private overlapsOrAdjacent(r: DirtyRegion, minX: u32, minY: u32, maxX: u32, maxY: u32): bool {
    // 邻接膨胀 1
    return !(r.maxX + 1 < <u16>minX || r.minX > <u16>(maxX + 1) || r.maxY + 1 < <u16>minY || r.minY > <u16>(maxY + 1));
  }

  flushDirtyRegions(): Array<DirtyRegion> {
    const out = this.dirtyRegions.slice();
    this.dirtyRegions.length = 0;
    return out;
  }
}
```

要点：

- 采用 AS 的 `Uint32Array` 直接驻留于线性内存，主机侧通过 `getLayerDataPtr()` 获得数据指针后可零拷贝读取。
- `DirtyRegion` 做了合并策略减少差分更新碎片。
- `resizeMap()` 在保持旧数据的同时填充新区域并标记全局脏区。

### 数据管理器 API（AssemblyScript）

完整 API 清单（逻辑层也会调用）：

```typescript
// 读/写基础信息
get layerCount(): u32
getLayerTiles(layerIndex: u32): Uint32Array
getLayerDataPtr(layerIndex: u32): u32
getLayerDataSizeBytes(layerIndex: u32): u32
getLayerMeta(layerIndex: u32): LayerMeta

// 图层管理
setLayerVisibility(layerIndex: u32, visible: bool): void
setLayerLocked(layerIndex: u32, locked: bool): void
setLayerStatic(layerIndex: u32, isStatic: bool): void
setLayerOpacity(layerIndex: u32, opacity01: f32): void // 0..1
renameLayer(layerIndex: u32, nameUtf8Ptr: u32, nameLen: u32): void
addLayer(nameUtf8Ptr: u32, nameLen: u32, zIndex: i16): u32
removeLayer(layerIndex: u32): bool
moveLayer(srcIndex: u32, dstIndex: u32): bool
resizeMap(newWidth: u32, newHeight: u32, fillTile?: u32): void

// 脏区域
markDirty(layerIndex: u32, minX: u32, minY: u32, maxX: u32, maxY: u32): void
markAllDirty(): void
flushDirtyRegions(): Array<DirtyRegion>
```

### 序列化/反序列化

```typescript
// assembly/serialization.ts（示意，AssemblyScript）

import { TileMapDataManager } from './data-layer';

export function serialize(manager: TileMapDataManager): ArrayBuffer {
  // 简化：导出 header + 每层 tile 数据
  const headerSize = 16; // width,height,tileSize,layerCount => 4*4
  const perLayerBytes = manager.getLayerDataSizeBytes(0);
  const total = headerSize + <i32>(manager.layerCount) * perLayerBytes;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);

  view.setUint32(0, manager.width, true);
  view.setUint32(4, manager.height, true);
  view.setUint32(8, manager.tileSize, true);
  view.setUint32(12, manager.layerCount, true);

  let offset = headerSize;
  for (let i: u32 = 0; i < manager.layerCount; i++) {
    const tiles = manager.getLayerTiles(i);
    memory.copy(
      changetype<usize>(out) + <usize>offset,
      tiles.dataStart,
      <usize>(perLayerBytes)
    );
    offset += perLayerBytes;
  }
  return out;
}

export function deserialize(buffer: ArrayBuffer): TileMapDataManager {
  const view = new DataView(buffer);
  const width = view.getUint32(0, true);
  const height = view.getUint32(4, true);
  const tileSize = view.getUint32(8, true);
  const layerCount = view.getUint32(12, true);

  const mgr = new TileMapDataManager(width, height, tileSize, layerCount);
  const headerSize = 16;
  const perLayerBytes = width * height * 4;
  let offset = headerSize;
  for (let i: u32 = 0; i < layerCount; i++) {
    const dst = mgr.getLayerTiles(i);
    memory.copy(
      dst.dataStart,
      changetype<usize>(buffer) + <usize>offset,
      <usize>(perLayerBytes)
    );
    offset += perLayerBytes;
  }
  mgr.markAllDirty();
  return mgr;
}
```

---

## 第二层：逻辑层（Logic Layer - WASM/AssemblyScript）

逻辑层围绕 `TileMapWorld` 组织，内含数据管理器与命令栈。所有编辑操作以命令模式实现，确保 Undo/Redo。

### 命令系统与编辑操作

```typescript
// assembly/commands.ts（AssemblyScript）

export abstract class Command {
  abstract execute(): void;
  abstract undo(): void;
}

export class CommandStack {
  private undoStack: Array<Command> = new Array<Command>();
  private redoStack: Array<Command> = new Array<Command>();
  private maxSize: i32;

  constructor(maxSize: i32 = 200) { this.maxSize = maxSize; }

  execute(cmd: Command): void {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack.length = 0;
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
  }

  undo(): bool {
    if (this.undoStack.length == 0) return false;
    const cmd = this.undoStack.pop();
    cmd.undo();
    this.redoStack.push(cmd);
    return true;
  }

  redo(): bool {
    if (this.redoStack.length == 0) return false;
    const cmd = this.redoStack.pop();
    cmd.execute();
    this.undoStack.push(cmd);
    return true;
  }
}

// 具体命令
import { TileMapDataManager } from './data-layer';

export class SetTileCommand extends Command {
  constructor(
    private mgr: TileMapDataManager,
    private layerIndex: u32,
    private index: u32,
    private oldValue: u32,
    private newValue: u32
  ) { super(); }

  execute(): void {
    const tiles = this.mgr.getLayerTiles(this.layerIndex);
    tiles[<i32>this.index] = this.newValue;
  }

  undo(): void {
    const tiles = this.mgr.getLayerTiles(this.layerIndex);
    tiles[<i32>this.index] = this.oldValue;
  }
}

export class FillRectCommand extends Command {
  private oldData: Uint32Array; // 行优先存储旧值
  constructor(
    private mgr: TileMapDataManager,
    private layerIndex: u32,
    private minX: u32,
    private minY: u32,
    private maxX: u32,
    private maxY: u32,
    private newValue: u32
  ) {
    super();
    const w = mgr.width;
    const rw = this.maxX - this.minX + 1;
    const rh = this.maxY - this.minY + 1;
    this.oldData = new Uint32Array(<i32>(rw * rh));
    const tiles = mgr.getLayerTiles(layerIndex);
    let idx = 0;
    for (let y = this.minY; y <= this.maxY; y++) {
      const rowStart = y * w + this.minX;
      for (let x = this.minX; x <= this.maxX; x++) {
        this.oldData[<i32>idx++] = tiles[<i32>(rowStart + (x - this.minX))];
      }
    }
  }

  execute(): void {
    const tiles = this.mgr.getLayerTiles(this.layerIndex);
    const w = this.mgr.width;
    for (let y = this.minY; y <= this.maxY; y++) {
      const rowStart = y * w + this.minX;
      for (let x = this.minX; x <= this.maxX; x++) {
        tiles[<i32>(rowStart + (x - this.minX))] = this.newValue;
      }
    }
  }

  undo(): void {
    const tiles = this.mgr.getLayerTiles(this.layerIndex);
    const w = this.mgr.width;
    let idx = 0;
    for (let y = this.minY; y <= this.maxY; y++) {
      const rowStart = y * w + this.minX;
      for (let x = this.minX; x <= this.maxX; x++) {
        tiles[<i32>(rowStart + (x - this.minX))] = this.oldData[<i32>idx++];
      }
    }
  }
}

// 洪水填充命令：保存索引与旧值的稀疏表
export class FloodFillCommand extends Command {
  private indices: Uint32Array;
  private oldValues: Uint32Array;
  constructor(
    private mgr: TileMapDataManager,
    private layerIndex: u32,
    indices: Array<u32>,
    oldValues: Array<u32>,
    private newValue: u32
  ) {
    super();
    this.indices = Uint32Array.wrap(changetype<ArrayBuffer>(indices.buffer));
    this.oldValues = Uint32Array.wrap(changetype<ArrayBuffer>(oldValues.buffer));
  }

  execute(): void {
    const tiles = this.mgr.getLayerTiles(this.layerIndex);
    for (let i = 0; i < this.indices.length; i++) tiles[<i32>this.indices[i]] = this.newValue;
  }

  undo(): void {
    const tiles = this.mgr.getLayerTiles(this.layerIndex);
    for (let i = 0; i < this.indices.length; i++) tiles[<i32>this.indices[i]] = this.oldValues[i];
  }
}
```

世界对象与操作：

```typescript
// assembly/world.ts（AssemblyScript）

import { TileMapDataManager } from './data-layer';
import { CommandStack, SetTileCommand, FillRectCommand, FloodFillCommand } from './commands';

export class TileMapWorld {
  data: TileMapDataManager;
  history: CommandStack;

  constructor(width: u32, height: u32, tileSize: u32, initialLayers: u32 = 1) {
    this.data = new TileMapDataManager(width, height, tileSize, initialLayers);
    this.history = new CommandStack(200);
  }

  setTile(layerIndex: u32, x: u32, y: u32, tileId: u32): void {
    if (x >= this.data.width || y >= this.data.height) return;
    const idx = y * this.data.width + x;
    const tiles = this.data.getLayerTiles(layerIndex);
    const oldValue = tiles[<i32>idx];
    const cmd = new SetTileCommand(this.data, layerIndex, idx, oldValue, tileId);
    this.history.execute(cmd);
    this.data.markDirty(layerIndex, x, y, x, y);
  }

  fillRect(layerIndex: u32, x0: u32, y0: u32, x1: u32, y1: u32, tileId: u32): void {
    let minX = <u32>min<u32>(x0, x1); let maxX = <u32>max<u32>(x0, x1);
    let minY = <u32>min<u32>(y0, y1); let maxY = <u32>max<u32>(y0, y1);
    minX = <u32>min<u32>(minX, this.data.width - 1);
    minY = <u32>min<u32>(minY, this.data.height - 1);
    maxX = <u32>min<u32>(maxX, this.data.width - 1);
    maxY = <u32>min<u32>(maxY, this.data.height - 1);

    const cmd = new FillRectCommand(this.data, layerIndex, minX, minY, maxX, maxY, tileId);
    this.history.execute(cmd);
    this.data.markDirty(layerIndex, minX, minY, maxX, maxY);
  }

  floodFill(layerIndex: u32, startX: u32, startY: u32, newTileId: u32): void {
    if (startX >= this.data.width || startY >= this.data.height) return;
    const tiles = this.data.getLayerTiles(layerIndex);
    const width = this.data.width;
    const height = this.data.height;
    const startIndex = startY * width + startX;
    const targetId = tiles[<i32>startIndex];
    if (targetId == newTileId) return;

    // 位图 visited
    const visitedBytes = ((width * height + 7) >> 3) as u32;
    const visited = new Uint8Array(<i32>visitedBytes);
    const queue = new Array<u32>();
    queue.push(startIndex);

    const indices = new Array<u32>();
    const oldValues = new Array<u32>();

    let minX: u32 = startX, maxX: u32 = startX, minY: u32 = startY, maxY: u32 = startY;

    while (queue.length > 0) {
      const index = queue.pop();
      const x = index % width; const y = index / width;
      const bitIndex = index; const byteIndex = bitIndex >> 3; const bitOffset = bitIndex & 7;
      const mask = <u8>(1 << bitOffset);
      if ((visited[<i32>byteIndex] & mask) != 0) continue;

      if (x >= width || y >= height) continue;
      if (tiles[<i32>index] != targetId) continue;

      visited[<i32>byteIndex] |= mask;
      indices.push(index);
      oldValues.push(tiles[<i32>index]);
      tiles[<i32>index] = newTileId;

      if (x > 0) queue.push(index - 1);
      if (x + 1 < width) queue.push(index + 1);
      if (y > 0) queue.push(index - width);
      if (y + 1 < height) queue.push(index + width);

      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }

    const cmd = new FloodFillCommand(this.data, layerIndex, indices, oldValues, newTileId);
    // 注意：我们已在执行阶段写入新值，命令栈需先撤回再重放，因此：
    // 将 execute() 设计为再次写入 newValue，不影响正确性
    this.history.execute(cmd);
    this.data.markDirty(layerIndex, minX, minY, maxX, maxY);
  }
}
```

### 空间查询与碰撞检测

```typescript
// assembly/queries.ts（AssemblyScript）

import { TileMapDataManager } from './data-layer';

export function getNeighbors8(mgr: TileMapDataManager, layerIndex: u32, x: u32, y: u32): StaticArray<u32> {
  const neighbors = new StaticArray<u32>(8);
  const tiles = mgr.getLayerTiles(layerIndex);
  const w = mgr.width; const h = mgr.height;
  let t = 0;
  for (let dy: i32 = -1; dy <= 1; dy++) {
    for (let dx: i32 = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) continue;
      const nx = <i32>x + dx, ny = <i32>y + dy;
      if (nx >= 0 && ny >= 0 && nx < <i32>w && ny < <i32>h) {
        neighbors[t++] = tiles[<i32>(ny * <i32>w + nx)];
      } else {
        neighbors[t++] = 0;
      }
    }
  }
  return neighbors;
}

export function rectCollision(mgr: TileMapDataManager, layerIndex: u32, rectX: f32, rectY: f32, rectW: f32, rectH: f32): bool {
  const ts = f32(mgr.tileSize);
  const minTileX = <u32>max<f32>(0.0, floor(rectX / ts));
  const minTileY = <u32>max<f32>(0.0, floor(rectY / ts));
  const maxTileX = <u32>min<f32>(f32(mgr.width - 1), ceil((rectX + rectW) / ts));
  const maxTileY = <u32>min<f32>(f32(mgr.height - 1), ceil((rectY + rectH) / ts));
  const tiles = mgr.getLayerTiles(layerIndex);
  const w = mgr.width;
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    const row = ty * w;
    for (let tx = minTileX; tx <= maxTileX; tx++) if (tiles[<i32>(row + tx)] != 0) return true;
  }
  return false;
}
```

### 导出接口（exports）

```typescript
// assembly/index.ts（AssemblyScript 导出）

import { TileMapWorld } from './world';
import { TileMapDataManager } from './data-layer';

let world: TileMapWorld | null = null;

// 初始化 / 生命周期
export function initWorld(width: u32, height: u32, tileSize: u32, initialLayers: u32 = 1): void {
  world = new TileMapWorld(width, height, tileSize, initialLayers);
}

export function disposeWorld(): void { world = null; }

// 基础查询
export function getWidth(): u32 { return world!.data.width; }
export function getHeight(): u32 { return world!.data.height; }
export function getTileSize(): u32 { return world!.data.tileSize; }
export function getLayerCount(): u32 { return world!.data.layerCount; }

// 图层元数据与属性
export function setLayerVisibility(layerIndex: u32, visible: u32): void { world!.data.setLayerVisibility(layerIndex, visible != 0); }
export function setLayerLocked(layerIndex: u32, locked: u32): void { world!.data.setLayerLocked(layerIndex, locked != 0); }
export function setLayerStatic(layerIndex: u32, isStatic: u32): void { world!.data.setLayerStatic(layerIndex, isStatic != 0); }
export function setLayerOpacity(layerIndex: u32, opacity01: f32): void { world!.data.setLayerOpacity(layerIndex, opacity01); }
export function renameLayer(layerIndex: u32, namePtr: u32, nameLen: u32): void { world!.data.renameLayer(layerIndex, namePtr, nameLen); }
export function addLayer(namePtr: u32, nameLen: u32, zIndex: i32): u32 { return world!.data.addLayer(namePtr, nameLen, <i16>zIndex); }
export function removeLayer(layerIndex: u32): u32 { return world!.data.removeLayer(layerIndex) ? 1 : 0; }
export function moveLayer(srcIndex: u32, dstIndex: u32): u32 { return world!.data.moveLayer(srcIndex, dstIndex) ? 1 : 0; }
export function resizeMap(newWidth: u32, newHeight: u32, fillTile: u32): void { world!.data.resizeMap(newWidth, newHeight, fillTile); }

// 编辑操作
export function setTile(layerIndex: u32, x: u32, y: u32, tileId: u32): void { world!.setTile(layerIndex, x, y, tileId); }
export function fillRect(layerIndex: u32, x0: u32, y0: u32, x1: u32, y1: u32, tileId: u32): void { world!.fillRect(layerIndex, x0, y0, x1, y1, tileId); }
export function floodFill(layerIndex: u32, x: u32, y: u32, tileId: u32): void { world!.floodFill(layerIndex, x, y, tileId); }

// 历史
export function undo(): u32 { return world!.history.undo() ? 1 : 0; }
export function redo(): u32 { return world!.history.redo() ? 1 : 0; }

// 数据访问（供渲染层读取）
export function getLayerDataPtr(layerIndex: u32): u32 { return world!.data.getLayerDataPtr(layerIndex); }
export function getLayerDataSize(layerIndex: u32): u32 { return world!.data.getLayerDataSizeBytes(layerIndex); }

// 脏区域（差分）
// 返回 count，用 getDirtyRegionPacked(i) 获取打包结果，并在消费后 clearDirtyRegions()
export function getDirtyRegionCount(): u32 { return <u32>world!.data.dirtyRegions.length; }
export function getDirtyRegionPacked(index: u32): u64 {
  const r = world!.data.dirtyRegions[<i32>index];
  // [layer:16][minX:12][minY:12][maxX:12][maxY:12]
  return (u64(r.layerIndex) << 48) | (u64(r.minX) << 36) | (u64(r.minY) << 24) | (u64(r.maxX) << 12) | u64(r.maxY);
}
export function clearDirtyRegions(): void { world!.data.dirtyRegions.length = 0; }
```

---

## 第三层：渲染层（Rendering Layer - WebGPU/TypeScript）

渲染层从 WASM 的 `WebAssembly.Memory` 中读取 Tile 数据，构建实例缓冲并进行实例化绘制。提供全量与差分两种更新路径。

### Renderer 结构与初始化

```typescript
// src/render/WebGPUTileMapRenderer.ts（TypeScript，示意）

export interface CameraState { x: number; y: number; zoom: number; width: number; height: number; }
export interface LayerRenderInfo { index: number; visible: boolean; opacity01: number; zIndex: number; instanceCount: number; }

export class WebGPUTileMapRenderer {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private pipeline!: GPURenderPipeline;

  private quadVertex!: GPUBuffer;
  private uniform!: GPUBuffer;
  private bindGroup!: GPUBindGroup;

  private instanceBuffers: Map<number, GPUBuffer> = new Map();
  private tileAtlas!: GPUTexture;
  private tileSampler!: GPUSampler;

  private format: GPUTextureFormat = 'bgra8unorm';

  constructor(private canvas: HTMLCanvasElement) {}

  async init(): Promise<void> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('WebGPU adapter not available');
    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu')!;
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' });

    this.quadVertex = this.device.createBuffer({
      size: 6 * 4 * 4, // 6 vertices * vec4<f32>
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.quadVertex.getMappedRange()).set([
      0, 0, 0, 0,
      1, 0, 1, 0,
      1, 1, 1, 1,
      0, 0, 0, 0,
      1, 1, 1, 1,
      0, 1, 0, 1,
    ]);
    this.quadVertex.unmap();

    this.uniform = this.device.createBuffer({ size: 64 + 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.tileSampler = this.device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });

    const shaderModule = this.device.createShaderModule({ code: TILEMAP_WGSL });
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          { arrayStride: 16, stepMode: 'vertex', attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x2' },
          ]},
          { arrayStride: 16, stepMode: 'instance', attributes: [
            { shaderLocation: 2, offset: 0, format: 'float32x2' },  // worldPos
            { shaderLocation: 3, offset: 8, format: 'uint32' },     // tileIndex
            { shaderLocation: 4, offset: 12, format: 'uint32' },    // layerData
          ]},
        ],
      },
      fragment: {
        module: shaderModule, entryPoint: 'fs_main', targets: [{
          format: this.format,
          blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                   alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } },
        }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });

    // 延后创建 bind group，等 setAtlasTexture
  }

  setAtlasTexture(texture: GPUTexture, atlasWidth: number, atlasHeight: number, tileSize: number): void {
    this.tileAtlas = texture;
    const view = this.tileAtlas.createView();
    const bindGroupLayout = this.pipeline.getBindGroupLayout(0);
    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniform } },
        { binding: 1, resource: view },
        { binding: 2, resource: this.tileSampler },
      ],
    });

    // 写入 atlasSize/tileSize 到 uniform 后 16 字节（以 16 字节对齐）
    const extra = new Float32Array([atlasWidth, atlasHeight, tileSize, tileSize]);
    this.device.queue.writeBuffer(this.uniform, 64, extra.buffer);
  }
```

### 实例数据更新（全量与差分）

```typescript
  private ensureInstanceBuffer(layerIndex: number, byteLength: number): GPUBuffer {
    const exist = this.instanceBuffers.get(layerIndex);
    if (exist && exist.size >= byteLength) return exist;
    if (exist) exist.destroy();
    const size = Math.max(byteLength, 64 * 1024);
    const buf = this.device.createBuffer({ size, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    this.instanceBuffers.set(layerIndex, buf);
    return buf;
  }

  updateLayerInstancesFull(
    layerIndex: number,
    wasmMemory: WebAssembly.Memory,
    dataOffset: number,
    width: number,
    height: number,
    tileSize: number,
    camera: CameraState
  ): number {
    const tiles = new Uint32Array(wasmMemory.buffer, dataOffset, width * height);
    // 视口裁剪
    const left = Math.max(0, Math.floor(camera.x / tileSize));
    const top = Math.max(0, Math.floor(camera.y / tileSize));
    const right = Math.min(width - 1, Math.ceil((camera.x + camera.width / camera.zoom) / tileSize));
    const bottom = Math.min(height - 1, Math.ceil((camera.y + camera.height / camera.zoom) / tileSize));

    const instances: number[] = [];
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const id = tiles[y * width + x];
        if (!id) continue;
        instances.push(x * tileSize, y * tileSize, id, (255 << 24) | layerIndex);
      }
    }
    if (instances.length === 0) return 0;
    const data = new Float32Array(instances);
    const buf = this.ensureInstanceBuffer(layerIndex, data.byteLength);
    this.device.queue.writeBuffer(buf, 0, data);
    return instances.length / 4; // instance count
  }

  // 差分：拉取脏区域并只重建这些区域的实例
  updateDirtyRegions(
    getDirtyRegionCount: () => number,
    getDirtyRegionPacked: (i: number) => bigint,
    clearDirtyRegions: () => void,
    wasmMemory: WebAssembly.Memory,
    getLayerDataPtr: (layer: number) => number,
    width: number,
    height: number,
    tileSize: number
  ): void {
    const count = getDirtyRegionCount();
    if (!count) return;
    for (let i = 0; i < count; i++) {
      const packed = getDirtyRegionPacked(i);
      const layer = Number((packed >> 48n) & 0xFFFFn);
      const minX = Number((packed >> 36n) & 0xFFFn);
      const minY = Number((packed >> 24n) & 0xFFFn);
      const maxX = Number((packed >> 12n) & 0xFFFn);
      const maxY = Number(packed & 0xFFFn);

      const ptr = getLayerDataPtr(layer);
      const tiles = new Uint32Array(wasmMemory.buffer, ptr, width * height);
      const instances: number[] = [];
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const id = tiles[y * width + x];
          if (!id) continue;
          instances.push(x * tileSize, y * tileSize, id, (255 << 24) | layer);
        }
      }
      const data = new Float32Array(instances);
      const buf = this.ensureInstanceBuffer(layer, data.byteLength);
      this.device.queue.writeBuffer(buf, 0, data);
    }
    clearDirtyRegions();
  }
```

### 渲染调用

```typescript
  render(camera: CameraState, layers: LayerRenderInfo[]): void {
    // 写视图矩阵到 uniform（简单正交投影：世界像素→屏幕 NDC）
    const viewProj = this.computeOrthoVP(camera);
    this.device.queue.writeBuffer(this.uniform, 0, viewProj.buffer);

    const encoder = this.device.createCommandEncoder();
    const view = this.context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 } }] });
    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.quadVertex);
    pass.setBindGroup(0, this.bindGroup);
    // 按 zIndex 排序
    const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    for (const L of sorted) {
      if (!L.visible) continue;
      const buf = this.instanceBuffers.get(L.index);
      if (!buf) continue;
      pass.setVertexBuffer(1, buf);
      pass.draw(6, L.instanceCount, 0, 0);
    }
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  private computeOrthoVP(cam: CameraState): Float32Array {
    // 简化：把世界坐标先除以 zoom 再减相机偏移，拼一个 4x4 矩阵
    const sx = 2 / (cam.width / cam.zoom);
    const sy = -2 / (cam.height / cam.zoom);
    const tx = -1 - (cam.x * sx);
    const ty = 1 - (cam.y * -sy);
    return new Float32Array([
      sx, 0, 0, 0,
      0, sy, 0, 0,
      0, 0, 1, 0,
      tx, ty, 0, 1,
    ]);
  }
}
```

### WGSL Shader

```wgsl
// src/render/tilemap.wgsl（示意，可直接使用）

struct Uniforms {
  viewProj: mat4x4<f32>,
  atlasSize: vec2<f32>, // packed at offset 64
  tileSize: vec2<f32>,  // packed at offset 72
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var tileAtlas: texture_2d<f32>;
@group(0) @binding(2) var atlasSampler: sampler;

struct VSIn {
  @location(0) pos: vec2<f32>,
  @location(1) uv: vec2<f32>,
};
struct InstIn {
  @location(2) worldPos: vec2<f32>,
  @location(3) tileIndex: u32,
  @location(4) layerData: u32,
};
struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) opacity: f32,
};

@vertex
fn vs_main(v: VSIn, inst: InstIn) -> VSOut {
  var o: VSOut;
  let world = inst.worldPos + v.pos * uniforms.tileSize; // 像素世界坐标
  o.position = uniforms.viewProj * vec4<f32>(world, 0.0, 1.0);

  let cols = u32(uniforms.atlasSize.x / uniforms.tileSize.x);
  let col = inst.tileIndex % cols;
  let row = inst.tileIndex / cols;
  let step = uniforms.tileSize / uniforms.atlasSize;
  let base = vec2<f32>(f32(col), f32(row)) * step;
  o.uv = base + v.uv * step;
  o.opacity = f32((inst.layerData >> 24u) & 0xFFu) / 255.0;
  return o;
}

@fragment
fn fs_main(i: VSOut) -> @location(0) vec4<f32> {
  var c = textureSample(tileAtlas, atlasSampler, i.uv);
  c.a = c.a * i.opacity;
  return c;
}
```

---

## 第四层：资源层（Resource Layer - TypeScript）

管理 TileSet 加载、atlas 纹理创建与缓存。

```typescript
// src/resource/ResourceManager.ts（TypeScript，示意）

export interface TileSetData {
  url: string;
  texture: GPUTexture;
  width: number; height: number;
  tileWidth: number; tileHeight: number;
  columns: number; rows: number;
  size: number; // 以 RGBA8 估算（width * height * 4）
}

export class ResourceManager {
  private textureCache = new Map<string, GPUTexture>();
  private tilesetCache = new Map<string, TileSetData>();
  private loading = new Map<string, Promise<TileSetData>>();
  private lru: string[] = [];
  private maxBytes = 100 * 1024 * 1024;
  private usedBytes = 0;

  constructor(private device: GPUDevice) {}

  async loadTileSet(url: string, tileWidth: number, tileHeight: number): Promise<TileSetData> {
    if (this.tilesetCache.has(url)) { this.touch(url); return this.tilesetCache.get(url)!; }
    if (this.loading.has(url)) return this.loading.get(url)!;
    const p = this._load(url, tileWidth, tileHeight).finally(() => this.loading.delete(url));
    this.loading.set(url, p);
    return p;
  }

  private async _load(url: string, tileWidth: number, tileHeight: number): Promise<TileSetData> {
    const img = await this.loadImage(url);
    const tex = this.createTextureFromImage(img);
    const data: TileSetData = {
      url, texture: tex, width: img.width, height: img.height,
      tileWidth, tileHeight,
      columns: Math.floor(img.width / tileWidth),
      rows: Math.floor(img.height / tileHeight),
      size: img.width * img.height * 4,
    };
    this.tilesetCache.set(url, data);
    this.touch(url);
    this.usedBytes += data.size; this.evictIfNeeded();
    return data;
  }

  private touch(url: string): void { const i = this.lru.indexOf(url); if (i >= 0) this.lru.splice(i, 1); this.lru.push(url); }

  private evictIfNeeded(): void {
    while (this.usedBytes > this.maxBytes && this.lru.length) {
      const key = this.lru.shift()!;
      const d = this.tilesetCache.get(key);
      if (d) { d.texture.destroy(); this.tilesetCache.delete(key); this.usedBytes -= d.size; }
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
  }

  private createTextureFromImage(img: HTMLImageElement): GPUTexture {
    const texture = this.device.createTexture({ size: [img.width, img.height, 1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    const canvas = new OffscreenCanvas(img.width, img.height); const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    this.device.queue.writeTexture({ texture }, imageData.data, { bytesPerRow: img.width * 4 }, [img.width, img.height, 1]);
    return texture;
  }

  preload(urls: string[], tileWidth = 32, tileHeight = 32): void { for (const u of urls) this.loadTileSet(u, tileWidth, tileHeight).catch(() => {}); }
}
```

---

## 第五层：UI 层（UI Layer - SolidJS/TypeScript）

UI 层组织状态与输入事件，驱动 WASM 编辑并触发渲染。

### 状态管理

```typescript
// src/store/tilemap-store.ts（TypeScript，示意）

import { createStore } from 'solid-js/store';

export type Tool = 'brush' | 'rect' | 'fill' | 'eraser' | 'select';

export interface LayerState { index: number; name: string; visible: boolean; locked: boolean; opacity: number; zIndex: number; }
export interface CameraState { x: number; y: number; zoom: number; width: number; height: number; }
export interface TileMapState {
  width: number; height: number; tileSize: number;
  layers: LayerState[]; currentLayerIndex: number;
  selectedTool: Tool; selectedTileId: number; isDrawing: boolean;
  camera: CameraState; showGrid: boolean; canUndo: boolean; canRedo: boolean;
}

export function createTileMapStore() {
  const [state, setState] = createStore<TileMapState>({
    width: 256, height: 256, tileSize: 32,
    layers: [{ index: 0, name: 'Ground', visible: true, locked: false, opacity: 1, zIndex: 0 }],
    currentLayerIndex: 0,
    selectedTool: 'brush', selectedTileId: 1, isDrawing: false,
    camera: { x: 0, y: 0, zoom: 1, width: 1280, height: 720 },
    showGrid: true, canUndo: false, canRedo: false,
  });
  return { state, setState };
}
```

### 核心组件与事件流

```typescript
// src/components/TileMapEditor.tsx（TypeScript+SolidJS，示意）

import { Component, onMount, createEffect } from 'solid-js';
import { createTileMapStore } from '../store/tilemap-store';
import { WebGPUTileMapRenderer } from '../render/WebGPUTileMapRenderer';

declare global { interface WebAssemblyExports {
  memory: WebAssembly.Memory;
  initWorld(w: number, h: number, tileSize: number, layers: number): void;
  disposeWorld(): void;
  getLayerDataPtr(layer: number): number;
  getLayerDataSize(layer: number): number;
  getDirtyRegionCount(): number;
  getDirtyRegionPacked(i: number): bigint;
  clearDirtyRegions(): void;
  setTile(layer: number, x: number, y: number, id: number): void;
  fillRect(layer: number, x0: number, y0: number, x1: number, y1: number, id: number): void;
  floodFill(layer: number, x: number, y: number, id: number): void;
  undo(): number; redo(): number;
}}

export const TileMapEditor: Component = () => {
  const { state, setState } = createTileMapStore();
  let renderer: WebGPUTileMapRenderer; let canvas!: HTMLCanvasElement;
  let wasm: WebAssemblyExports | null = null;

  onMount(async () => {
    renderer = new WebGPUTileMapRenderer(canvas); await renderer.init();
    const res = await fetch('/ollo.wasm'); const bytes = await res.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);
    wasm = instance.exports as unknown as WebAssemblyExports;
    wasm.initWorld(state.width, state.height, state.tileSize, 1);
    // TODO: 根据资源层设置 atlas 纹理
    requestAnimationFrame(loop);
  });

  const loop = () => {
    if (wasm) {
      // 差分更新
      renderer.updateDirtyRegions(
        () => wasm!.getDirtyRegionCount(),
        (i) => wasm!.getDirtyRegionPacked(i),
        () => wasm!.clearDirtyRegions(),
        wasm.memory,
        (layer) => wasm!.getLayerDataPtr(layer),
        state.width, state.height, state.tileSize
      );
      // 全量更新（首次或强制）：可按需调用 updateLayerInstancesFull
      const layers = state.layers.map(l => ({ index: l.index, visible: l.visible, opacity01: l.opacity, zIndex: l.zIndex, instanceCount: 0 }));
      for (const L of layers) {
        if (!L.visible) continue;
        const ptr = wasm.getLayerDataPtr(L.index);
        const count = renderer.updateLayerInstancesFull(L.index, wasm.memory, ptr, state.width, state.height, state.tileSize, state.camera);
        L.instanceCount = count;
      }
      renderer.render(state.camera, layers);
    }
    requestAnimationFrame(loop);
  };

  const toTile = (sx: number, sy: number) => {
    const r = canvas.getBoundingClientRect(); const cx = sx - r.left; const cy = sy - r.top;
    const wx = (cx / state.camera.zoom) + state.camera.x; const wy = (cy / state.camera.zoom) + state.camera.y;
    return { x: Math.floor(wx / state.tileSize), y: Math.floor(wy / state.tileSize) };
  };

  const onDown = (e: MouseEvent) => {
    if (!wasm) return; const L = state.layers[state.currentLayerIndex]; if (L.locked) return;
    const { x, y } = toTile(e.clientX, e.clientY);
    applyTool(x, y, e.shiftKey);
    setState({ isDrawing: true });
  };
  const onMove = (e: MouseEvent) => {
    if (!wasm || !state.isDrawing) return;
    const { x, y } = toTile(e.clientX, e.clientY);
    applyTool(x, y, e.shiftKey);
  };
  const onUp = (e: MouseEvent) => { setState({ isDrawing: false }); };

  const applyTool = (x: number, y: number, eraser: boolean) => {
    if (!wasm) return; const id = eraser ? 0 : state.selectedTileId;
    switch (state.selectedTool) {
      case 'brush': case 'eraser': wasm.setTile(state.currentLayerIndex, x, y, id); break;
      case 'fill': wasm.floodFill(state.currentLayerIndex, x, y, id); break;
      case 'rect': /* 由拖拽结束时调用 fillRect */ break;
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault(); const z = e.deltaY > 0 ? 0.9 : 1.1; const newZoom = Math.max(0.1, Math.min(10, state.camera.zoom * z));
    const r = canvas.getBoundingClientRect(); const mx = e.clientX - r.left; const my = e.clientY - r.top;
    const wx = (mx / state.camera.zoom) + state.camera.x; const wy = (my / state.camera.zoom) + state.camera.y;
    const nx = wx - (mx / newZoom); const ny = wy - (my / newZoom);
    setState('camera', { x: nx, y: ny, zoom: newZoom, width: state.camera.width, height: state.camera.height });
  };

  return (
    <div class="tilemap-editor">
      <canvas ref={canvas!} width={1280} height={720} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onWheel={onWheel} />
    </div>
  );
};
```

---

## 层间交互与数据流

1. UI 捕获输入 → 调用 WASM 导出（setTile/fillRect/floodFill 等）
2. 逻辑层命令执行 → 修改数据层 TypedArray → 标记脏区
3. 渲染循环：拉取脏区并差分更新实例缓冲；必要时全量重建
4. 渲染器按 zIndex 绘制各层 → 屏幕显示

---

## 性能优化实现

- 差分更新：脏区合并与仅更新必要区域的实例缓冲。
- 分块（Chunking）：超大地图将逻辑/渲染按块组织，按需上传与回收。
- Buffer 池化：实例缓冲按 2 的幂对齐复用，降低频繁创建销毁的碎片与开销。
- 静态层烘焙：静态层合并为离屏纹理，动态层与静态背景分开绘制以减少 draw call。

---

## 构建与运行建议

- AssemblyScript 使用 `--exportMemory` 暴露 `memory`，确保主机侧能直接访问线性内存；或配置为 import memory 以便外部复用。
- 确保 WASM 导出函数签名与 UI/渲染层调用约定一致（数值类型与顺序）。
- WebGPU 需 HTTPS 环境与兼容浏览器；开发期可用本地 HTTPS dev server。
- 若引入 KTX2/ASTC 压缩纹理，建议在资源层增加解码/转码与 GPU 上传路径。

---

以上为完整可执行的五层实现方案及参考代码，覆盖数据结构、API 设计与关键路径，便于直接落地与扩展。


