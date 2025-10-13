# Web TileMap 编辑器五层架构（v2 详尽设计稿，含 JS↔WASM 边界优化）

本设计文档是对 v1 方案（plan-01）的一次面向性能与工程落地的全面迭代，聚焦 JS↔WASM 边界开销优化、内存与 API 稳定性、可观测性与可扩展性，给出完整的数据结构与 API 设计，并提供 AssemblyScript、TypeScript 与 WGSL 层面的参考实现蓝本。

说明：文档内容覆盖广泛，按「从边界到内核」的原则组织；所有代码示例均可直接移植为项目起始实现，接口与常量建议严格遵循，便于后续兼容与演进。

---

## 目录

- 目标与约束
- 总体架构与边界策略
- JS↔WASM 边界优化设计
  - 调用频次压缩（Command RingBuffer）
  - 返回值与事件（Event RingBuffer）
  - 字符串与大对象跨界策略（String Pool / Handle / Arena）
  - 内存增长与页管理策略（Reserve/Grow/Relocate）
  - 错误码与诊断（Error Code / Trace）
- 数据层（Data Layer, WASM Linear Memory）
  - 全局内存地图（Memory Map, Page 对齐）
  - 基本类型与对齐（Packed/Aligned Struct）
  - 图层、瓦片、块（Layer/Tile/Chunk）
  - 脏区与选择集（Dirty/Selection）
  - 序列化格式 v2（Streaming/Chunked）
  - API（管理/查询/修改）
- 逻辑层（Logic Layer, AssemblyScript）
  - 命令系统（Undo/Redo，批命令）
  - 编辑操作（Brush/Rect/Fill/Stamp/Line/Circle）
  - 约束检查与版本号
  - 导出接口（Exports v2）
- 渲染层（Rendering, WebGPU）
  - 渲染器抽象与帧图简化模型
  - 实例数据生成（全量/差分/按块）
  - 视口裁剪/层级混合/静态烘焙
  - WGSL 管线与对齐
- 资源层（Resource）
  - TileSet/Atlas/压缩纹理（KTX2/UASTC）
  - LRU + 预算管理
  - 预加载与优先级
- UI 层（SolidJS）
  - 状态流与命令提交
  - 交互细节与可观测性
- 性能基准与预算
- 附录（常量/结构/错误码/协议/示例）

---

## 目标与约束

- 优先目标：
  - 将 JS↔WASM 调用频次稳定压缩到「每帧常数级（0~3 次）」
  - 数据跨界零拷贝：瓦片/实例数据通过共享 `WebAssembly.Memory` 暴露
  - API 稳定：版本化导出与特性探测，向后兼容
  - 可观测：事件环、统计计数器、可调试断言
- 非目标（本阶段）：
  - 物理模拟与路径寻路（可作为拓展包）
  - 多用户协作一致性协议（另文）
- 约束：
  - Runtime：现代浏览器（WebGPU）、HTTPS 环境
  - 语言：AssemblyScript（WASM 侧）、TypeScript（宿主侧）、WGSL（Shader）
  - 纹理：优先 RGBA8；可选 KTX2/UASTC

---

## 总体架构与边界策略

核心思想：以「命令环形缓冲（Command RingBuffer）」作为 UI→WASM 的唯一高频边界通道，以「事件环（Event RingBuffer）」作为 WASM→UI 的回传通道；主数据（瓦片、脏区表、实例缓冲）常驻于 WASM 线性内存，宿主以 `TypedArray` 视图零拷贝读取。渲染层仅通过少量导出函数取得指针/大小，并从内存直接读写。

边界调用面最小化：

- 每帧 UI→WASM：
  - `pumpCommands(maxOps)`（消化命令环中已提交的操作）
  - 可选：`popEvents(maxEvents)`（或 UI 直接从事件环读取）
  - 可选：`getDirtyRegionCount()` + `getDirtyRegionPacked(i)`（差分路径）
- 初始化/偶发：
  - `initWorld(...) / disposeWorld()`
  - `reserveMemory(pages) / growHeap(pages)`
  - `serialize(ptr,len)/deserialize(ptr,len)`（指针+长度形式）

---

## JS↔WASM 边界优化设计

### 调用频次压缩（Command RingBuffer）

- 单生产者（UI 线程）→单消费者（WASM pump）模型，避免锁；
- 命令以「定长头 + 变长体」编码，支持批命令（Batch）；
- 提供「保守提交（commit）」与「回滚（rollback）」接口，错误即丢弃尾部；
- 提前预留队列容量（页面对齐），避免频繁增长；

内存布局：

```text
[CommandQueueHeader] (32 bytes, 16 字节对齐)
  u32 magic (=0x434D5155 'CMQU')
  u16 version (=2)
  u16 flags
  u32 capacityBytes
  u32 head  // 由 WASM 消费推进
  u32 tail  // 由 JS 生产推进
  u32 droppedCount
  u32 reserved

[RingBufferBytes] capacityBytes
```

命令编码（OP = u8）：

- 0x01 SET_TILE: `{u8 op, u16 layer, u16 x, u16 y, u32 tileId}`
- 0x02 FILL_RECT: `{op, u16 layer, u16 minX, u16 minY, u16 maxX, u16 maxY, u32 tileId}`
- 0x03 FLOOD_FILL: `{op, u16 layer, u16 x, u16 y, u32 tileId}`
- 0x10 BATCH_SET_TILE: `{op, u16 layer, u32 count, [u32 index, u32 tileId] * count}`
- 0x20 RESIZE_MAP: `{op, u16 newW, u16 newH, u32 fillTile}`
- 0x30 ADD_LAYER: `{op, u16 nameLen, i16 zIndex, u8 flags, u8 opacity, [u8 nameBytes]*nameLen}`
- 0x31 REMOVE_LAYER: `{op, u16 layer}`
- 0x32 MOVE_LAYER: `{op, u16 src, u16 dst}`
- 0x40 UNDO: `{op, u8 steps}`
- 0x41 REDO: `{op, u8 steps}`

所有多字节字段均小端序（LE），并按 2 字节对齐；批体按 4 字节对齐。

宿主写入伪码（TS）：

```ts
function cq_push_u8(buf: Uint8Array, ptr: number, v: number) { buf[ptr] = v & 0xFF; }
function cq_push_u16(buf: DataView, ptr: number, v: number) { buf.setUint16(ptr, v, true); }
function cq_push_u32(buf: DataView, ptr: number, v: number) { buf.setUint32(ptr, v, true); }

// 返回写入后的新 tail
function enqueueSetTile(mem: WebAssembly.Memory, qHeaderPtr: number, tile: {layer:number,x:number,y:number,id:number}): number {
  const i8 = new Uint8Array(mem.buffer);
  const dv = new DataView(mem.buffer);
  const head = dv.getUint32(qHeaderPtr + 12, true);
  const tail = dv.getUint32(qHeaderPtr + 16, true);
  const cap  = dv.getUint32(qHeaderPtr + 8, true);
  const need = 1 + 2 + 2 + 2 + 4; // op + layer + x + y + id
  if (((tail + need) % cap) === head) { dv.setUint32(qHeaderPtr + 24, dv.getUint32(qHeaderPtr + 24, true) + 1, true); return tail; }
  let p = tail;
  cq_push_u8(i8, qHeaderPtr + 32 + p, 0x01);
  p = (p + 1) % cap; cq_push_u16(dv, qHeaderPtr + 32 + p, tile.layer);
  p = (p + 2) % cap; cq_push_u16(dv, qHeaderPtr + 32 + p, tile.x);
  p = (p + 2) % cap; cq_push_u16(dv, qHeaderPtr + 32 + p, tile.y);
  p = (p + 2) % cap; cq_push_u32(dv, qHeaderPtr + 32 + p, tile.id);
  p = (p + 4) % cap; dv.setUint32(qHeaderPtr + 16, p, true);
  return p;
}
```

WASM 消费伪码（AS）：

```ts
// pumpCommands(maxOps: u32): u32  // 返回处理的 op 数
// - 每帧由 UI 调用一次
// - 内部读取 head/tail 并顺序消费，遇到非法/不足数据直接 break（不推进 head）
```

### 返回值与事件（Event RingBuffer）

对称设计：WASM 生成的提示/统计/Log/断点信息通过事件环回传 UI，避免高频函数返回值跨界。

事件编码：

- 0x01 LOG_INFO `{u8 op, u8 level, u16 msgLen, [u8]*msgLen}`
- 0x10 STATS_FRAME `{op, f32 msUpdate, f32 msRender, u32 dirtyCount, u32 drawCalls}`
- 0x20 ASSERT_FAIL `{op, u16 code, u16 len, [u8]*len}`

UI 只需要在开发/调试模式下轮询事件环，生产可关闭。

### 字符串与大对象跨界策略（String Pool / Handle / Arena）

- 字符串跨界采用「字符串池 + 句柄」：
  - UI 写入字符串池区域，获得 `strId`；命令体仅携带 `strId`；
  - WASM 解析命令后从池中取用；
- 大对象（如复杂选择集）跨界：
  - 使用 Arena 区域写入结构化数据，并在命令体携带 `{ptr,len}`；
  - WASM 消费后可立即复用/回收；

### 内存增长与页管理策略（Reserve/Grow/Relocate）

- 初始化时按上限估计预留页面（e.g. 64~128 pages）；
- 提供 `reserveMemory(pages)` 与 `growHeap(pages)`，允许 UI 主动调优；
- 大块区域（Tile/Chunk/Queue）按页对齐，便于统计与迁移；
- 若需要搬迁（Relocate），通过「双缓冲 + 原子指针切换」实现；

### 错误码与诊断（Error Code / Trace）

- 所有导出函数返回 `u32` 错误码（0 = OK）；
- 关键路径内置 `ASSERT(code)`，失败时事件环写入 `ASSERT_FAIL` 并返回错误；
- `getLastError()` 提供最近错误；

---

## 数据层（Data Layer, WASM Linear Memory）

数据层负责存放 Tile/Layers 及其派生结构（Chunks/Dirty/Selection），并提供零拷贝访问。

### 全局内存地图（建议）

```text
0x0000_0000  Globals & Heaps Header
0x0000_1000  CommandQueue (header + ring)
0x0001_1000  EventQueue   (header + ring)
0x0002_0000  StringPool / Arena
0x0010_0000  TileMap Heap (Layers contiguous)
0x0800_0000  Scratch/Temp (Undo/Redo snapshots, BFS, masks)
```

### 基本类型与对齐

```ts
// assembly/types.ts (AS)

export const TILE_EMPTY: u32 = 0;

@unmanaged
export class U8x4 { a: u8; b: u8; c: u8; d: u8; } // 4B

@unmanaged
export class LayerFlags { value: u8; } // bit0 visible, bit1 locked, bit2 static

@unmanaged
export class LayerMetaPacked {
  // 16B 对齐，整体 24B
  namePtr: u32; // UTF-8 以 0 结尾
  nameLen: u32;
  zIndex: i16; opacity: u8; flags: LayerFlags; // 共 4B（i16+u8+u8）
  reserved: u32; // 对齐填充
}

export class TileLayer {
  tiles: Uint32Array; // width * height
  meta: LayerMetaPacked;
}
```

### 图层、瓦片、块（Layer/Tile/Chunk）

按大图直接映射与按块（chunk）两种呈现共存：逻辑层以大图为准，渲染/序列化/差分可选按块路径。

```ts
// assembly/data-layer.ts (AS)

export class TileMapDataManager {
  width: u32; height: u32; tileSize: u32;
  layers: Array<TileLayer>;
  dirtyRegions: Array<DirtyRegion>;

  constructor(width: u32, height: u32, tileSize: u32, initialLayers: u32) { /* 同 v1，略 */ }

  getLayerTiles(li: u32): Uint32Array { /* 同 v1，略 */ }
  getLayerDataPtr(li: u32): u32 { /* 同 v1，略 */ }
  getLayerDataSizeBytes(li: u32): u32 { return this.width * this.height * 4; }

  // Chunk 视图（供可选的分块渲染/序列化）
  readChunk(li: u32, cx: u32, cy: u32, chunkSize: u32): Uint32Array {
    const tiles = this.getLayerTiles(li);
    const startX = cx * chunkSize, startY = cy * chunkSize;
    const rw = min<u32>(chunkSize, this.width - startX);
    const rh = min<u32>(chunkSize, this.height - startY);
    const out = new Uint32Array(<i32>(chunkSize * chunkSize));
    let k = 0; for (let y: u32 = 0; y < rh; y++) {
      const row = (startY + y) * this.width + startX;
      for (let x: u32 = 0; x < rw; x++) out[k++] = tiles[<i32>(row + x)];
      for (let x: u32 = rw; x < chunkSize; x++) out[k++] = TILE_EMPTY;
    }
    for (let y: u32 = rh; y < chunkSize; y++) for (let x: u32 = 0; x < chunkSize; x++) out[k++] = TILE_EMPTY;
    return out;
  }
}
```

### 脏区与选择集（Dirty/Selection）

脏区合并策略同 v1，增加：

- 「行块合并」：若同层内多行小脏区横向相邻可按行块合并；
- 「帧间合并阈值」：在高频编辑时延迟一个帧合并，减少 GPU 小写入；

选择集（Selection）存储为位掩码或稀疏索引（按大小自适应）。

```ts
@unmanaged
export class DirtyRegion { layer: u16; minX: u16; minY: u16; maxX: u16; maxY: u16; }

export class SelectionMask {
  // 小区域用稀疏索引，大区域用位图
  kind: u8; // 0 empty, 1 sparse, 2 bitmap
  sparse: Uint32Array | null;
  bitmap: Uint8Array | null; // width*height/8
}
```

### 序列化格式 v2（Streaming/Chunked）

文件头：

```text
MAGIC 'TMV2' (u32) | VERSION u16 | FLAGS u16 | width u32 | height u32 | tileSize u32 | layers u32
```

两种体：

- 大图体（FullImage）：紧跟每层完整 `width*height*u32`；
- 分块体（Chunked）：
  - `chunkSize u16 | chunksX u16 | chunksY u16`
  - 逐层逐块：`{cx u16, cy u16, rleLen u32, rleBytes[rleLen]}`（RLE/Run-Length 编码）

导入时可选择直接映射或按块解码。

### API（管理/查询/修改）

数据层面暴露（由逻辑层包装）：

- 读：`getLayerDataPtr(li) / getLayerDataSize(li)`
- 管理：新增/删除/移动层、重命名、可见/锁定/静态、透明度、zIndex
- 修改：`setTile / fillRect / floodFill / setTilesBatch(indices, ids)`
- 查询：`getTile(li, x, y) -> u32`
- 脏区：`flushDirty()` 返回合并后的列表（供逻辑层封装为导出）

---

（下接：逻辑层、渲染层、资源层、UI 层、性能基准与附录）

---

## 逻辑层（Logic Layer, AssemblyScript）

本层围绕「命令环形缓冲」消费、数据层修改与历史栈（Undo/Redo）展开。核心流程：

- UI 侧批量写入命令到 `CommandQueue` → 调用 `pumpCommands(maxOps)`
- 逻辑层按顺序解析命令 → 组装并执行命令对象 → 标记脏区
- 必要时写入 `EventQueue`（统计/告警/日志）

### 命令枚举与数据结构

```ts
// assembly/opcodes.ts

export const OP_SET_TILE: u8        = 0x01;
export const OP_FILL_RECT: u8       = 0x02;
export const OP_FLOOD_FILL: u8      = 0x03;
export const OP_BATCH_SET_TILE: u8  = 0x10;
export const OP_RESIZE_MAP: u8      = 0x20;
export const OP_ADD_LAYER: u8       = 0x30;
export const OP_REMOVE_LAYER: u8    = 0x31;
export const OP_MOVE_LAYER: u8      = 0x32;
export const OP_UNDO: u8            = 0x40;
export const OP_REDO: u8            = 0x41;

// 事件
export const EV_LOG: u8             = 0x01; // level + msg
export const EV_STATS: u8           = 0x10; // per frame
export const EV_ASSERT: u8          = 0x20;

// 错误码（0=OK）
export const ERR_OK: u32 = 0;
export const ERR_QUEUE_UNDERFLOW: u32 = 10;
export const ERR_QUEUE_OVERFLOW: u32 = 11;
export const ERR_INVALID_OP: u32 = 12;
export const ERR_OUT_OF_RANGE: u32 = 13;
export const ERR_MEMORY: u32 = 14;
export const ERR_UNSUPPORTED: u32 = 15;
```

### 环形缓冲头与工具

```ts
// assembly/ring.ts

@unmanaged
export class RingHeader {
  magic: u32;       // 'CMQU' 或 'EVQU'
  version: u16;     // 2
  flags: u16;       // 保留
  capacity: u32;    // ring 字节容量
  head: u32;        // 消费者推进（WASM）
  tail: u32;        // 生产者推进（JS）
  dropped: u32;     // 丢弃计数
  reserved: u32;    // 预留
}

export function ring_read_u8(base: usize, capacity: u32, p: u32): u8 {
  return load<u8>(base + 32 + <usize>p);
}
export function ring_read_u16(base: usize, capacity: u32, p: u32): u16 {
  return load<u16>(base + 32 + <usize>p);
}
export function ring_read_u32(base: usize, capacity: u32, p: u32): u32 {
  return load<u32>(base + 32 + <usize>p);
}
// 读并前移位置（环回）
export function ring_step(pos: u32, step: u32, capacity: u32): u32 { return (pos + step) % capacity; }
```

### 命令对象与历史栈

命令对象采用面向数据的实现，避免 AS 虚表开销过高；命令类型用枚举，数据以紧凑结构存储。为简洁，下例仍使用基类多态实现，实际可切换为标记+switch 以求极致性能。

```ts
// assembly/commands.ts

import { TileMapDataManager } from './data-layer';

export abstract class Command { abstract execute(): void; abstract undo(): void; }

export class CommandStack {
  private undoStack: Array<Command> = new Array<Command>();
  private redoStack: Array<Command> = new Array<Command>();
  constructor(private maxSize: i32 = 256) {}
  execute(cmd: Command): void {
    cmd.execute();
    this.undoStack.push(cmd); this.redoStack.length = 0;
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
  }
  undo(steps: u32 = 1): bool {
    let ok = false; for (let i: u32 = 0; i < steps; i++) {
      if (!this.undoStack.length) break; const c = this.undoStack.pop(); c.undo(); this.redoStack.push(c); ok = true;
    } return ok;
  }
  redo(steps: u32 = 1): bool {
    let ok = false; for (let i: u32 = 0; i < steps; i++) {
      if (!this.redoStack.length) break; const c = this.redoStack.pop(); c.execute(); this.undoStack.push(c); ok = true;
    } return ok;
  }
}

export class SetTileCommand extends Command {
  constructor(private mgr: TileMapDataManager, private layer: u32, private index: u32, private oldv: u32, private newv: u32) { super(); }
  execute(): void { const t = this.mgr.getLayerTiles(this.layer); t[<i32>this.index] = this.newv; }
  undo(): void { const t = this.mgr.getLayerTiles(this.layer); t[<i32>this.index] = this.oldv; }
}

export class FillRectCommand extends Command {
  private old: Uint32Array; constructor(
    private mgr: TileMapDataManager, private layer: u32,
    private minX: u32, private minY: u32, private maxX: u32, private maxY: u32, private val: u32
  ) { super(); const rw = this.maxX - this.minX + 1, rh = this.maxY - this.minY + 1; this.old = new Uint32Array(<i32>(rw * rh));
      const w = this.mgr.width; const tiles = this.mgr.getLayerTiles(this.layer); let k = 0;
      for (let y = this.minY; y <= this.maxY; y++) { const row = y * w + this.minX; for (let x = this.minX; x <= this.maxX; x++) this.old[<i32>k++] = tiles[<i32>(row + (x - this.minX))]; }
  }
  execute(): void { const w = this.mgr.width; const t = this.mgr.getLayerTiles(this.layer);
    for (let y = this.minY; y <= this.maxY; y++) { const row = y * w + this.minX; for (let x = this.minX; x <= this.maxX; x++) t[<i32>(row + (x - this.minX))] = this.val; } }
  undo(): void { const w = this.mgr.width; const t = this.mgr.getLayerTiles(this.layer); let k = 0;
    for (let y = this.minY; y <= this.maxY; y++) { const row = y * w + this.minX; for (let x = this.minX; x <= this.maxX; x++) t[<i32>(row + (x - this.minX))] = this.old[<i32>k++]; } }
}

export class SparseOverwriteCommand extends Command {
  constructor(private mgr: TileMapDataManager, private layer: u32, private indices: Uint32Array, private before: Uint32Array, private after: Uint32Array) { super(); }
  execute(): void { const t = this.mgr.getLayerTiles(this.layer); for (let i = 0; i < this.indices.length; i++) t[<i32>this.indices[i]] = this.after[i]; }
  undo(): void { const t = this.mgr.getLayerTiles(this.layer); for (let i = 0; i < this.indices.length; i++) t[<i32>this.indices[i]] = this.before[i]; }
}
```

### 世界对象与消费循环

```ts
// assembly/world.ts

import { TileMapDataManager, DirtyRegion } from './data-layer';
import { CommandStack, SetTileCommand, FillRectCommand, SparseOverwriteCommand } from './commands';
import { OP_SET_TILE, OP_FILL_RECT, OP_FLOOD_FILL, OP_BATCH_SET_TILE, OP_RESIZE_MAP, OP_ADD_LAYER, OP_REMOVE_LAYER, OP_MOVE_LAYER, OP_UNDO, OP_REDO, ERR_OK, ERR_INVALID_OP, ERR_OUT_OF_RANGE } from './opcodes';
import { ring_read_u8, ring_read_u16, ring_read_u32, ring_step } from './ring';

export class TileMapWorld {
  constructor(public data: TileMapDataManager, public history: CommandStack, public cmdHeaderPtr: u32, public evtHeaderPtr: u32) {}

  private boundsX(x: u32): u32 { return x >= this.data.width ? this.data.width - 1 : x; }
  private boundsY(y: u32): u32 { return y >= this.data.height ? this.data.height - 1 : y; }

  private setTile(layer: u32, x: u32, y: u32, id: u32): void {
    if (x >= this.data.width || y >= this.data.height) return;
    const idx = y * this.data.width + x; const tiles = this.data.getLayerTiles(layer); const oldv = tiles[<i32>idx];
    const cmd = new SetTileCommand(this.data, layer, idx, oldv, id); this.history.execute(cmd); this.data.markDirty(layer, x, y, x, y);
  }

  private fillRect(layer: u32, minX: u32, minY: u32, maxX: u32, maxY: u32, id: u32): void {
    minX = this.boundsX(minX); minY = this.boundsY(minY); maxX = this.boundsX(maxX); maxY = this.boundsY(maxY);
    if (maxX < minX || maxY < minY) return; const cmd = new FillRectCommand(this.data, layer, minX, minY, maxX, maxY, id);
    this.history.execute(cmd); this.data.markDirty(layer, minX, minY, maxX, maxY);
  }

  private floodFill(layer: u32, sx: u32, sy: u32, id: u32): void {
    if (sx >= this.data.width || sy >= this.data.height) return;
    const tiles = this.data.getLayerTiles(layer); const w = this.data.width; const h = this.data.height;
    const start = sy * w + sx; const target = tiles[<i32>start]; if (target == id) return;
    const visitedBytes = ((w * h + 7) >> 3) as u32; const vis = new Uint8Array(<i32>visitedBytes);
    const stack = new Array<u32>(); stack.push(start);
    const indices = new Array<u32>(); const before = new Array<u32>();
    let minX: u32 = sx, maxX: u32 = sx, minY: u32 = sy, maxY: u32 = sy;
    while (stack.length) {
      const idx = stack.pop(); const x = idx % w; const y = idx / w; const bi = idx >> 3, bo = idx & 7, m = <u8>(1 << bo);
      if ((vis[<i32>bi] & m) != 0) continue; if (tiles[<i32>idx] != target) continue; vis[<i32>bi] |= m;
      indices.push(idx); before.push(tiles[<i32>idx]); tiles[<i32>idx] = id;
      if (x > 0) stack.push(idx - 1); if (x + 1 < w) stack.push(idx + 1); if (y > 0) stack.push(idx - w); if (y + 1 < h) stack.push(idx + w);
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const cmd = new SparseOverwriteCommand(this.data, layer,
      Uint32Array.wrap(changetype<ArrayBuffer>(indices.buffer)),
      Uint32Array.wrap(changetype<ArrayBuffer>(before.buffer)),
      new Uint32Array(<i32>indices.length).fill(id)
    );
    this.history.execute(cmd); this.data.markDirty(layer, minX, minY, maxX, maxY);
  }

  pumpCommands(maxOps: u32): u32 {
    // 读取队列头
    const base = <usize>this.cmdHeaderPtr; const cap = load<u32>(base + 8);
    let head = load<u32>(base + 12); const tail = load<u32>(base + 16);
    let n: u32 = 0;
    while (head != tail && n < maxOps) {
      const op = ring_read_u8(base, cap, head); head = ring_step(head, 1, cap);
      if (op == OP_SET_TILE) {
        const layer = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const x = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const y = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const id = ring_read_u32(base, cap, head); head = ring_step(head, 4, cap);
        this.setTile(layer, x, y, id);
      } else if (op == OP_FILL_RECT) {
        const layer = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const minX = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const minY = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const maxX = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const maxY = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const id = ring_read_u32(base, cap, head); head = ring_step(head, 4, cap);
        this.fillRect(layer, minX, minY, maxX, maxY, id);
      } else if (op == OP_FLOOD_FILL) {
        const layer = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const x = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const y = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const id = ring_read_u32(base, cap, head); head = ring_step(head, 4, cap);
        this.floodFill(layer, x, y, id);
      } else if (op == OP_BATCH_SET_TILE) {
        const layer = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const count = ring_read_u32(base, cap, head); head = ring_step(head, 4, cap);
        const indices = new Uint32Array(<i32>count); const before = new Uint32Array(<i32>count); const after = new Uint32Array(<i32>count);
        const tiles = this.data.getLayerTiles(layer);
        for (let i: u32 = 0; i < count; i++) {
          const idx = ring_read_u32(base, cap, head); head = ring_step(head, 4, cap);
          const val = ring_read_u32(base, cap, head); head = ring_step(head, 4, cap);
          indices[<i32>i] = idx; before[<i32>i] = tiles[<i32>idx]; after[<i32>i] = val;
        }
        const cmd = new SparseOverwriteCommand(this.data, layer, indices, before, after); this.history.execute(cmd);
        // 脏区：按索引范围粗略合并
        let minX = this.data.width - 1, minY = this.data.height - 1, maxX: u32 = 0, maxY: u32 = 0;
        const w = this.data.width; for (let i: u32 = 0; i < count; i++) { const idx = indices[<i32>i]; const x = idx % w; const y = idx / w; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        this.data.markDirty(layer, minX, minY, maxX, maxY);
      } else if (op == OP_RESIZE_MAP) {
        const newW = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const newH = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const fill = ring_read_u32(base, cap, head); head = ring_step(head, 4, cap);
        this.data.resizeMap(newW, newH, fill);
      } else if (op == OP_ADD_LAYER) {
        const nameLen = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const zIndex = <i16>ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const flags = ring_read_u8(base, cap, head); head = ring_step(head, 1, cap);
        const opacity = ring_read_u8(base, cap, head); head = ring_step(head, 1, cap);
        // name bytes
        const nameBuf = new ArrayBuffer(nameLen + 1);
        memory.copy(changetype<usize>(nameBuf), base + 32 + <usize>head, nameLen);
        store<u8>(changetype<usize>(nameBuf) + nameLen, 0);
        head = ring_step(head, nameLen, cap);
        const li = this.data.addLayer(changetype<u32>(nameBuf), nameLen, zIndex);
        this.data.setLayerVisibility(li, (flags & 0x01) != 0); this.data.setLayerLocked(li, (flags & 0x02) != 0); this.data.setLayerStatic(li, (flags & 0x04) != 0);
        this.data.setLayerOpacity(li, f32(opacity) / 255.0);
      } else if (op == OP_REMOVE_LAYER) {
        const li = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap); this.data.removeLayer(li);
      } else if (op == OP_MOVE_LAYER) {
        const src = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap);
        const dst = ring_read_u16(base, cap, head); head = ring_step(head, 2, cap); this.data.moveLayer(src, dst);
      } else if (op == OP_UNDO) {
        const steps = ring_read_u8(base, cap, head); head = ring_step(head, 1, cap); this.history.undo(steps);
      } else if (op == OP_REDO) {
        const steps = ring_read_u8(base, cap, head); head = ring_step(head, 1, cap); this.history.redo(steps);
      } else {
        // 未知 op：停止消费，避免越界
        break;
      }
      n += 1;
    }
    store<u32>(base + 12, head); // 提交 head
    return n;
  }
}
```

### 导出接口全集（Exports v2）

导出函数尽量「无分配、无字符串」，多为数值或指针/长度形式。复杂数据通过内存共享（ptr,len）传递。

```ts
// assembly/index.ts

import { TileMapWorld } from './world';
import { TileMapDataManager } from './data-layer';
import { CommandStack } from './commands';

let world: TileMapWorld | null = null;
let lastError: u32 = 0;

export function getVersionMajor(): u32 { return 2; }
export function getVersionMinor(): u32 { return 0; }
export function getFeatureFlags(): u32 { return 0x01 /* ring */ | 0x02 /* dirty */ | 0x04 /* chunk-serialize */; }
export function getLastError(): u32 { return lastError; }

export function initWorld(width: u32, height: u32, tileSize: u32, layers: u32, cmdHeaderPtr: u32, evtHeaderPtr: u32): u32 {
  lastError = 0; const mgr = new TileMapDataManager(width, height, tileSize, layers); const hist = new CommandStack(512);
  world = new TileMapWorld(mgr, hist, cmdHeaderPtr, evtHeaderPtr); return 0;
}
export function disposeWorld(): void { world = null; }

// 每帧调用一次，消费命令队列
export function pumpCommands(maxOps: u32): u32 { if (!world) { lastError = 1; return 0; } return world.pumpCommands(maxOps); }

// 数据访问给渲染层
export function getLayerCount(): u32 { return world!.data.layerCount; }
export function getDimensions(): u64 { // 返回 (hi: width, lo: height) packed u64
  return (u64(world!.data.width) << 32) | u64(world!.data.height);
}
export function getTileSize(): u32 { return world!.data.tileSize; }
export function getLayerDataPtr(layer: u32): u32 { return world!.data.getLayerDataPtr(layer); }
export function getLayerDataSize(layer: u32): u32 { return world!.data.getLayerDataSizeBytes(layer); }

// 脏区
export function getDirtyRegionCount(): u32 { return <u32>world!.data.dirtyRegions.length; }
export function getDirtyRegionPacked(i: u32): u64 {
  const r = world!.data.dirtyRegions[<i32>i];
  return (u64(r.layer) << 48) | (u64(r.minX) << 36) | (u64(r.minY) << 24) | (u64(r.maxX) << 12) | u64(r.maxY);
}
export function clearDirtyRegions(): void { world!.data.dirtyRegions.length = 0; }

// 直达型编辑（可选，调试/低频使用；高频用命令环）
export function setTile(layer: u32, x: u32, y: u32, id: u32): u32 { world!.setTile(layer, x, y, id); return 0; }
export function fillRect(layer: u32, x0: u32, y0: u32, x1: u32, y1: u32, id: u32): u32 { world!.fillRect(layer, x0, y0, x1, y1, id); return 0; }
export function floodFill(layer: u32, x: u32, y: u32, id: u32): u32 { world!.floodFill(layer, x, y, id); return 0; }
export function undo(steps: u32): u32 { return world!.history.undo(steps) ? 1 : 0; }
export function redo(steps: u32): u32 { return world!.history.redo(steps) ? 1 : 0; }

// 序列化（ptr,len 指主机侧 buffer）
export function serialize(ptr: u32, lenPtr: u32): u32 { /* 省略：写入 TMV2 */ return 0; }
export function deserialize(ptr: u32, len: u32): u32 { /* 省略：读取 TMV2 */ return 0; }
```

### 断言与事件

建议在调试版本引入轻量断言：

```ts
// assembly/debug.ts

import { EV_ASSERT } from './opcodes';

export function ASSERT(cond: bool, code: u16, msg: string): void {
  if (!cond) {
    // 写入事件环（略），并可在导出处返回非 0
    unreachable();
  }
}
```

---

## 渲染层（Rendering, WebGPU）

渲染层遵循三原则：

- 零拷贝：从 `WebAssembly.Memory` 直接读取 `Uint32Array` 的 TileId
- 实例化：每个可见 tile → 一条实例，使用紧凑 16 字节布局
- 差分优先：大多数帧仅更新脏区覆盖的实例范围

### 类型与管线

```ts
// src/render/types.ts

export interface CameraState { x: number; y: number; zoom: number; width: number; height: number; }
export interface LayerRenderInfo { index: number; visible: boolean; opacity01: number; zIndex: number; instanceCount: number; }
export interface DirtyRegion { layer: number; minX: number; minY: number; maxX: number; maxY: number; }
```

```ts
// src/render/WebGPUTileMapRenderer.ts（节选，完整实现见 v1+本章）

const TILEMAP_WGSL = `
struct Uniforms { viewProj: mat4x4<f32>, atlasSize: vec2<f32>, tileSize: vec2<f32> };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var tileAtlas: texture_2d<f32>;
@group(0) @binding(2) var atlasSampler: sampler;
struct VSIn { @location(0) pos: vec2<f32>, @location(1) uv: vec2<f32> };
struct InstIn { @location(2) worldPos: vec2<f32>, @location(3) tileIndex: u32, @location(4) layerData: u32 };
struct VSOut { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, @location(1) opacity: f32 };
@vertex fn vs_main(v: VSIn, i: InstIn) -> VSOut {
  var o: VSOut; let world = i.worldPos + v.pos * uniforms.tileSize; o.position = uniforms.viewProj * vec4<f32>(world, 0.0, 1.0);
  let cols = u32(uniforms.atlasSize.x / uniforms.tileSize.x); let col = i.tileIndex % cols; let row = i.tileIndex / cols;
  let step = uniforms.tileSize / uniforms.atlasSize; let base = vec2<f32>(f32(col), f32(row)) * step; o.uv = base + v.uv * step;
  o.opacity = f32((i.layerData >> 24u) & 0xFFu) / 255.0; return o; }
@fragment fn fs_main(i: VSOut) -> @location(0) vec4<f32> { var c = textureSample(tileAtlas, atlasSampler, i.uv); c.a = c.a * i.opacity; return c; }
`;

export class WebGPUTileMapRenderer { /* 参见 v1 的实现 + 下述差分与按块扩展 */ }
```

### 差分与按块更新

差分路径推荐流程：

1. UI 每帧调用 `getDirtyRegionCount()`/`getDirtyRegionPacked(i)` → 解包为 `DirtyRegion`
2. 对每个 `layer` 聚类合并当帧脏区，生成局部实例数据
3. 使用 `queue.writeBuffer` 写入对应层的实例缓冲

按块（Chunked）路径：

- 将地图逻辑视图映射为渲染分块（如 32×32 瓦片一块），每块保有实例缓冲与引用计数；
- 视口裁剪先到块，再到瓦片，显著减少 CPU 侧实例收集

```ts
// src/render/chunked.ts（简化示例）

export class ChunkedInstances {
  constructor(private device: GPUDevice, private tileSize: number, private chunkSize: number) {}
  // 维护 chunkKey -> {instanceBuffer, instanceCount}
}
```

### 相机与矩阵

采用像素对齐的正交投影，避免半像素采样导致的纹理出血。矩阵在 CPU 侧构建写入 Uniform。

---

## 资源层（Resource）

目标：统一 TileSet/Atlas 的加载与缓存，支持可选压缩纹理。

### KTX2 / UASTC

- 通过 Worker + Basis Universal（KTX2）转码为 GPU 原生格式（ASTC/BC/ETC 等）；
- 回退：若不支持/失败，则走 RGBA8 上传路径；

```ts
// src/resource/ktx2.ts（架构示意）

export class KTX2Loader { /* 基于 Web Worker 的转码与纹理创建，略 */ }
```

### 预算与 LRU

与 v1 相同，增加：

- 纹理预算分档（高/中/低），UI 可切换档位；
- 空闲帧回收：在帧末尾调度回收，以减少峰值竞争；

---

## UI 层（SolidJS）

### 命令环写入策略

- 所有高频编辑操作（笔刷、拖拽）仅写入环，不直接调用导出函数；
- 每帧或每 N ms 批量提交，随后调用 `pumpCommands(maxOps)`；

### 可观测性

- Dev 面板：
  - 命令队列使用率（tail-head/capacity）
  - 脏区数量与面积
  - draw calls / instance count

---

## 性能基准与预算

建议建立自动化基准：

- 64×64、128×128、256×256、1024×1024 地图，笔刷速涂 1s
- 指标：
  - JS→WASM 调用次数（目标：≤ 2/帧）
  - pumpCommands 处理速率（ops/ms）
  - GPU writeBuffer 数据量（MB/帧）
  - 帧时间拆分（update/render）

---

## 附录 A：错误码

```text
0  OK
10 ERR_QUEUE_UNDERFLOW  读取队列时数据不足
11 ERR_QUEUE_OVERFLOW   队列满
12 ERR_INVALID_OP       未知或非法操作码
13 ERR_OUT_OF_RANGE     越界访问
14 ERR_MEMORY           内存错误/分配失败
15 ERR_UNSUPPORTED      功能不支持
```

## 附录 B：命令与事件编码

详见前文定义；此处提供 JSON Schema 参考（宿主侧调试使用）：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TileMap Command",
  "oneOf": [
    {"type":"object","properties":{"op":{"const":"SET_TILE"},"layer":{"type":"integer"},"x":{"type":"integer"},"y":{"type":"integer"},"tileId":{"type":"integer"}},"required":["op","layer","x","y","tileId"]},
    {"type":"object","properties":{"op":{"const":"FILL_RECT"},"layer":{"type":"integer"},"minX":{"type":"integer"},"minY":{"type":"integer"},"maxX":{"type":"integer"},"maxY":{"type":"integer"},"tileId":{"type":"integer"}},"required":["op","layer","minX","minY","maxX","maxY","tileId"]}
  ]
}
```

## 附录 C：内存地图（建议实现）

见前文全局内存地图。实际实现可按初始页估算进行微调。

---

（本章已补充逻辑层、渲染层、资源/UI 层关键内容。下文继续扩展：更细的按块渲染实现、KTX2 具体 worker 协议、完整 API 列表表格化、更多工具（直线/圆/印章/图案填充）与测试清单，以达到 3000+ 行详细度。）

---

## API 参考总览（Exports v2）

本节对所有 WASM 导出与共享内存布局进行系统化罗列，包含函数签名、参数、返回值、错误码与使用建议。所有导出函数均采用「数值/指针/长度」形式，避免跨界字符串分配；字符串统一通过 StringPool/句柄或命令环传递。

### 能力/版本探测

```text
u32 getVersionMajor()              // = 2
u32 getVersionMinor()              // = 0
u32 getFeatureFlags()              // bitmask: 0x01 ring | 0x02 dirty | 0x04 chunk-serialize | 0x08 selection
u32 getLastError()                 // 最近错误码，见附录 A
```

使用建议：宿主初始化后先探测能力，决定是否启用按块序列化、选择集同步等可选路径。

### 生命周期与内存

```text
u32 initWorld(u32 width, u32 height, u32 tileSize, u32 initialLayers,
              u32 cmdHeaderPtr, u32 evtHeaderPtr) // 0=OK
void disposeWorld()

// 内存页管理（可选）
u32 reserveMemory(u32 pages)     // 0=OK；建议在大文件加载前调用
u32 growHeap(u32 pages)          // 0=OK；必要时手动扩容
```

注意：`cmdHeaderPtr/evtHeaderPtr` 指向宿主侧预先放置到 `WebAssembly.Memory` 中的 RingHeader 起始地址。宿主可调用 `wasmInstance.exports.memory` 获取 `ArrayBuffer` 并直接写入。

### 命令消费（高频/每帧）

```text
u32 pumpCommands(u32 maxOps)   // 返回本帧执行的操作数（非字节）
```

建议每帧调用 1 次，`maxOps` 可设置为较大固定值（如 65535）以便吞吐；内部遇到非法或不足数据会提前结束。

### 数据访问（渲染层）

```text
u32 getLayerCount()
u64 getDimensions()             // (hi:width, lo:height) 打包 u64
u32 getTileSize()
u32 getLayerDataPtr(u32 layer)
u32 getLayerDataSize(u32 layer)
```

使用：

- 渲染层以 `new Uint32Array(memory.buffer, ptr, width*height)` 读取瓦片 ID；
- 实例数据由宿主计算并写入 GPU Buffer。

### 差分脏区（渲染层）

```text
u32 getDirtyRegionCount()
u64 getDirtyRegionPacked(u32 index) // [layer:16][minX:12][minY:12][maxX:12][maxY:12]
void clearDirtyRegions()
```

建议：每帧先批量获取、合并同层脏区后再更新 GPU Buffer，减少 writeBuffer 次数。

### 直达编辑（调试/低频）

```text
u32 setTile(u32 layer, u32 x, u32 y, u32 tileId)
u32 fillRect(u32 layer, u32 x0, u32 y0, u32 x1, u32 y1, u32 tileId)
u32 floodFill(u32 layer, u32 x, u32 y, u32 tileId)
u32 undo(u32 steps)
u32 redo(u32 steps)
```

建议在开发阶段或脚本化批处理使用；高频交互通过命令环。

### 序列化与反序列化（v2）

```text
u32 serialize(u32 outPtr, u32 outLenPtr)   // 写入 TMV2 至 outPtr 指向的 buffer（或返回所需长度）
u32 deserialize(u32 inPtr, u32 len)        // 从 TMV2 读取并重建内存结构
```

实现建议：序列化可先写入 header 与简表，再分块写入层数据；支持 FullImage 与 Chunked 两路径。

---

### API 逐项详解（含错误码、复杂度与边界条件）

为便于实施与测试，以下对每个导出函数/能力进行逐项说明。复杂度为理论近似；实际性能受实现细节与平台影响。

1) 版本/能力探测

- getVersionMajor/getVersionMinor
  - 返回：主/次版本号；用于向后兼容判断。
  - 复杂度：O(1)
  - 错误码：无（恒成功）
- getFeatureFlags
  - bit 含义：
    - 0x01: 支持 Command RingBuffer
    - 0x02: 支持 Dirty Region 查询
    - 0x04: 支持 TMV2 按块序列化
    - 0x08: 支持 Selection 跨界同步
  - 复杂度：O(1)
  - 错误码：无（恒成功）
- getLastError
  - 返回最近一次导出函数执行的错误码；仅在非 0 时代表错误发生。
  - 复杂度：O(1)

2) 生命周期与内存

- initWorld(width,height,tileSize,initialLayers,cmdHeaderPtr,evtHeaderPtr)
  - 含义：创建世界对象与数据层，初始化历史栈与队列指针。
  - 前置：宿主已在 memory 中放置 RingHeader 与 Ring 区域，写入 capacity/head/tail。
  - 返回：0=OK，非 0=错误（如尺寸过大导致分配失败）。
  - 复杂度：O(width*height*layers) 初始化瓦片数组。
  - 边界：
    - width,height>0 且不超过实现上限（建议 ≤ 16384）
    - tileSize>0 且为合理像素值（建议 8~256）
    - initialLayers≥1
- disposeWorld()
  - 含义：释放世界引用；AS 的 GC 将在安全时机回收。
  - 复杂度：O(1)
- reserveMemory(pages)/growHeap(pages)
  - 含义：尝试扩展 WASM Memory 页数（64KiB/页）。
  - 返回：0=OK；非 0=失败（宿主不支持或达到上限）。
  - 复杂度：O(1)；但可能触发底层内存重映射（由运行时管理）。

3) 命令消费

- pumpCommands(maxOps)
  - 含义：按顺序解释命令环，执行编辑与管理操作。
  - 返回：本帧已执行的操作数量（与字节数无关），不是错误码。
  - 复杂度：O(ops)；每条命令执行复杂度见对应命令描述。
  - 边界：遇到未知 op 或数据不足将提前结束，避免越界读。

4) 数据访问（渲染）

- getLayerCount/getDimensions/getTileSize
  - 含义：提供渲染循环基本维度信息。
  - 复杂度：O(1)
- getLayerDataPtr/getLayerDataSize
  - 含义：返回瓦片数组的起始指针与字节大小（Uint32Array）。
  - 复杂度：O(1)
  - 用法：`new Uint32Array(memory.buffer, ptr, width*height)`

5) 脏区（差分）

- getDirtyRegionCount/getDirtyRegionPacked/clearDirtyRegions
  - 含义：取得当前帧累计的脏区并清空。
  - 复杂度：
    - Count: O(1)
    - Packed: O(1)
    - Clear: O(n)（n 为脏区数量，通常较小）
  - 建议：
    - 宿主按层聚类合并后再更新 GPU，以减少 writeBuffer 次数与数据量。

6) 直达编辑（调试/脚本）

- setTile/fillRect/floodFill/undo/redo
  - 含义：直接调用世界对象的对应操作；高频交互不建议使用。
  - 错误码：0=OK；非 0 代表失败（如坐标越界）。
  - 复杂度：
    - setTile: O(1)
    - fillRect: O(w*h)
    - floodFill: O(k)（k 为连通区域大小）
    - undo/redo: O(steps + 数据量)

7) 序列化（TMV2）

- serialize/deserialize
  - 含义：读/写 TMV2；支持 FullImage 与 Chunked（RLE）两路径。
  - 复杂度：
    - serialize: O(width*height*layers) 或 O(chunks) 取决于路径
    - deserialize: 同上
  - 边界：
    - 大文件需配合 reserveMemory/growHeap
    - RLE 对重复区域友好；随机地图建议 FullImage

---

### 宿主使用范式（端到端流程）

```ts
// 伪代码：初始化 → 加载资源 → 编辑 → 渲染 → 保存
const { instance } = await WebAssembly.instantiate(wasmBytes);
const memory = instance.exports.memory as WebAssembly.Memory;

// 1) 初始化环形缓冲与世界
const cmd = initRing(memory, 0x1000, 1<<20, 0x434D5155);
const evt = initRing(memory, 0x11000, 1<<20, 0x45565155);
instance.exports.initWorld(256, 256, 32, 1, cmd.headerPtr, evt.headerPtr);

// 2) 资源层加载 TileSet/Atlas，并设置渲染器纹理（略）

// 3) 编辑：将高频操作写入命令环
cq_write_setTile(memory, cmd.headerPtr, 0, 10, 10, 42);
cq_write_fillRect(memory, cmd.headerPtr, 0, 0, 0, 31, 31, 3);
instance.exports.pumpCommands(0xFFFF);

// 4) 渲染：读取脏区并差分更新 → render()
const n = instance.exports.getDirtyRegionCount();
for (let i=0; i<n; i++) {
  const k = instance.exports.getDirtyRegionPacked(i) as bigint;
  // 解包并更新 GPU（略）
}
instance.exports.clearDirtyRegions();

// 5) 保存：serialize 到宿主 buffer（略）
```

---

## TMV2 文件格式与流式序列化详解

为平衡加载速度与体积，TMV2 采用「可选分块 + RLE」的混合格式；并提供顺序写入/读取接口，适合边写边传输（如远端存储或分片保存）。

### 头部（Header）

```text
offset size desc
0      4    magic 'TMV2'
4      2    version (0x0001)
6      2    flags   (bit0:chunked, bit1:rle, bit2:little-endian)
8      4    width
12     4    height
16     4    tileSize
20     4    layers
24     4    chunkSize (chunked==1 时有效，否则为 0)
28     4    reserved
-- header size = 32 bytes
```

约定：

- 所有多字节字段为 LE（little-endian）。
- 若 flags 未设置 chunked，则紧随其后为 FullImage 数据体。

### FullImage 数据体

```text
for layer in 0..layers-1:
  bytes = width*height*4  // Uint32 tileId
  write(bytes)
```

特点：

- 读取简单，可直接映射到目标层的 `Uint32Array`。
- 体积大，但适合随机/无大面积重复的地图。

### Chunked + RLE 数据体

```text
chunksX = ceil(width / chunkSize)
chunksY = ceil(height / chunkSize)
for layer in 0..layers-1:
  for cy in 0..chunksY-1:
    for cx in 0..chunksX-1:
      // 对 [cx,cy] 块进行 RLE 编码
      // 写入：cx(u16), cy(u16), rleLen(u32), rleBytes[rleLen]
```

RLE 编码约定（示例实现）：

```text
token(u8) | data...
0x00: run   → [count(u16), tileId(u32)]        // 重复 tileId count 次
0x01: mixed → [n(u16), tileId0..tileId(n-1)]   // 后续 n 个 tileId 逐个写入
```

编码策略：

- 从左到右、从上到下扫描一个 chunk；连续相同值使用 run；
- run 的最小收益阈值可设为 4（≥4 个相同 tile 才使用 run），否则 mixed。

### 序列化伪码（AS）

```ts
// assembly/serialize.ts (简化)

export function writeTMV2Full(mgr: TileMapDataManager, out: Uint8Array): u32 {
  let p: u32 = 0;
  // header
  store<u32>(changetype<usize>(out.buffer) + p, 0x32564D54, true); p += 4; // 'TMV2'
  store<u16>(changetype<usize>(out.buffer) + p, 1, true); p += 2;
  store<u16>(changetype<usize>(out.buffer) + p, 0, true); p += 2; // flags
  store<u32>(changetype<usize>(out.buffer) + p, mgr.width, true); p += 4;
  store<u32>(changetype<usize>(out.buffer) + p, mgr.height, true); p += 4;
  store<u32>(changetype<usize>(out.buffer) + p, mgr.tileSize, true); p += 4;
  store<u32>(changetype<usize>(out.buffer) + p, mgr.layerCount, true); p += 4;
  store<u32>(changetype<usize>(out.buffer) + p, 0, true); p += 4; // chunkSize
  store<u32>(changetype<usize>(out.buffer) + p, 0, true); p += 4; // reserved
  // body
  for (let li: u32 = 0; li < mgr.layerCount; li++) {
    const tiles = mgr.getLayerTiles(li);
    const bytes = mgr.width * mgr.height * 4;
    memory.copy(changetype<usize>(out.buffer) + p, tiles.dataStart, bytes);
    p += bytes;
  }
  return p;
}
```

### 反序列化伪码（AS）

```ts
export function readTMV2(buffer: ArrayBuffer): TileMapDataManager | null {
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true); if (magic != 0x32564D54) return null;
  const version = view.getUint16(4, true); if (version != 1) return null;
  const flags = view.getUint16(6, true);
  const width = view.getUint32(8, true), height = view.getUint32(12, true), tile = view.getUint32(16, true), layers = view.getUint32(20, true);
  const chunk = view.getUint32(24, true);
  const mgr = new TileMapDataManager(width, height, tile, layers);
  let p = 32;
  if ((flags & 0x1) == 0) {
    // full image
    const per = width * height * 4;
    for (let li: u32 = 0; li < layers; li++) {
      const dst = mgr.getLayerTiles(li);
      memory.copy(dst.dataStart, changetype<usize>(buffer) + p, per); p += per;
    }
  } else {
    // chunked + rle（解码过程略）
  }
  mgr.markAllDirty();
  return mgr;
}
```

### 流式读写（Streaming）

为支持边写边传/大地图拆分保存，可将 body 按层或按块分片写入固定大小的 `out` 缓冲，逐片 flush 到宿主；宿主将片段拼接为完整文件或逐段上传远端存储。

---

## JS 侧初始化与队列对接（参考实现）

宿主负责在 `WebAssembly.Memory` 中分配命令/事件环的 Header 与 Ring 区域，并将 Header 的 `capacity/head/tail` 初始化。以下示例展示最小初始化流程。

```ts
// host/queue-init.ts

export interface RingDesc { headerPtr: number; ringPtr: number; capacity: number; }

export function initRing(memory: WebAssembly.Memory, basePtr: number, capacity: number, magic: number): RingDesc {
  const dv = new DataView(memory.buffer);
  // Header 布局（与 WASM 侧 RingHeader 一致）
  dv.setUint32(basePtr + 0, magic, true);      // magic
  dv.setUint16(basePtr + 4, 2, true);          // version
  dv.setUint16(basePtr + 6, 0, true);          // flags
  dv.setUint32(basePtr + 8, capacity, true);   // capacity
  dv.setUint32(basePtr + 12, 0, true);         // head
  dv.setUint32(basePtr + 16, 0, true);         // tail
  dv.setUint32(basePtr + 20, 0, true);         // dropped
  dv.setUint32(basePtr + 24, 0, true);         // reserved
  // ring 紧随其后，从 basePtr+32 开始，占 capacity 字节
  const ringPtr = basePtr + 32;
  // 清零 ring
  new Uint8Array(memory.buffer, ringPtr, capacity).fill(0);
  return { headerPtr: basePtr, ringPtr, capacity };
}

export function createWasmWorld(instance: WebAssembly.Instance, width: number, height: number, tile: number, layers: number): { cmd: RingDesc; evt: RingDesc } {
  const memory = (instance.exports.memory as WebAssembly.Memory);
  // 简单起见，手动分配两个连续区域（生产中可由 WASM 返回分配的偏移）
  // 注意：此方式要求 Memory 已足够大，可先调用 reserveMemory/growHeap
  const cmdBase = 0x00001000; // 4KB 对齐
  const evtBase = 0x00011000; // 紧随其后
  const cap     = 1 << 20;    // 1MB ring
  const cmd = initRing(memory, cmdBase, cap, 0x434D5155); // 'CMQU'
  const evt = initRing(memory, evtBase, cap, 0x45565155); // 'EVQU'
  (instance.exports.initWorld as Function)(width, height, tile, layers, cmd.headerPtr, evt.headerPtr);
  return { cmd, evt };
}
```

### 命令写入工具（JS）

```ts
// host/queue-writer.ts

function wrap(cap: number, x: number): number { return x % cap; }

export function cq_tail(memory: WebAssembly.Memory, headerPtr: number): number {
  return new DataView(memory.buffer).getUint32(headerPtr + 16, true);
}
export function cq_head(memory: WebAssembly.Memory, headerPtr: number): number {
  return new DataView(memory.buffer).getUint32(headerPtr + 12, true);
}
export function cq_set_tail(memory: WebAssembly.Memory, headerPtr: number, v: number): void {
  new DataView(memory.buffer).setUint32(headerPtr + 16, v, true);
}

export function cq_has_space(memory: WebAssembly.Memory, headerPtr: number, need: number): boolean {
  const dv = new DataView(memory.buffer);
  const cap  = dv.getUint32(headerPtr + 8, true);
  const head = dv.getUint32(headerPtr + 12, true);
  const tail = dv.getUint32(headerPtr + 16, true);
  // 简化：保留 1 字节空隙避免 head==tail 歧义
  const used = tail >= head ? tail - head : cap - (head - tail);
  return (cap - used - 1) >= need;
}

export function cq_write_setTile(memory: WebAssembly.Memory, headerPtr: number, layer: number, x: number, y: number, tileId: number): boolean {
  const dv = new DataView(memory.buffer); const u8 = new Uint8Array(memory.buffer);
  const cap = dv.getUint32(headerPtr + 8, true); let tail = dv.getUint32(headerPtr + 16, true);
  const need = 1 + 2 + 2 + 2 + 4; if (!cq_has_space(memory, headerPtr, need)) return false;
  let p = tail;
  u8[headerPtr + 32 + p] = 0x01; p = wrap(cap, p + 1);
  dv.setUint16(headerPtr + 32 + p, layer, true); p = wrap(cap, p + 2);
  dv.setUint16(headerPtr + 32 + p, x, true);     p = wrap(cap, p + 2);
  dv.setUint16(headerPtr + 32 + p, y, true);     p = wrap(cap, p + 2);
  dv.setUint32(headerPtr + 32 + p, tileId, true);p = wrap(cap, p + 4);
  cq_set_tail(memory, headerPtr, p); return true;
}

export function cq_write_fillRect(memory: WebAssembly.Memory, headerPtr: number, layer: number, minX: number, minY: number, maxX: number, maxY: number, tileId: number): boolean {
  const dv = new DataView(memory.buffer); const u8 = new Uint8Array(memory.buffer);
  const cap = dv.getUint32(headerPtr + 8, true); let p = dv.getUint32(headerPtr + 16, true);
  const need = 1 + 2 + 2 + 2 + 2 + 2 + 4; if (!cq_has_space(memory, headerPtr, need)) return false;
  u8[headerPtr + 32 + p] = 0x02;           p = wrap(cap, p + 1);
  dv.setUint16(headerPtr + 32 + p, layer, true); p = wrap(cap, p + 2);
  dv.setUint16(headerPtr + 32 + p, minX, true);  p = wrap(cap, p + 2);
  dv.setUint16(headerPtr + 32 + p, minY, true);  p = wrap(cap, p + 2);
  dv.setUint16(headerPtr + 32 + p, maxX, true);  p = wrap(cap, p + 2);
  dv.setUint16(headerPtr + 32 + p, maxY, true);  p = wrap(cap, p + 2);
  dv.setUint32(headerPtr + 32 + p, tileId, true);p = wrap(cap, p + 4);
  cq_set_tail(memory, headerPtr, p); return true;
}

export function cq_write_batchSet(memory: WebAssembly.Memory, headerPtr: number, layer: number, updates: Array<{index:number, id:number}>): boolean {
  const dv = new DataView(memory.buffer); const u8 = new Uint8Array(memory.buffer);
  const cap = dv.getUint32(headerPtr + 8, true); let p = dv.getUint32(headerPtr + 16, true);
  const need = 1 + 2 + 4 + updates.length * (4 + 4); if (!cq_has_space(memory, headerPtr, need)) return false;
  u8[headerPtr + 32 + p] = 0x10;           p = wrap(cap, p + 1);
  dv.setUint16(headerPtr + 32 + p, layer, true); p = wrap(cap, p + 2);
  dv.setUint32(headerPtr + 32 + p, updates.length, true); p = wrap(cap, p + 4);
  for (const u of updates) { dv.setUint32(headerPtr + 32 + p, u.index, true); p = wrap(cap, p + 4); dv.setUint32(headerPtr + 32 + p, u.id, true); p = wrap(cap, p + 4); }
  cq_set_tail(memory, headerPtr, p); return true;
}
```

---

## 数据层：StringPool / Arena / 分配器（AS 实现）

字符串池与临时 Arena 采用简单线性分配器，避免 GC 干扰，适合频繁跨界传输：

```ts
// assembly/alloc.ts

@unmanaged
export class LinearAllocator {
  base: u32; size: u32; cursor: u32; end: u32;
  constructor(base: u32, size: u32) { this.base = base; this.size = size; this.cursor = base; this.end = base + size; }
  alloc(bytes: u32, align: u32 = 8): u32 { let p = (this.cursor + (align - 1)) & ~(align - 1); if (p + bytes > this.end) return 0; this.cursor = p + bytes; return p; }
  reset(): void { this.cursor = this.base; }
}

export class StringPool {
  private alloc: LinearAllocator; constructor(base: u32, size: u32) { this.alloc = new LinearAllocator(base, size); }
  put(str: string): u32 { const utf8 = String.UTF8.encode(str, true); const len = utf8.byteLength; const ptr = this.alloc.alloc(len, 1); if (!ptr) return 0; memory.copy(ptr, changetype<usize>(utf8), len); return ptr; }
}
```

### 数据层构造与内存区域

```ts
// assembly/data-boot.ts

import { TileMapDataManager } from './data-layer';
import { LinearAllocator, StringPool } from './alloc';

// 预留地址（可与宿主协商，由宿主写入到导出全局变量）
export const ADDR_STRING_POOL: u32 = 0x0020_0000;
export const SIZE_STRING_POOL: u32 = 0x00A0_0000; // 10MB
export const ADDR_ARENA_TEMP: u32  = 0x00C0_0000;
export const SIZE_ARENA_TEMP: u32  = 0x0200_0000; // 32MB

export class DataBoot {
  pool: StringPool; arena: LinearAllocator; mgr: TileMapDataManager;
  constructor(w: u32, h: u32, tile: u32, layers: u32) {
    this.pool = new StringPool(ADDR_STRING_POOL, SIZE_STRING_POOL);
    this.arena = new LinearAllocator(ADDR_ARENA_TEMP, SIZE_ARENA_TEMP);
    this.mgr  = new TileMapDataManager(w, h, tile, layers);
  }
}
```

---

## 工具：绘制扩展（Line/Circle/Stamp/Pattern）

为满足实际编辑需求，提供更多工具命令（通过命令环编码，并在 WASM 侧实现）：

- 直线（Bresenham）
- 圆（Midpoint Circle）
- 图章（将一段 2D 模板贴到目标位置）
- 图案填充（指定 tile pattern）

### 命令编码新增

```text
0x50 DRAW_LINE    {op, u16 layer, u16 x0, u16 y0, u16 x1, u16 y1, u32 tileId}
0x51 DRAW_CIRCLE  {op, u16 layer, u16 cx, u16 cy, u16 r, u32 tileId, u8 fill /*0=stroke,1=fill*/}
0x52 STAMP        {op, u16 layer, u16 x0, u16 y0, u16 w, u16 h, u32 ptr /*template ptr in arena*/}
0x53 PATTERN_FILL {op, u16 layer, u16 minX, u16 minY, u16 maxX, u16 maxY, u16 pw, u16 ph, u32 ptr /*pattern*/}
```

### WASM 实现要点（简述）

```ts
// assembly/tools.ts（节选）

export function drawLine(mgr: TileMapDataManager, layer: u32, x0: u32, y0: u32, x1: u32, y1: u32, id: u32): void {
  let dx = <i32>Math.abs(<i32>x1 - <i32>x0), sx = <i32>(x0 < x1 ? 1 : -1);
  let dy = -<i32>Math.abs(<i32>y1 - <i32>y0), sy = <i32>(y0 < y1 ? 1 : -1);
  let err = dx + dy; let x = <i32>x0, y = <i32>y0;
  const tiles = mgr.getLayerTiles(layer); const w = mgr.width;
  let minX = x0, maxX = x0, minY = y0, maxY = y0;
  while (true) {
    if (x >= 0 && y >= 0 && x < <i32>mgr.width && y < <i32>mgr.height) {
      const idx = <u32>(y) * w + <u32>(x); tiles[<i32>idx] = id;
      if (<u32>x < minX) minX = <u32>x; if (<u32>x > maxX) maxX = <u32>x; if (<u32>y < minY) minY = <u32>y; if (<u32>y > maxY) maxY = <u32>y;
    }
    if (x == <i32>x1 && y == <i32>y1) break;
    let e2 = (err << 1); if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; }
  }
  mgr.markDirty(layer, minX, minY, maxX, maxY);
}
```

宿主通过 `cq_write_*` 系列 API 写入上述工具命令，即可复用边界与历史机制。

---

## 端到端：UI 帧循环与最小样例（TS）

```ts
// host/frame.ts

export function frame(instance: WebAssembly.Instance, renderer: any, state: { camera: any, layers: any[], width: number, height: number, tileSize: number }, cmdHeaderPtr: number) {
  const wasm = instance.exports as any; const memory = (wasm.memory as WebAssembly.Memory);
  // 1) 每帧消费命令
  wasm.pumpCommands(0xFFFF);
  // 2) 读取脏区并差分更新（示例：直接遍历）
  const count = wasm.getDirtyRegionCount();
  for (let i = 0; i < count; i++) {
    const packed = wasm.getDirtyRegionPacked(i) as bigint;
    const layer = Number((packed >> 48n) & 0xFFFFn);
    const minX  = Number((packed >> 36n) & 0xFFFn);
    const minY  = Number((packed >> 24n) & 0xFFFn);
    const maxX  = Number((packed >> 12n) & 0xFFFn);
    const maxY  = Number(packed & 0xFFFn);
    // 此处可定位到层的 ptr → 收集该范围实例 → 写 GPU buffer（略）
  }
  wasm.clearDirtyRegions();
  // 3) （可选）全量更新可见层实例
  for (const L of state.layers) {
    if (!L.visible) continue; const ptr = wasm.getLayerDataPtr(L.index);
    // renderer.updateLayerInstancesFull(...)
  }
  // 4) 渲染
  // renderer.render(...)
}
```

---

## 可观测性与诊断（事件环规范）

调试模式下，WASM 在关键时刻写入 EV 事件，宿主定期拉取日志与统计。

事件编码扩展：

```text
0x01 LOG_INFO    {op, u8 level, u16 msgLen, [u8]*}
0x02 LOG_WARN    {op, u8 level, u16 msgLen, [u8]*}
0x03 LOG_ERROR   {op, u8 level, u16 msgLen, [u8]*}
0x10 STATS_FRAME {op, f32 msUpdate, f32 msRender, u32 dirtyCount, u32 drawCalls, u32 pumpOps}
0x20 ASSERT_FAIL {op, u16 code, u16 len, [u8]*}
0x30 HEAP_WATER  {op, u32 pages, u32 bytesUsed}
```

宿主侧示例：

```ts
// host/events.ts

export function pollEvents(memory: WebAssembly.Memory, evtHeaderPtr: number, max: number): void {
  const dv = new DataView(memory.buffer); const u8 = new Uint8Array(memory.buffer);
  const cap = dv.getUint32(evtHeaderPtr + 8, true); let head = dv.getUint32(evtHeaderPtr + 12, true); const tail = dv.getUint32(evtHeaderPtr + 16, true);
  let n = 0; while (head != tail && n++ < max) {
    const op = u8[evtHeaderPtr + 32 + head]; head = (head + 1) % cap;
    if (op === 0x10) { /* 解析 STATS_FRAME，略 */ }
    else if (op === 0x01 || op === 0x02 || op === 0x03) { /* 解析 log */ }
    else if (op === 0x20) { /* ASSERT_FAIL */ }
    else if (op === 0x30) { /* HEAP_WATER */ }
    else { break; }
  }
  dv.setUint32(evtHeaderPtr + 12, head, true);
}
```

---

## 渲染层深潜：管线、实例池、分块与可见性

本节对渲染层的工程化实现进行深入说明，覆盖资源初始化、实例缓冲池（Buffer Pool）、分块实例存储（ChunkedInstances）、可见性裁剪、层级绘制顺序与烘焙策略的组合与权衡。

### 管线与绑定布局（Pipeline & BindGroup）

建议固定一个 tilemap 管线，减少管线切换成本：

- 顶点输入：
  - Slot0: Quad（6 个三角形顶点，pos/uv）
  - Slot1: Instance（worldPos vec2, tileIndex u32, layerData u32）
- Uniform（Group0/Binding0）：
  - mat4 viewProj（64B）
  - vec2 atlasSize（8B）
  - vec2 tileSize（8B）
- 纹理/采样器（Group0/Binding1,2）：
  - tileAtlas, atlasSampler（最近邻）

BindGroup 复用策略：atlas 变更较少，可随资源层更新一次。相机矩阵每帧写入 uniform；tileSize/atlasSize 仅在 tileset 变更时更新。

### 实例缓冲池（Buffer Pool）

为避免频繁创建/销毁 `GPUBuffer` 导致碎片与驱动同步开销，采用 2 的幂扩容策略与空闲池复用：

```ts
// src/render/buffer-pool.ts

export class BufferPool {
  private free: GPUBuffer[] = [];
  private used: Set<GPUBuffer> = new Set();
  constructor(private device: GPUDevice) {}
  acquire(minBytes: number): GPUBuffer {
    // 找到第一个满足的空闲 buffer
    const i = this.free.findIndex(b => b.size >= minBytes);
    if (i >= 0) { const b = this.free.splice(i, 1)[0]; this.used.add(b); return b; }
    const pow2 = 1 << Math.ceil(Math.log2(Math.max(minBytes, 4 * 1024)));
    const buf = this.device.createBuffer({ size: pow2, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    this.used.add(buf); return buf;
  }
  release(buf: GPUBuffer) { if (this.used.delete(buf)) this.free.push(buf); }
  destroy() { for (const b of this.free) b.destroy(); for (const b of this.used) b.destroy(); this.free = []; this.used.clear(); }
}
```

### 分块实例存储（ChunkedInstances）

将地图按 `CHUNK_SIZE`（瓦片数）划分块，每块维护其实例缓冲与 `instanceCount`，渲染时按可见块遍历：

```ts
// src/render/chunked-instances.ts（示意）

export interface ChunkKey { cx: number; cy: number; layer: number }
export interface ChunkGPU { buffer: GPUBuffer; count: number; gen: number }

export class ChunkedInstances {
  private chunks = new Map<string, ChunkGPU>();
  private gen = 1; // 每帧增长，用于 LRU 释放策略
  constructor(private device: GPUDevice, private pool: BufferPool, private chunkSize: number, private tileSize: number) {}

  private key(cx: number, cy: number, layer: number): string { return `${layer}:${cx},${cy}`; }

  updateChunk(layer: number, cx: number, cy: number, instances: Float32Array) {
    const k = this.key(cx, cy, layer); const need = instances.byteLength;
    let cg = this.chunks.get(k);
    if (!cg) { const buf = this.pool.acquire(need); this.device.queue.writeBuffer(buf, 0, instances); this.chunks.set(k, { buffer: buf, count: instances.length / 4, gen: this.gen }); }
    else {
      if (cg.buffer.size < need) { this.pool.release(cg.buffer); cg.buffer = this.pool.acquire(need); }
      this.device.queue.writeBuffer(cg.buffer, 0, instances); cg.count = instances.length / 4; cg.gen = this.gen;
    }
  }

  beginFrame() { this.gen++; }
  endFrame(maxAge = 120) {
    for (const [k, cg] of this.chunks) if (this.gen - cg.gen > maxAge) { this.pool.release(cg.buffer); this.chunks.delete(k); }
  }

  forVisible(camera: { left:number; right:number; top:number; bottom:number }, width: number, height: number, fn: (layer:number,cx:number,cy:number,cg:ChunkGPU) => void) {
    const minCx = Math.max(0, Math.floor(camera.left / (this.chunkSize * this.tileSize)));
    const maxCx = Math.min(Math.ceil(width / this.chunkSize), Math.ceil(camera.right / (this.chunkSize * this.tileSize)));
    const minCy = Math.max(0, Math.floor(camera.top / (this.chunkSize * this.tileSize)));
    const maxCy = Math.min(Math.ceil(height / this.chunkSize), Math.ceil(camera.bottom / (this.chunkSize * this.tileSize)));
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        // 按层遍历（可在外层）
      }
    }
  }
}
```

### 可见性裁剪（Viewport Culling）

两级裁剪：先块后瓦片。块级裁剪直接按相机与 `chunkSize*tileSize` 比较；瓦片级裁剪仅在需要重建块时进行，平时复用已有实例缓冲。

### 静态层烘焙（Baking）

对于标记为 `static` 的层，合成到离屏纹理，主渲染时作为背景绘制，减小 draw calls。动态层仍走实例化路径。

---

## 资源层深潜：KTX2 Worker 协议与缓存预算

### KTX2 Worker 协议

使用 Web Worker 承担解码/转码任务，主线程仅持有结果纹理。消息协议建议：

```ts
// worker message schema
type Request = { id: number; kind: 'decodeKTX2'; url: string } | { id: number; kind: 'transcodeKTX2'; url: string; prefer: 'astc'|'bc7'|'etc2'|'rgba8' };
type Response = { id: number; ok: true; width: number; height: number; format: GPUTextureFormat; mipmaps: number; data: ArrayBuffer[] } | { id: number; ok: false; error: string };
```

主线程接收 `Response` 后创建 `GPUTexture`，写入各级 mip。

### 预算管理（Budget Manager）

- 目标：在 `maxBytes` 限制内维持常驻纹理/图集；
- 策略：按 LRU 与优先级驱逐；
- 观察：记录峰值、平均值、请求成功率；

```ts
// src/resource/budget.ts（示意）

export class BudgetManager {
  private bytes = 0; constructor(private limit: number) {}
  canAlloc(n: number) { return this.bytes + n <= this.limit; }
  alloc(n: number) { this.bytes += n; }
  free(n: number) { this.bytes = Math.max(0, this.bytes - n); }
  get usage() { return this.bytes; }
}
```

---

## UI 深潜：命令聚合、快捷键、选择与多工具

### 命令聚合与节流

高频输入（鼠标拖拽）不必每个像素都写环：

- 光标移动距离 < 0.3 tile 时跳过；
- 每 N 毫秒批量 flush 一次（例如 8~16ms）；
- 矩形/圈选在 mouseup 时一次性写入；

### 快捷键与模式切换

- b: brush, r: rect, f: fill, e: eraser, s: select
- ctrl/cmd+z: undo, ctrl/cmd+y: redo
- g: toggle grid, l: lock layer, v: visibility

### 选择与多工具

- 选择模式下生成 SelectionMask，工具对选择集外区域无效；
- 支持加选/减选/交集（shift/alt/ctrl）；

---

## 性能基准：基线与调优清单

### 基线场景

- S1: 256×256×1 图层，brush 连续涂抹 1s
- S2: 512×512×3 图层，rect flood 30 次
- S3: 1024×1024×4 图层，pattern 填充 10 次

### 指标看板

- js→wasm 调用次数/帧（目标 ≤ 2）
- pumpCommands 处理速率（ops/ms）
- writeBuffer 体积（MB/帧）
- draw calls（目标：静态→1 + 动态层数）
- 帧时间：update/render ms

### 调优清单

- 边界：批命令替代单命令；
- 合并：脏区合并阈值；
- 资源：atlas 重用与压缩纹理；
- 渲染：chunked 实例与静态烘焙；

---

## 测试与质量保障

### AssemblyScript 单元测试（as-pect）

- 测试 setTile/fillRect/floodFill 的边界与撤销；
- 序列化/反序列化一致性（golden 文件）；

### 宿主集成测试

- 命令环正确性（head/tail 回绕、溢出丢弃计数）；
- 大地图连续编辑稳定性；

### 端到端（E2E）

- 加载→编辑→保存→重载→渲染画面一致；

---

## 故障场景与恢复

### 队列溢出

- 现象：`droppedCount` 增长；
- 措施：增大 `capacity` 或提高 `pumpCommands` 调用频率；

### 内存不足

- 现象：初始化失败或序列化失败；
- 措施：`reserveMemory/growHeap`；降低预算；

### 未知命令

- 现象：`pumpCommands` 提前停止；
- 措施：检查编码；调试事件环获取断言；

---

## 完整 OP 列表与编码示例

为便于实现与联调，以下提供 JS 端编码/写入示例（部分）。

```ts
// OP 0x01 SET_TILE
function writeSetTile(mem: WebAssembly.Memory, hdr: number, layer: number, x: number, y: number, id: number) {
  cq_write_setTile(mem, hdr, layer, x, y, id);
}

// OP 0x02 FILL_RECT
function writeFillRect(mem: WebAssembly.Memory, hdr: number, layer: number, minX: number, minY: number, maxX: number, maxY: number, id: number) {
  cq_write_fillRect(mem, hdr, layer, minX, minY, maxX, maxY, id);
}

// OP 0x10 BATCH_SET_TILE
function writeBatch(mem: WebAssembly.Memory, hdr: number, layer: number, updates: Array<{index:number,id:number}>) {
  cq_write_batchSet(mem, hdr, layer, updates);
}
```

---

## 参考实现清单与落地建议

### 目录建议（WASM/AS）

```text
assembly/
  alloc.ts            // 线性分配器/字符串池
  data-layer.ts       // 数据管理器与脏区
  data-boot.ts        // 区域地址常量与 boot 逻辑
  commands.ts         // 命令对象与历史栈
  ring.ts             // 队列读写工具
  opcodes.ts          // OP/EV/ERR 常量
  tools.ts            // 扩展绘制工具
  world.ts            // pump/编辑逻辑聚合
  serialize.ts        // TMV2 读写
  index.ts            // 导出（exports v2）
```

### 目录建议（宿主/TS）

```text
src/
  render/
    WebGPUTileMapRenderer.ts
    buffer-pool.ts
    chunked-instances.ts
    types.ts
  resource/
    ResourceManager.ts
    ktx2.ts
    budget.ts
  host/
    queue-init.ts
    queue-writer.ts
    events.ts
  ui/
    store/
    components/
```

---

## 结语

本 v2 设计从 JS↔WASM 边界开销出发，重构调用与数据路径，形成「命令环 + 事件环 + 共享内存」的三段式边界；以分块与差分为核心的渲染更新策略，辅以静态层烘焙与缓冲池，既保证了帧间稳定性，也为大地图与多层复杂编辑提供了可伸缩空间。资源层引入 KTX2 与预算管理，UI 层以命令聚合与可观测性为抓手，形成一套端到端可度量、可优化、可扩展的工程方案。

后续演进建议：

- 引入 Worker 化渲染准备（实例构建）与资源解码的管道化；
- 引入更细粒度的按块脏区映射，避免大区域更新波及；
- 扩展工具栈（图案笔刷/沿路径布置/约束贴合）；
- 增加可回放编辑日志与协作 CRDT 协议；



---

## 附录 L：自动拼贴（Autotiling）规则引擎设计

本节新增自动拼贴（AutoTile）规则与实现，避免与前文重复的数据/渲染路径。自动拼贴在 WASM 逻辑层完成，UI 仅提交「变更点」或「区域」命令，渲染层按常规差分流程更新实例。

### 目标

- 兼容 4 邻域与 8 邻域两种模式；
- 支持两类规则：
  - 邻域位掩码（bitmask） → tileId 映射
  - Wang/边着色（edge coloring）→ 通过边编码查表
- 支持增量修复：变更一个瓦片时，只需要更新其周边 1~2 环邻域。

### 数据结构（AssemblyScript）

```ts
// assembly/autotile.ts（新）

export const AT_MODE_MASK4: u8 = 1;  // 上下左右
export const AT_MODE_MASK8: u8 = 2;  // 含对角

@unmanaged
export class AutoTileRuleEntry {
  // 对于 bitmask：maskKey -> tileId
  maskKey: u16;    // 0..(1<<8)-1
  tileId: u32;
}

export class AutoTileTable {
  mode: u8; // 1=mask4,2=mask8, 3=wang4(扩展)
  rules: Array<AutoTileRuleEntry>;
  defaultTile: u32; // 未命中时的替代

  constructor(mode: u8, defaultTile: u32 = 0) {
    this.mode = mode; this.defaultTile = defaultTile; this.rules = new Array<AutoTileRuleEntry>();
  }

  setRule(maskKey: u16, tileId: u32): void {
    const e = new AutoTileRuleEntry(); e.maskKey = maskKey; e.tileId = tileId; this.rules.push(e);
  }

  query(maskKey: u16): u32 {
    // 线性表查找（规则一般较少），需要极致性能可换为稀疏数组/哈希
    for (let i = 0; i < this.rules.length; i++) if (this.rules[i].maskKey == maskKey) return this.rules[i].tileId;
    return this.defaultTile;
  }
}

export class AutoTileEngine {
  constructor(private mgr: TileMapDataManager, private table: AutoTileTable) {}

  private makeMask(li: u32, x: u32, y: u32): u16 {
    const w = this.mgr.width, h = this.mgr.height; const tiles = this.mgr.getLayerTiles(li);
    const base = y * w + x; const c = tiles[<i32>base];
    let m: u16 = 0;
    // 4 邻域位 (上右下左) = (1,2,4,8)，8 邻域再加对角(16,32,64,128)
    if (y>0          && tiles[<i32>(base-w)]   == c) m |= 1;   // 上
    if (x+1<w       && tiles[<i32>(base+1)]   == c) m |= 2;   // 右
    if (y+1<h       && tiles[<i32>(base+w)]   == c) m |= 4;   // 下
    if (x>0          && tiles[<i32>(base-1)]   == c) m |= 8;   // 左
    if (this.table.mode == AT_MODE_MASK8) {
      if (x>0 && y>0            && tiles[<i32>(base-w-1)] == c) m |= 16;  // 左上
      if (x+1<w && y>0          && tiles[<i32>(base-w+1)] == c) m |= 32;  // 右上
      if (x>0 && y+1<h          && tiles[<i32>(base+w-1)] == c) m |= 64;  // 左下
      if (x+1<w && y+1<h        && tiles[<i32>(base+w+1)] == c) m |= 128; // 右下
    }
    return m;
  }

  applyAt(li: u32, x: u32, y: u32): void {
    if (x>=this.mgr.width || y>=this.mgr.height) return;
    const tiles = this.mgr.getLayerTiles(li); const idx = y*this.mgr.width+x; const maskKey = this.makeMask(li, x, y);
    const newId = this.table.query(maskKey); if (newId == 0) return;
    if (tiles[<i32>idx] != newId) { tiles[<i32>idx] = newId; this.mgr.markDirty(li, x, y, x, y); }
  }

  // 当 (x,y) 发生变更时，需要修复其邻域
  fixAround(li: u32, x: u32, y: u32, radius: u32 = 1): void {
    const minX = x>radius ? x-radius : 0; const minY = y>radius ? y-radius : 0;
    const maxX = min<u32>(this.mgr.width-1, x+radius); const maxY = min<u32>(this.mgr.height-1, y+radius);
    for (let yy=minY; yy<=maxY; yy++) for (let xx=minX; xx<=maxX; xx++) this.applyAt(li, xx, yy);
  }
}
```

### 命令扩展与增量修复

新增命令（避免与之前 OP 重复）：

```text
0x54 AUTO_APPLY_AT    {op, u16 layer, u16 x, u16 y}
0x55 AUTO_FIX_AROUND  {op, u16 layer, u16 x, u16 y, u16 radius}
```

UI 写环→`pumpCommands()` 解析→调用 `AutoTileEngine.fixAround()`。与直达编辑不同，自动拼贴不会直接设置具体 tileId，而是根据邻域映射计算。

---

## 附录 M：稀疏/稠密存储自适应切换

为在低占用层（大面积空白）下降低内存/带宽开销，引入稀疏存储模式；当占用率上升跨阈值时，回切稠密存储。保持对外 API 不变（get/set），内部按模式切换。

### 数据结构

```ts
// assembly/storage.ts

export const SPARSE_THRESHOLD_ENTER: f32 = 0.12; // <12% 进入稀疏
export const SPARSE_THRESHOLD_EXIT: f32  = 0.18; // >18% 退出稀疏（滞回）

@unmanaged
export class SparseKV { index: u32; tileId: u32; }

export class LayerStorage {
  mode: u8; // 0=dense,1=sparse
  dense: Uint32Array | null;
  sparse: Array<SparseKV> | null;
  usedCount: u32;
  width: u32; height: u32;

  constructor(width: u32, height: u32) {
    this.mode = 0; this.width = width; this.height = height; this.usedCount = 0;
    this.dense = new Uint32Array(<i32>(width*height)); this.sparse = null;
  }

  getDense(): Uint32Array { return this.dense!; }

  private occupancy(): f32 { return f32(this.usedCount) / f32(this.width*this.height); }

  private toSparse(): void {
    const d = this.dense!; this.sparse = new Array<SparseKV>();
    for (let i=0;i<d.length;i++) if (d[i]!=0) { const kv = new SparseKV(); kv.index = <u32>i; kv.tileId = d[i]; this.sparse!.push(kv); }
    this.dense = null; this.mode = 1;
  }

  private toDense(): void {
    const arr = new Uint32Array(<i32>(this.width*this.height));
    const sp = this.sparse!; for (let i=0;i<sp.length;i++) arr[<i32>sp[i].index] = sp[i].tileId;
    this.dense = arr; this.sparse = null; this.mode = 0;
  }

  set(index: u32, tileId: u32): void {
    if (this.mode==0) {
      const d = this.dense!; const oldv = d[<i32>index];
      if (oldv==0 && tileId!=0) this.usedCount++; else if (oldv!=0 && tileId==0) this.usedCount--;
      d[<i32>index] = tileId;
      if (this.occupancy() < SPARSE_THRESHOLD_ENTER) this.toSparse();
    } else {
      // 稀疏：线性查找，生产中建议替换为哈希/跳表
      const sp = this.sparse!; let found = -1;
      for (let i=0;i<sp.length;i++){ if (sp[i].index==index){ found=i; break; } }
      if (tileId==0) { if (found>=0){ sp.splice(found,1); this.usedCount--; } }
      else {
        if (found>=0) sp[found].tileId = tileId; else { const kv=new SparseKV(); kv.index=index; kv.tileId=tileId; sp.push(kv); this.usedCount++; }
      }
      if (this.occupancy() > SPARSE_THRESHOLD_EXIT) this.toDense();
    }
  }

  get(index: u32): u32 {
    if (this.mode==0) return this.dense![<i32>index];
    const sp = this.sparse!; for (let i=0;i<sp.length;i++) if (sp[i].index==index) return sp[i].tileId; return 0;
  }
}
```

集成：`TileLayer` 可替换 `tiles: Uint32Array` 为 `storage: LayerStorage` 并提供 `getLayerTiles()` 返回稠密视图（必要时构建临时阵列或在渲染前确保是稠密），以保持渲染层不变。

---

## 附录 N：历史差分环（History Ring）与压缩

相较于栈式命令对象，差分环可在内存受限场景下更稳健。设计写前日志（WAL）风格的环形缓冲存储「变更条目」，撤销/重做通过指针跳转。

### 变更条目

```ts
// assembly/history.ts

@unmanaged
export class DeltaEntry { index: u32; before: u32; after: u32; }

@unmanaged
export class BatchHeader { count: u32; layer: u16; reserved: u16; minX: u16; minY: u16; maxX: u16; maxY: u16; }

export class HistoryRing {
  base: u32; size: u32; head: u32; tail: u32; // 字节指针
  constructor(base: u32, size: u32) { this.base=base; this.size=size; this.head=base; this.tail=base; }
  // 省略：写入/回退/前进，防溢出策略与压缩（RLE 相邻 index）
}
```

集成策略：命令执行阶段同时写入 HistoryRing；撤销/重做时从环中回放。压缩：对连续 index 的 before/after 批量存储，减少字节。

---

## 附录 O：性能剖析与统计（Instrumentation）

在 WASM 侧增加轻量计时与计数器，帧末通过事件环发送：

```ts
// assembly/prof.ts

@global export let gPumpOps: u32 = 0; // 当帧消费的命令数
@global export let gDirtyRegions: u32 = 0;

export function resetFrameCounters(): void { gPumpOps = 0; gDirtyRegions = 0; }

// 若需要时间戳，可从宿主注入 now() import（performance.now）
// import function now(): f64;
```

宿主每帧汇总并在 Dev 面板展示，避免与先前 UI 章节重复。

---

## 附录 P：校验与安全性

为提升稳健性，WASM 在消费命令/序列化/反序列化时进行严格边界检查：

- 命令环：校验 head/tail 与 capacity 的合法性；
- 指针与长度：禁止越界访问 `memory.buffer`；
- 反序列化：魔数/版本/flags/尺寸范围检查；

提供工具函数：

```ts
// assembly/validate.ts

export function checkRange(val: u32, min: u32, max: u32): bool { return !(val<min || val>max); }
export function checkPtrLen(ptr: u32, len: u32): bool { const end = <u64>ptr + <u64>len; return end <= <u64>memory.size() * 65536; }
```

---

## 附录 Q：SharedArrayBuffer 与多线程管线

当启用 `SharedArrayBuffer` 与跨线程 `Atomics` 时，可在 Worker 将命令生产/消费与渲染准备分离（避免主线程卡顿）。

架构要点：

- 命令环写入：UI 主线程生产；
- `pumpCommands` 与实例构建：后台 Worker 消费；
- 渲染：主线程（WebGPU）仅提交 GPU 调用；

示意：

```ts
// 主线程：创建 SAB 并传给 Worker
const sab = new SharedArrayBuffer(2*1024*1024);
// 将其映射为命令/事件环区域，由 Worker 与主线程共享
```

注意：当前 WebAssembly.Memory 不可直接使用 SAB，但环形缓冲可以放入 SAB。为保持统一，本设计保持 WASM 环在 `WebAssembly.Memory`，多线程仅用于 JS 侧实例构建与资源解码。

---

## 附录 R：Node CLI（TMV2 工具）

提供命令行工具便于批处理：

```ts
// tools/tmv2.ts（Node 18+）
import fs from 'node:fs';
import path from 'node:path';

type Cmd = 'info'|'pack'|'unpack';

function readJSON(file: string) { return JSON.parse(fs.readFileSync(file, 'utf-8')); }

function writeTMV2FullImage(out: string, meta: {width:number;height:number;tileSize:number;layers:number}, layers: Uint32Array[]) {
  const header = Buffer.alloc(32);
  header.writeUInt32LE(0x32564D54, 0); // TMV2
  header.writeUInt16LE(1, 4); header.writeUInt16LE(0, 6);
  header.writeUInt32LE(meta.width, 8); header.writeUInt32LE(meta.height, 12);
  header.writeUInt32LE(meta.tileSize, 16); header.writeUInt32LE(meta.layers, 20);
  header.writeUInt32LE(0, 24); header.writeUInt32LE(0, 28);
  const body = Buffer.concat(layers.map(arr => Buffer.from(new Uint32Array(arr).buffer)));
  fs.writeFileSync(out, Buffer.concat([header, body]));
}

function info(file: string) {
  const buf = fs.readFileSync(file);
  const magic = buf.readUInt32LE(0); if (magic !== 0x32564D54) throw new Error('not TMV2');
  const version = buf.readUInt16LE(4); const flags = buf.readUInt16LE(6);
  const width = buf.readUInt32LE(8), height = buf.readUInt32LE(12), tileSize = buf.readUInt32LE(16), layers = buf.readUInt32LE(20);
  console.log({ version, flags, width, height, tileSize, layers });
}

const [,,cmd,...args] = process.argv as unknown as [string,string,Cmd,...string[]];
if (cmd==='info') info(args[0]);
else if (cmd==='pack') {
  const meta = readJSON(args[0]); const layers: Uint32Array[] = [];
  for (let i=0;i<meta.layers;i++) {
    const raw = fs.readFileSync(args[1+i]); const arr = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength/4); layers.push(new Uint32Array(arr));
  }
  writeTMV2FullImage(args[1+meta.layers], meta, layers);
}
else if (cmd==='unpack') {
  // 留作练习：解析 TMV2 并导出每层 raw（可对照 readTMV2）
}
```

---

## 附录 S：TypeScript 宿主封装（WasmTileMap）

```ts
// src/host/WasmTileMap.ts

export interface Dimensions { width: number; height: number }

export class WasmTileMap {
  constructor(private wasm: any) {}
  getDimensions(): Dimensions { const packed = this.wasm.getDimensions() as bigint; return { width: Number((packed>>32n)&0xFFFFFFFFn), height: Number(packed & 0xFFFFFFFFn) }; }
  getTileSize(): number { return this.wasm.getTileSize() as number; }
  getLayerCount(): number { return this.wasm.getLayerCount() as number; }
  pump(maxOps=0xFFFF): number { return this.wasm.pumpCommands(maxOps) as number; }
  dirtyRegions(): Array<{layer:number;minX:number;minY:number;maxX:number;maxY:number}> {
    const n = this.wasm.getDirtyRegionCount() as number; const out = [] as any[];
    for (let i=0;i<n;i++){ const p = this.wasm.getDirtyRegionPacked(i) as bigint; out.push({ layer:Number((p>>48n)&0xFFFFn), minX:Number((p>>36n)&0xFFFn), minY:Number((p>>24n)&0xFFFn), maxX:Number((p>>12n)&0xFFFn), maxY:Number(p&0xFFFn) }); }
    this.wasm.clearDirtyRegions(); return out;
  }
}
```

---

## 附录 T：v1 → v2 迁移指引

不重复 v1 内容，仅给出迁移步骤：

- 初始化：v1 直接导出编辑函数 → v2 采用 `initWorld + ring queues`；
- 编辑：将高频 `setTile/fillRect/floodFill` 改为写命令环；
- 渲染：继续从 `getLayerDataPtr` 读取；增量使用 `getDirtyRegion*()` 减少写入；
- 撤销：v1 的 `undo/redo` 仍可保留；可增配 HistoryRing；
- 序列化：迁移到 TMV2 头与 FullImage/Chunked 体；

---

## 附录 U：功能矩阵与降级

| 功能 | 必需 | 可选 | 降级 |
|---|---|---|---|
| WebGPU | 是 |  | Canvas2D/OffscreenCanvas（低清预览） |
| RingBuffer（命令） | 是 |  | 直接导出调用（低频） |
| Dirty 更新 |  | 是 | 全量重建实例 |
| KTX2 压缩纹理 |  | 是 | RGBA8 上传 |
| SAB/Worker |  | 是 | 单线程 |

---

## 附录 V：Canvas 降级渲染参考

```ts
// src/render/canvas-fallback.ts（简化）
export function drawGrid(ctx: CanvasRenderingContext2D, tiles: Uint32Array, width: number, height: number, tileSize: number) {
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    const id = tiles[y*width+x]; if (!id) continue; // 用颜色代替贴图示意
    ctx.fillStyle = `hsl(${(id*17)%360} 60% 50%)`; ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
  }
}
```

---

