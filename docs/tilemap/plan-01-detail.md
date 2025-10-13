# Web TileMap 编辑器五层架构详细实现方案

## 目录

- [架构总览](#架构总览)
- [第一层：数据层（Data Layer）](#第一层数据层data-layer)
- [第二层：逻辑层（Logic Layer - WASM）](#第二层逻辑层logic-layer---wasm)
- [第三层：渲染层（Rendering Layer - WebGPU）](#第三层渲染层rendering-layer---webgpu)
- [第四层：资源层（Resource Layer）](#第四层资源层resource-layer)
- [第五层：UI层（UI Layer - SolidJS）](#第五层ui层ui-layer---solidjs)
- [层间交互详解](#层间交互详解)
- [完整数据流示例](#完整数据流示例)
- [性能优化实现](#性能优化实现)

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
                 │ Texture Data
┌────────────────▼────────────────────────────────────────────┐
│  Rendering Layer (WebGPU)                                   │
│  - GPU Pipeline 管理                                        │
│  - Buffer 更新策略                                          │
│  - 实例化渲染                                                │
└────────────────┬────────────────────────────────────────────┘
                 │ Read TileMap Data
┌────────────────▼────────────────────────────────────────────┐
│  Logic Layer (WASM)                                         │
│  - ECS 世界管理                                             │
│  - 编辑命令处理                                              │
│  - 历史栈管理                                                │
└────────────────┬────────────────────────────────────────────┘
                 │ Direct Memory Access
┌────────────────▼────────────────────────────────────────────┐
│  Data Layer (TypedArrays in Linear Memory)                  │
│  - Uint32Array: Tile IDs                                   │
│  - Float32Array: Instance Buffers                          │
│  - Uint8Array: Metadata                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 第一层：数据层（Data Layer）

### 设计目标

1. **内存连续性**：所有数据使用线性内存，便于 WASM 和 GPU 访问
2. **零拷贝传输**：数据可直接映射到 GPU Buffer
3. **缓存友好**：结构体对齐，利用 CPU 缓存行
4. **快速序列化**：可直接导出为二进制

### 核心数据结构

#### 1. TileMap 主结构（SoA - Structure of Arrays）

```typescript
// 为什么用 SoA？
// - GPU 友好：连续访问同类型数据
// - 缓存友好：减少 cache miss
// - 便于并行：每个数组可独立处理

interface TileMapData {
  // === 元信息（Header）===
  width: u32;           // offset: 0
  height: u32;          // offset: 4
  tileSize: u32;        // offset: 8
  layerCount: u32;      // offset: 12
  
  // === 图层指针数组 ===
  // 每个图层在内存中的起始偏移
  layerOffsets: Uint32Array;  // length = layerCount
  
  // === 图层元数据数组 ===
  layerMetadata: LayerMeta[]; // length = layerCount
}

interface LayerMeta {
  namePtr: u32;         // 指向 UTF-8 字符串的指针
  nameLen: u32;         // 字符串长度
  zIndex: i16;          // Z 排序（-32768 ~ 32767）
  flags: u8;            // bit0: visible, bit1: locked, bit2: static
  opacity: u8;          // 0-255
  tileDataOffset: u32;  // 在共享内存中的偏移
  tileDataSize: u32;    // 字节大小 = width * height * 4
}
```

#### 2. 内存布局设计

```
Linear Memory Layout (WebAssembly.Memory):

[0x0000_0000] Header (16 bytes)
  ├─ width: 4 bytes
  ├─ height: 4 bytes
  ├─ tileSize: 4 bytes
  └─ layerCount: 4 bytes

[0x0000_0010] Layer Offset Table (layerCount * 4 bytes)
  ├─ layer[0] offset
  ├─ layer[1] offset
  └─ ...

[0x0000_????] Layer Metadata Array (layerCount * 24 bytes)
  ├─ LayerMeta[0]
  ├─ LayerMeta[1]
  └─ ...

[0x0001_0000] String Pool (dynamic)
  ├─ "ground\0"
  ├─ "decoration\0"
  └─ ...

[0x0010_0000] Layer 0 Tile Data (width * height * 4 bytes)
  └─ Uint32Array: [tileID, tileID, ...]

[0x0020_0000] Layer 1 Tile Data
  └─ ...

[0x1000_0000] Temporary Buffers (for operations)
  ├─ Undo/Redo snapshots
  ├─ Selection mask
  └─ Dirty region tracking
```

#### 3. 实例缓冲数据（GPU Upload）

```typescript
// 每个可见瓦片对应一个实例
// 使用紧凑布局，16 字节对齐
struct TileInstance {
  // 16 bytes per instance
  worldX: f32;          // 0-3
  worldY: f32;          // 4-7
  tileIndex: u32;       // 8-11 (TileSet 中的索引)
  layerData: u32;       // 12-15 (打包数据)
}

// layerData 位字段分解：
// [31-24]: opacity (0-255)
// [23-16]: flags (visible, flip_x, flip_y, etc)
// [15-0]:  layerIndex
```

### API 设计

```typescript
// data-layer.ts
export class TileMapDataManager {
  private memory: WebAssembly.Memory;
  private basePtr: number;
  
  constructor(width: number, height: number, initialLayers: number = 1) {
    // 计算所需内存
    const headerSize = 16;
    const layerTableSize = initialLayers * 4;
    const layerMetaSize = initialLayers * 24;
    const tileDataSize = width * height * 4 * initialLayers;
    const totalPages = Math.ceil((headerSize + layerTableSize + layerMetaSize + tileDataSize) / 65536);
    
    this.memory = new WebAssembly.Memory({ initial: totalPages, maximum: 1024 });
    this.basePtr = 0;
    
    this.writeHeader(width, height, 32, initialLayers);
  }
  
  // 获取图层的瓦片数据（零拷贝）
  getLayerTiles(layerIndex: number): Uint32Array {
    const offset = this.getLayerOffset(layerIndex);
    const size = this.width * this.height;
    return new Uint32Array(this.memory.buffer, offset, size);
  }
  
  // 批量更新（脏区域追踪）
  markDirty(layerIndex: number, minX: number, minY: number, maxX: number, maxY: number): void {
    // 记录需要更新的矩形区域
    const region: DirtyRegion = { layerIndex, minX, minY, maxX, maxY };
    this.dirtyRegions.push(region);
  }
  
  // 获取所有脏区域（用于 GPU 更新）
  flushDirtyRegions(): DirtyRegion[] {
    const regions = [...this.dirtyRegions];
    this.dirtyRegions = [];
    return regions;
  }
  
  // 序列化到 ArrayBuffer
  serialize(): ArrayBuffer {
    const size = this.calculateSize();
    return this.memory.buffer.slice(0, size);
  }
  
  // 从 ArrayBuffer 反序列化
  static deserialize(buffer: ArrayBuffer): TileMapDataManager {
    const view = new DataView(buffer);
    const width = view.getUint32(0, true);
    const height = view.getUint32(4, true);
    const layerCount = view.getUint32(12, true);
    
    const manager = new TileMapDataManager(width, height, layerCount);
    new Uint8Array(manager.memory.buffer).set(new Uint8Array(buffer));
    return manager;
  }
}
```

---

## 第二层：逻辑层（Logic Layer - WASM）

### 设计目标

1. **高性能编辑操作**：笔刷、填充等密集计算
2. **命令系统**：支持 Undo/Redo
3. **空间查询**：碰撞检测、邻接分析
4. **内存安全**：类型检查、边界检查

### AssemblyScript 实现

#### 1. 世界管理器

```typescript
// assembly/tilemap.ts
export class TileMapWorld {
  private dataManager: TileMapDataManager;
  private commandHistory: CommandStack;
  
  constructor(width: u32, height: u32) {
    this.dataManager = new TileMapDataManager(width, height);
    this.commandHistory = new CommandStack(100); // 最多 100 步撤销
  }
  
  // ===== 编辑操作 =====
  
  @inline
  setTile(layerIndex: u32, x: u32, y: u32, tileId: u32): void {
    // 边界检查
    if (x >= this.dataManager.width || y >= this.dataManager.height) return;
    
    const tiles = this.dataManager.getLayerTiles(layerIndex);
    const index = y * this.dataManager.width + x;
    const oldValue = tiles[index];
    
    // 创建命令
    const cmd = new SetTileCommand(layerIndex, index, oldValue, tileId);
    this.commandHistory.execute(cmd);
    
    // 标记脏区域
    this.dataManager.markDirty(layerIndex, x, y, x, y);
  }
  
  // 矩形填充（优化版本）
  fillRect(layerIndex: u32, x0: u32, y0: u32, x1: u32, y1: u32, tileId: u32): void {
    const minX = min(x0, x1);
    const maxX = max(x0, x1);
    const minY = min(y0, y1);
    const maxY = max(y0, y1);
    
    const tiles = this.dataManager.getLayerTiles(layerIndex);
    const width = this.dataManager.width;
    
    // 记录旧数据（用于撤销）
    const oldData = new Uint32Array((maxX - minX + 1) * (maxY - minY + 1));
    let idx = 0;
    
    // 批量操作
    for (let y = minY; y <= maxY; y++) {
      const rowStart = y * width + minX;
      for (let x = minX; x <= maxX; x++) {
        const i = rowStart + (x - minX);
        oldData[idx++] = tiles[i];
        tiles[i] = tileId;
      }
    }
    
    // 创建批量命令
    const cmd = new FillRectCommand(layerIndex, minX, minY, maxX, maxY, oldData, tileId);
    this.commandHistory.execute(cmd);
    
    this.dataManager.markDirty(layerIndex, minX, minY, maxX, maxY);
  }
  
  // 洪水填充（BFS 优化版）
  floodFill(layerIndex: u32, startX: u32, startY: u32, newTileId: u32): void {
    const tiles = this.dataManager.getLayerTiles(layerIndex);
    const width = this.dataManager.width;
    const height = this.dataManager.height;
    const startIndex = startY * width + startX;
    const targetId = tiles[startIndex];
    
    if (targetId === newTileId) return;
    
    // 使用位图标记访问过的节点（内存效率）
    const visited = new Uint8Array(width * height >> 3); // 除以 8
    const queue = new Queue<u32>(1024);
    
    queue.push(startIndex);
    
    const oldValues = new Map<u32, u32>(); // 用于撤销
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    
    while (!queue.isEmpty()) {
      const index = queue.pop();
      const x = index % width;
      const y = index / width;
      
      // 检查访问位
      const bitIndex = index;
      const byteIndex = bitIndex >> 3;
      const bitOffset = bitIndex & 7;
      if (visited[byteIndex] & (1 << bitOffset)) continue;
      
      // 边界和颜色检查
      if (x >= width || y >= height || tiles[index] !== targetId) continue;
      
      // 标记访问
      visited[byteIndex] |= (1 << bitOffset);
      
      // 记录旧值
      oldValues.set(index, tiles[index]);
      
      // 更新
      tiles[index] = newTileId;
      
      // 更新边界
      minX = min(minX, x); maxX = max(maxX, x);
      minY = min(minY, y); maxY = max(maxY, y);
      
      // 加入邻居（4 方向）
      if (x > 0) queue.push(index - 1);
      if (x < width - 1) queue.push(index + 1);
      if (y > 0) queue.push(index - width);
      if (y < height - 1) queue.push(index + width);
    }
    
    const cmd = new FloodFillCommand(layerIndex, oldValues, newTileId);
    this.commandHistory.execute(cmd);
    
    this.dataManager.markDirty(layerIndex, minX, minY, maxX, maxY);
  }
  
  // ===== 空间查询 =====
  
  // 获取邻居（8 方向）
  getNeighbors(layerIndex: u32, x: u32, y: u32): StaticArray<u32> {
    const neighbors = new StaticArray<u32>(8);
    const tiles = this.dataManager.getLayerTiles(layerIndex);
    const width = this.dataManager.width;
    const height = this.dataManager.height;
    
    let idx = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < width && ny < height) {
          neighbors[idx] = tiles[ny * width + nx];
        } else {
          neighbors[idx] = 0; // 边界外视为空
        }
        idx++;
      }
    }
    return neighbors;
  }
  
  // 碰撞检测（矩形 vs 瓦片层）
  checkCollision(layerIndex: u32, rectX: f32, rectY: f32, rectW: f32, rectH: f32): bool {
    const tileSize = f32(this.dataManager.tileSize);
    const minTileX = u32(rectX / tileSize);
    const minTileY = u32(rectY / tileSize);
    const maxTileX = u32((rectX + rectW) / tileSize);
    const maxTileY = u32((rectY + rectH) / tileSize);
    
    const tiles = this.dataManager.getLayerTiles(layerIndex);
    const width = this.dataManager.width;
    
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        if (tx < width && ty < this.dataManager.height) {
          const tileId = tiles[ty * width + tx];
          if (tileId !== 0) return true; // 假设非 0 就有碰撞
        }
      }
    }
    return false;
  }
}
```

#### 2. 命令系统

```typescript
// assembly/commands.ts
export abstract class Command {
  abstract execute(): void;
  abstract undo(): void;
}

export class SetTileCommand extends Command {
  constructor(
    public layerIndex: u32,
    public index: u32,
    public oldValue: u32,
    public newValue: u32
  ) { super(); }
  
  execute(): void {
    const tiles = getTileMapData().getLayerTiles(this.layerIndex);
    tiles[this.index] = this.newValue;
  }
  
  undo(): void {
    const tiles = getTileMapData().getLayerTiles(this.layerIndex);
    tiles[this.index] = this.oldValue;
  }
}

export class CommandStack {
  private undoStack: Array<Command>;
  private redoStack: Array<Command>;
  private maxSize: u32;
  
  constructor(maxSize: u32) {
    this.undoStack = new Array<Command>();
    this.redoStack = new Array<Command>();
    this.maxSize = maxSize;
  }
  
  execute(cmd: Command): void {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = new Array<Command>(); // 清空重做栈
    
    // 限制栈大小
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }
  
  undo(): bool {
    if (this.undoStack.length === 0) return false;
    const cmd = this.undoStack.pop();
    cmd.undo();
    this.redoStack.push(cmd);
    return true;
  }
  
  redo(): bool {
    if (this.redoStack.length === 0) return false;
    const cmd = this.redoStack.pop();
    cmd.execute();
    this.undoStack.push(cmd);
    return true;
  }
}
```

### WASM 导出接口

```typescript
// assembly/index.ts
let world: TileMapWorld | null = null;

// 初始化
export function initWorld(width: u32, height: u32): void {
  world = new TileMapWorld(width, height);
}

// 编辑操作
export function setTile(layerIndex: u32, x: u32, y: u32, tileId: u32): void {
  world!.setTile(layerIndex, x, y, tileId);
}

export function fillRect(layerIndex: u32, x0: u32, y0: u32, x1: u32, y1: u32, tileId: u32): void {
  world!.fillRect(layerIndex, x0, y0, x1, y1, tileId);
}

export function floodFill(layerIndex: u32, x: u32, y: u32, tileId: u32): void {
  world!.floodFill(layerIndex, x, y, tileId);
}

// 撤销/重做
export function undo(): bool {
  return world!.commandHistory.undo();
}

export function redo(): bool {
  return world!.commandHistory.redo();
}

// 获取数据指针（供 GPU 读取）
export function getLayerDataPtr(layerIndex: u32): u32 {
  return world!.dataManager.getLayerOffset(layerIndex);
}

export function getLayerDataSize(layerIndex: u32): u32 {
  return world!.dataManager.width * world!.dataManager.height * 4;
}

// 获取脏区域（优化 GPU 更新）
export function getDirtyRegionCount(): u32 {
  return world!.dataManager.dirtyRegions.length;
}

export function getDirtyRegion(index: u32): u64 {
  // 打包返回：[layerIndex:16][minX:12][minY:12][maxX:12][maxY:12]
  const region = world!.dataManager.dirtyRegions[index];
  return (u64(region.layerIndex) << 48) |
         (u64(region.minX) << 36) |
         (u64(region.minY) << 24) |
         (u64(region.maxX) << 12) |
         u64(region.maxY);
}

export function clearDirtyRegions(): void {
  world!.dataManager.dirtyRegions = [];
}
```

---

## 第三层：渲染层（Rendering Layer - WebGPU）

### 设计目标

1. **批量渲染**：Instancing 技术一次绘制数千瓦片
2. **视口裁剪**：只渲染可见区域
3. **差分更新**：仅更新修改的 Buffer 区域
4. **多层混合**：支持透明度、混合模式

### Pipeline 架构

```typescript
// src/render/webgpu-tilemap-renderer.ts
export class WebGPUTileMapRenderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private pipeline: GPURenderPipeline;
  
  // Buffers
  private vertexBuffer: GPUBuffer;        // 共享的四边形网格
  private instanceBuffers: Map<number, GPUBuffer>; // 每层一个实例 buffer
  private uniformBuffer: GPUBuffer;       // 相机矩阵
  
  // Textures
  private tileAtlas: GPUTexture;
  private sampler: GPUSampler;
  
  // Bind Groups
  private bindGroup: GPUBindGroup;
  
  constructor(canvas: HTMLCanvasElement) {
    this.initWebGPU(canvas);
    this.createPipeline();
    this.createBuffers();
  }
  
  private async initWebGPU(canvas: HTMLCanvasElement): Promise<void> {
    const adapter = await navigator.gpu.requestAdapter();
    this.device = await adapter!.requestDevice();
    
    this.context = canvas.getContext('webgpu')!;
    this.context.configure({
      device: this.device,
      format: 'bgra8unorm',
      alphaMode: 'premultiplied',
    });
  }
  
  private createPipeline(): void {
    const shaderModule = this.device.createShaderModule({
      code: TILEMAP_SHADER
    });
    
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          // Vertex buffer (共享四边形)
          {
            arrayStride: 16, // vec2 pos + vec2 uv
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
              { shaderLocation: 1, offset: 8, format: 'float32x2' }, // uv
            ],
          },
          // Instance buffer (每个瓦片的数据)
          {
            arrayStride: 16, // 4 * float32
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 2, offset: 0, format: 'float32x2' }, // worldPos
              { shaderLocation: 3, offset: 8, format: 'uint32' },    // tileIndex
              { shaderLocation: 4, offset: 12, format: 'uint32' },   // layerData
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: 'bgra8unorm',
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
    });
  }
  
  private createBuffers(): void {
    // 创建共享的四边形网格
    const quadVertices = new Float32Array([
      // pos(x,y), uv(x,y)
      0, 0,  0, 0,
      1, 0,  1, 0,
      1, 1,  1, 1,
      
      0, 0,  0, 0,
      1, 1,  1, 1,
      0, 1,  0, 1,
    ]);
    
    this.vertexBuffer = this.device.createBuffer({
      size: quadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(quadVertices);
    this.vertexBuffer.unmap();
    
    // Uniform buffer (相机矩阵)
    this.uniformBuffer = this.device.createBuffer({
      size: 64, // mat4x4
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
  
  // 从 WASM 内存更新实例缓冲
  updateLayerInstances(
    layerIndex: number,
    wasmMemory: WebAssembly.Memory,
    dataOffset: number,
    width: number,
    height: number,
    tileSize: number,
    camera: Camera
  ): void {
    // 视口裁剪计算
    const minTileX = Math.max(0, Math.floor(camera.left / tileSize));
    const maxTileX = Math.min(width - 1, Math.ceil(camera.right / tileSize));
    const minTileY = Math.max(0, Math.floor(camera.top / tileSize));
    const maxTileY = Math.min(height - 1, Math.ceil(camera.bottom / tileSize));
    
    // 读取 WASM 中的瓦片数据
    const tiles = new Uint32Array(
      wasmMemory.buffer,
      dataOffset,
      width * height
    );
    
    // 收集可见瓦片
    const instances: number[] = [];
    for (let y = minTileY; y <= maxTileY; y++) {
      for (let x = minTileX; x <= maxTileX; x++) {
        const tileId = tiles[y * width + x];
        if (tileId === 0) continue; // 跳过空瓦片
        
        // [worldX, worldY, tileIndex, layerData]
        instances.push(
          x * tileSize,
          y * tileSize,
          tileId,
          (255 << 24) | layerIndex // opacity | layerIndex
        );
      }
    }
    
    if (instances.length === 0) return;
    
    const instanceData = new Float32Array(instances);
    
    // 获取或创建 instance buffer
    let buffer = this.instanceBuffers.get(layerIndex);
    if (!buffer || buffer.size < instanceData.byteLength) {
      // 需要创建更大的 buffer
      if (buffer) buffer.destroy();
      
      buffer = this.device.createBuffer({
        size: Math.max(instanceData.byteLength, 65536), // 至少 64KB
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this.instanceBuffers.set(layerIndex, buffer);
    }
    
    // 写入数据
    this.device.queue.writeBuffer(buffer, 0, instanceData);
  }
  
  // 差分更新（仅更新脏区域）
  updateDirtyRegion(
    layerIndex: number,
    wasmMemory: WebAssembly.Memory,
    dataOffset: number,
    width: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    tileSize: number
  ): void {
    const tiles = new Uint32Array(wasmMemory.buffer, dataOffset, width * (maxY - minY + 1));
    
    // 重建该区域的实例
    const instances: number[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tileId = tiles[(y - minY) * width + x];
        if (tileId === 0) continue;
        
        instances.push(
          x * tileSize,
          y * tileSize,
          tileId,
          (255 << 24) | layerIndex
        );
      }
    }
    
    // 计算在 instance buffer 中的偏移
    // 这需要维护一个 mapping table，暂略
    // 实际实现中可能需要重新构建整个 layer buffer
  }
  
  // 渲染一帧
  render(camera: Camera, layers: LayerRenderInfo[]): void {
    // 更新相机 uniform
    const viewProjMatrix = camera.getViewProjectionMatrix();
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      viewProjMatrix.buffer
    );
    
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    
    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setBindGroup(0, this.bindGroup);
    
    // 按 Z 顺序渲染各层
    for (const layer of layers) {
      if (!layer.visible) continue;
      
      const instanceBuffer = this.instanceBuffers.get(layer.index);
      if (!instanceBuffer) continue;
      
      renderPass.setVertexBuffer(1, instanceBuffer);
      renderPass.draw(6, layer.instanceCount, 0, 0);
    }
    
    renderPass.end();
    
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
```

### Shader 实现

```wgsl
// tilemap.wgsl
struct Uniforms {
  viewProj: mat4x4<f32>,
  atlasSize: vec2<f32>,
  tileSize: vec2<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var tileAtlas: texture_2d<f32>;
@group(0) @binding(2) var atlasSampler: sampler;

struct VertexInput {
  @location(0) position: vec2<f32>,  // 四边形顶点 (0-1)
  @location(1) uv: vec2<f32>,        // 基础 UV (0-1)
}

struct InstanceInput {
  @location(2) worldPos: vec2<f32>,  // 世界坐标
  @location(3) tileIndex: u32,       // TileSet 索引
  @location(4) layerData: u32,       // 打包数据
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) opacity: f32,
}

@vertex
fn vs_main(vertex: VertexInput, instance: InstanceInput) -> VertexOutput {
  var out: VertexOutput;
  
  // 计算世界空间位置
  let worldPos = instance.worldPos + vertex.position * uniforms.tileSize;
  
  // 应用相机变换
  out.position = uniforms.viewProj * vec4<f32>(worldPos, 0.0, 1.0);
  
  // 计算 atlas UV
  let atlasColumns = u32(uniforms.atlasSize.x / uniforms.tileSize.x);
  let col = instance.tileIndex % atlasColumns;
  let row = instance.tileIndex / atlasColumns;
  
  let atlasTileSize = uniforms.tileSize / uniforms.atlasSize;
  let atlasUV = vec2<f32>(f32(col), f32(row)) * atlasTileSize;
  out.uv = atlasUV + vertex.uv * atlasTileSize;
  
  // 解包 opacity
  out.opacity = f32((instance.layerData >> 24) & 0xFF) / 255.0;
  
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  var color = textureSample(tileAtlas, atlasSampler, in.uv);
  color.a *= in.opacity;
  return color;
}
```

---

## 第四层：资源层（Resource Layer）

### 设计目标

1. **异步加载**：不阻塞主线程
2. **缓存管理**：LRU 策略释放内存
3. **图集生成**：自动裁切 TileSet
4. **预加载**：预测性加载相邻资源

### 实现

```typescript
// src/resource/resource-manager.ts
export class ResourceManager {
  private textureCache: Map<string, GPUTexture> = new Map();
  private tileSetCache: Map<string, TileSetData> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private lruQueue: string[] = [];
  private maxCacheSize: number = 100 * 1024 * 1024; // 100MB
  private currentCacheSize: number = 0;
  
  constructor(private device: GPUDevice) {}
  
  // 加载 TileSet（带缓存）
  async loadTileSet(url: string, tileWidth: number, tileHeight: number): Promise<TileSetData> {
    // 检查缓存
    if (this.tileSetCache.has(url)) {
      this.updateLRU(url);
      return this.tileSetCache.get(url)!;
    }
    
    // 检查是否正在加载
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }
    
    // 开始加载
    const promise = this._loadTileSet(url, tileWidth, tileHeight);
    this.loadingPromises.set(url, promise);
    
    const data = await promise;
    this.loadingPromises.delete(url);
    
    // 存入缓存
    this.tileSetCache.set(url, data);
    this.updateLRU(url);
    this.currentCacheSize += data.size;
    
    // 检查缓存大小
    this.evictIfNeeded();
    
    return data;
  }
  
  private async _loadTileSet(url: string, tileWidth: number, tileHeight: number): Promise<TileSetData> {
    // 加载图片
    const img = await this.loadImage(url);
    
    // 计算行列数
    const columns = Math.floor(img.width / tileWidth);
    const rows = Math.floor(img.height / tileHeight);
    
    // 创建 GPU 纹理
    const texture = this.createTextureFromImage(img);
    
    return {
      url,
      texture,
      width: img.width,
      height: img.height,
      tileWidth,
      tileHeight,
      columns,
      rows,
      size: img.width * img.height * 4, // RGBA
    };
  }
  
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }
  
  private createTextureFromImage(img: HTMLImageElement): GPUTexture {
    const texture = this.device.createTexture({
      size: [img.width, img.height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    // 创建临时 canvas 用于上传
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    
    this.device.queue.writeTexture(
      { texture },
      imageData.data,
      { bytesPerRow: img.width * 4 },
      [img.width, img.height, 1]
    );
    
    return texture;
  }
  
  // LRU 缓存管理
  private updateLRU(url: string): void {
    const index = this.lruQueue.indexOf(url);
    if (index !== -1) {
      this.lruQueue.splice(index, 1);
    }
    this.lruQueue.push(url);
  }
  
  private evictIfNeeded(): void {
    while (this.currentCacheSize > this.maxCacheSize && this.lruQueue.length > 0) {
      const evictUrl = this.lruQueue.shift()!;
      const data = this.tileSetCache.get(evictUrl);
      
      if (data) {
        data.texture.destroy();
        this.tileSetCache.delete(evictUrl);
        this.currentCacheSize -= data.size;
      }
    }
  }
  
  // 预加载（后台加载）
  preload(urls: string[], priority: 'high' | 'low' = 'low'): void {
    const loadPromises = urls.map(url => 
      this.loadTileSet(url, 32, 32).catch(() => {}) // 忽略错误
    );
    
    if (priority === 'high') {
      Promise.all(loadPromises); // 等待全部完成
    }
    // low priority 不等待
  }
}

interface TileSetData {
  url: string;
  texture: GPUTexture;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  size: number;
}
```

---

## 第五层：UI层（UI Layer - SolidJS）

### 设计目标

1. **响应式更新**：状态变化自动更新视图
2. **组件化**：工具栏、图层面板、画布分离
3. **事件处理**：鼠标、键盘统一管理
4. **性能优化**：批量更新、防抖

### 状态管理

```typescript
// src/store/tilemap-store.ts
import { createStore } from 'solid-js/store';

export interface TileMapState {
  // 地图数据
  width: number;
  height: number;
  tileSize: number;
  layers: LayerState[];
  currentLayerIndex: number;
  
  // 编辑状态
  selectedTool: 'brush' | 'rect' | 'fill' | 'eraser' | 'select';
  selectedTileId: number;
  isDrawing: boolean;
  
  // 视图状态
  camera: CameraState;
  showGrid: boolean;
  showCollision: boolean;
  
  // 历史状态
  canUndo: boolean;
  canRedo: boolean;
}

export interface LayerState {
  index: number;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export function createTileMapStore() {
  const [state, setState] = createStore<TileMapState>({
    width: 256,
    height: 256,
    tileSize: 32,
    layers: [
      { index: 0, name: 'Ground', visible: true, locked: false, opacity: 1.0, zIndex: 0 },
    ],
    currentLayerIndex: 0,
    selectedTool: 'brush',
    selectedTileId: 1,
    isDrawing: false,
    camera: { x: 0, y: 0, zoom: 1.0 },
    showGrid: true,
    showCollision: false,
    canUndo: false,
    canRedo: false,
  });
  
  return { state, setState };
}
```

### 核心组件

```typescript
// src/components/TileMapEditor.tsx
import { Component, createEffect, onMount } from 'solid-js';
import { useTileMapStore } from '../store';
import { TileMapCanvas } from './TileMapCanvas';
import { Toolbar } from './Toolbar';
import { LayerPanel } from './LayerPanel';
import { TileSetPanel } from './TileSetPanel';

export const TileMapEditor: Component = () => {
  const { state, setState } = useTileMapStore();
  
  // WASM 实例
  let wasmInstance: WebAssembly.Instance | null = null;
  
  onMount(async () => {
    // 加载 WASM
    const response = await fetch('/ollo.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);
    wasmInstance = instance;
    
    // 初始化世界
    (instance.exports.initWorld as Function)(state.width, state.height);
  });
  
  // 工具切换快捷键
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') {
        if (wasmInstance) {
          const success = (wasmInstance.exports.undo as Function)();
          setState({ canUndo: checkCanUndo(), canRedo: checkCanRedo() });
        }
      } else if (e.key === 'y') {
        if (wasmInstance) {
          const success = (wasmInstance.exports.redo as Function)();
          setState({ canUndo: checkCanUndo(), canRedo: checkCanRedo() });
        }
      }
    } else {
      // 工具快捷键
      const toolMap: Record<string, typeof state.selectedTool> = {
        'b': 'brush',
        'r': 'rect',
        'f': 'fill',
        'e': 'eraser',
        's': 'select',
      };
      if (toolMap[e.key]) {
        setState({ selectedTool: toolMap[e.key] });
      }
    }
  };
  
  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });
  
  return (
    <div class="tilemap-editor">
      <Toolbar />
      <div class="editor-content">
        <LayerPanel />
        <TileMapCanvas wasmInstance={wasmInstance} />
        <TileSetPanel />
      </div>
    </div>
  );
};
```

```typescript
// src/components/TileMapCanvas.tsx
import { Component, createEffect, onMount } from 'solid-js';
import { useTileMapStore } from '../store';
import { WebGPUTileMapRenderer } from '../render/webgpu-tilemap-renderer';

interface Props {
  wasmInstance: WebAssembly.Instance | null;
}

export const TileMapCanvas: Component<Props> = (props) => {
  const { state, setState } = useTileMapStore();
  let canvas: HTMLCanvasElement;
  let renderer: WebGPUTileMapRenderer;
  
  let isMouseDown = false;
  let lastTileX = -1;
  let lastTileY = -1;
  
  onMount(async () => {
    renderer = new WebGPUTileMapRenderer(canvas);
    await renderer.init();
    
    // 启动渲染循环
    requestAnimationFrame(renderLoop);
  });
  
  const renderLoop = () => {
    if (props.wasmInstance && renderer) {
      // 更新所有图层的实例数据
      const memory = (props.wasmInstance.exports.memory as WebAssembly.Memory);
      
      for (const layer of state.layers) {
        const dataPtr = (props.wasmInstance.exports.getLayerDataPtr as Function)(layer.index);
        
        renderer.updateLayerInstances(
          layer.index,
          memory,
          dataPtr,
          state.width,
          state.height,
          state.tileSize,
          state.camera
        );
      }
      
      // 渲染
      renderer.render(state.camera, state.layers);
    }
    
    requestAnimationFrame(renderLoop);
  };
  
  // 坐标转换
  const screenToTile = (screenX: number, screenY: number): { x: number, y: number } => {
    const rect = canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    // 应用相机变换
    const worldX = (canvasX / state.camera.zoom) + state.camera.x;
    const worldY = (canvasY / state.camera.zoom) + state.camera.y;
    
    const tileX = Math.floor(worldX / state.tileSize);
    const tileY = Math.floor(worldY / state.tileSize);
    
    return { x: tileX, y: tileY };
  };
  
  // 鼠标事件
  const handleMouseDown = (e: MouseEvent) => {
    const currentLayer = state.layers[state.currentLayerIndex];
    if (currentLayer.locked) return;
    
    isMouseDown = true;
    const { x, y } = screenToTile(e.clientX, e.clientY);
    
    executeTool(x, y, e.shiftKey);
    lastTileX = x;
    lastTileY = y;
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isMouseDown) return;
    
    const { x, y } = screenToTile(e.clientX, e.clientY);
    
    // 避免重复绘制同一个瓦片
    if (x === lastTileX && y === lastTileY) return;
    
    // 如果是笔刷工具，插值填充
    if (state.selectedTool === 'brush') {
      interpolateLine(lastTileX, lastTileY, x, y);
    } else {
      executeTool(x, y, e.shiftKey);
    }
    
    lastTileX = x;
    lastTileY = y;
  };
  
  const handleMouseUp = (e: MouseEvent) => {
    isMouseDown = false;
    
    // 矩形工具在松开鼠标时执行
    if (state.selectedTool === 'rect' && lastTileX !== -1) {
      const { x, y } = screenToTile(e.clientX, e.clientY);
      const wasmFn = props.wasmInstance!.exports.fillRect as Function;
      wasmFn(state.currentLayerIndex, lastTileX, lastTileY, x, y, state.selectedTileId);
    }
    
    lastTileX = -1;
    lastTileY = -1;
  };
  
  // 工具执行
  const executeTool = (x: number, y: number, isEraser: boolean) => {
    if (!props.wasmInstance) return;
    
    const tileId = isEraser ? 0 : state.selectedTileId;
    
    switch (state.selectedTool) {
      case 'brush':
      case 'eraser':
        (props.wasmInstance.exports.setTile as Function)(
          state.currentLayerIndex, x, y, tileId
        );
        break;
      
      case 'fill':
        (props.wasmInstance.exports.floodFill as Function)(
          state.currentLayerIndex, x, y, tileId
        );
        break;
      
      case 'rect':
        // 在 mouseUp 时处理
        break;
    }
  };
  
  // Bresenham 直线插值
  const interpolateLine = (x0: number, y0: number, x1: number, y1: number) => {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    
    let x = x0;
    let y = y0;
    
    while (true) {
      executeTool(x, y, false);
      
      if (x === x1 && y === y1) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  };
  
  // 相机控制
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, state.camera.zoom * zoomFactor));
    
    // 缩放到鼠标位置
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldX = (mouseX / state.camera.zoom) + state.camera.x;
    const worldY = (mouseY / state.camera.zoom) + state.camera.y;
    
    const newCameraX = worldX - (mouseX / newZoom);
    const newCameraY = worldY - (mouseY / newZoom);
    
    setState({
      camera: {
        x: newCameraX,
        y: newCameraY,
        zoom: newZoom,
      },
    });
  };
  
  return (
    <canvas
      ref={canvas!}
      width={1280}
      height={720}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      class="tilemap-canvas"
    />
  );
};
```

---

## 层间交互详解

### 数据流图

```
┌─────────────────────────────────────────────────────────────┐
│  用户点击画布                                                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  UI Layer: TileMapCanvas.handleMouseDown()                  │
│  - 屏幕坐标 → 世界坐标 → 瓦片坐标                            │
│  - 调用: wasmInstance.setTile(layer, x, y, tileId)        │
└────────────────┬────────────────────────────────────────────┘
                 │ WASM Function Call
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Logic Layer (WASM): TileMapWorld.setTile()                │
│  1. 边界检查                                                 │
│  2. 创建 SetTileCommand                                     │
│  3. commandHistory.execute(cmd)                             │
│  4. dataManager.markDirty(layer, x, y, x, y)               │
└────────────────┬────────────────────────────────────────────┘
                 │ Direct Memory Write
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Data Layer: Uint32Array[index] = tileId                   │
│  - 写入 Linear Memory                                       │
│  - 记录脏区域到 dirtyRegions[]                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  下一帧渲染循环                                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  UI Layer: renderLoop()                                     │
│  - 调用: renderer.updateLayerInstances()                    │
└────────────────┬────────────────────────────────────────────┘
                 │ Read WASM Memory
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Rendering Layer: updateLayerInstances()                    │
│  1. 获取 dataPtr = wasmInstance.getLayerDataPtr(layer)      │
│  2. 读取: new Uint32Array(wasmMemory.buffer, dataPtr, size)│
│  3. 视口裁剪：计算可见范围                                   │
│  4. 收集实例数据: [worldX, worldY, tileId, layerData]      │
│  5. 写入 GPU Buffer                                         │
└────────────────┬────────────────────────────────────────────┘
                 │ GPU Command
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Rendering Layer: render()                                  │
│  1. 更新 Uniform Buffer (相机矩阵)                           │
│  2. 创建 Render Pass                                        │
│  3. 按 Z 顺序绘制各层                                        │
│  4. submit() 到 GPU 队列                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  屏幕显示更新                                                │
└─────────────────────────────────────────────────────────────┘
```

### 关键接口调用链

#### 1. 编辑操作

```typescript
// UI → Logic
UI.handleMouseDown(screenX, screenY)
  → 计算: { tileX, tileY }
  → wasmInstance.exports.setTile(layerIndex, tileX, tileY, tileId)
    → Logic.TileMapWorld.setTile()
      → 检查边界
      → 创建 Command
      → Data.tiles[index] = tileId  // 直接内存写入
      → Data.dirtyRegions.push({ layer, x, y, x, y })
```

#### 2. 渲染循环

```typescript
// Rendering → Logic → Data
requestAnimationFrame(renderLoop)
  → wasmInstance.exports.getLayerDataPtr(layerIndex)
    → 返回内存偏移量
  → new Uint32Array(wasmMemory.buffer, dataPtr, width * height)
    → 直接读取 WASM 线性内存
  → Renderer.updateLayerInstances(tileData)
    → 视口裁剪
    → 构建实例数组
    → device.queue.writeBuffer(instanceBuffer, data)
  → Renderer.render()
    → renderPass.draw(instanceCount)
```

#### 3. 资源加载

```typescript
// UI → Resource → Rendering
UI.loadTileSet(url)
  → ResourceManager.loadTileSet(url, tileWidth, tileHeight)
    → fetch image
    → createTextureFromImage(img)
      → device.createTexture()
      → device.queue.writeTexture(texture, imageData)
    → 返回 TileSetData
  → Renderer.setAtlasTexture(texture)
```

---

## 完整数据流示例

### 场景：用户用笔刷绘制一个瓦片

```typescript
// ====== 步骤 1: UI 捕获事件 ======
// TileMapCanvas.tsx
const handleMouseDown = (e: MouseEvent) => {
  const { x: tileX, y: tileY } = screenToTile(e.clientX, e.clientY);
  // tileX = 10, tileY = 5
  
  // 调用 WASM
  const layerIndex = 0;
  const tileId = 42; // 选中的瓦片
  (wasmInstance.exports.setTile as Function)(layerIndex, tileX, tileY, tileId);
};

// ====== 步骤 2: WASM 逻辑处理 ======
// assembly/tilemap.ts
export function setTile(layerIndex: u32, x: u32, y: u32, tileId: u32): void {
  const width = 256;
  const height = 256;
  
  // 边界检查
  if (x >= width || y >= height) return; // 通过
  
  // 获取数据
  const dataOffset = getLayerDataOffset(layerIndex); // 假设 0x00100000
  const tiles = load<Uint32Array>(dataOffset);
  const index = y * width + x; // 5 * 256 + 10 = 1290
  
  const oldValue = tiles[index]; // 假设是 0（空）
  
  // 创建命令
  const cmd = new SetTileCommand(layerIndex, index, oldValue, tileId);
  commandHistory.execute(cmd);
  
  // cmd.execute() 内部:
  // tiles[1290] = 42; ← 直接写入内存
  
  // 标记脏区域
  dirtyRegions.push({ layer: 0, minX: 10, minY: 5, maxX: 10, maxY: 5 });
}

// ====== 步骤 3: 下一帧渲染 ======
// TileMapCanvas.tsx
const renderLoop = () => {
  // 获取内存指针
  const dataPtr = (wasmInstance.exports.getLayerDataPtr as Function)(0);
  // 返回: 0x00100000
  
  const memory = wasmInstance.exports.memory as WebAssembly.Memory;
  const tileData = new Uint32Array(memory.buffer, dataPtr, 256 * 256);
  
  // tileData[1290] 现在是 42 ✓
  
  // 更新渲染
  renderer.updateLayerInstances(0, memory, dataPtr, 256, 256, 32, camera);
};

// ====== 步骤 4: 渲染层处理 ======
// webgpu-tilemap-renderer.ts
updateLayerInstances(...) {
  // 假设相机可见范围是 x: 0-20, y: 0-10
  const minTileX = 0, maxTileX = 20;
  const minTileY = 0, maxTileY = 10;
  
  const tiles = new Uint32Array(wasmMemory.buffer, dataOffset, width * height);
  
  const instances = [];
  for (let y = 0; y <= 10; y++) {
    for (let x = 0; x <= 20; x++) {
      const tileId = tiles[y * 256 + x];
      
      if (x === 10 && y === 5) {
        // 这是我们刚绘制的瓦片
        // tileId = 42 ✓
        instances.push(
          10 * 32,  // worldX = 320
          5 * 32,   // worldY = 160
          42,       // tileIndex
          (255 << 24) | 0 // opacity | layerIndex
        );
      }
    }
  }
  
  const instanceData = new Float32Array(instances);
  device.queue.writeBuffer(instanceBuffer, 0, instanceData);
}

// ====== 步骤 5: GPU 渲染 ======
render(camera, layers) {
  renderPass.setPipeline(pipeline);
  renderPass.setVertexBuffer(0, quadVertexBuffer);
  renderPass.setVertexBuffer(1, instanceBuffer);
  
  // 绘制：基础四边形 × 实例数
  renderPass.draw(6, instanceCount);
  
  // GPU 处理:
  // - 顶点着色器为每个实例计算位置和 UV
  // - 片段着色器从 atlas 采样纹理
  // - 瓦片 42 显示在屏幕坐标 (320, 160)
}
```

---

## 性能优化实现

### 1. 差分更新优化

```typescript
// 问题：每次编辑都更新整个图层的 GPU Buffer（慢）
// 解决：只更新修改的区域

// assembly/tilemap.ts
class DirtyRegionTracker {
  regions: DirtyRegion[] = [];
  
  markDirty(layer: u32, minX: u32, minY: u32, maxX: u32, maxY: u32): void {
    // 合并相邻的脏区域
    for (let i = 0; i < this.regions.length; i++) {
      const r = this.regions[i];
      if (r.layer === layer && this.overlaps(r, minX, minY, maxX, maxY)) {
        r.minX = min(r.minX, minX);
        r.minY = min(r.minY, minY);
        r.maxX = max(r.maxX, maxX);
        r.maxY = max(r.maxY, maxY);
        return;
      }
    }
    
    // 新区域
    this.regions.push({ layer, minX, minY, maxX, maxY });
  }
  
  private overlaps(r: DirtyRegion, minX: u32, minY: u32, maxX: u32, maxY: u32): bool {
    // 膨胀 1 个瓦片，避免碎片化
    return !(r.maxX + 1 < minX || r.minX > maxX + 1 ||
             r.maxY + 1 < minY || r.minY > maxY + 1);
  }
}

// 渲染器只更新脏区域
updateDirtyRegions() {
  const count = (wasmInstance.exports.getDirtyRegionCount as Function)();
  
  for (let i = 0; i < count; i++) {
    const packed = (wasmInstance.exports.getDirtyRegion as Function)(i);
    const layer = Number((packed >> 48n) & 0xFFFFn);
    const minX = Number((packed >> 36n) & 0xFFFn);
    // ... 解包其他字段
    
    // 仅重建该区域的实例
    this.updateRegion(layer, minX, minY, maxX, maxY);
  }
  
  (wasmInstance.exports.clearDirtyRegions as Function)();
}
```

### 2. 分块渲染（Chunking）

```typescript
// 超大地图（1024×1024）分割为 16×16 的块
const CHUNK_SIZE = 16;

class ChunkedTileMap {
  private chunks: Map<string, Chunk> = new Map();
  
  getChunk(chunkX: number, chunkY: number): Chunk {
    const key = `${chunkX},${chunkY}`;
    if (!this.chunks.has(key)) {
      this.chunks.set(key, this.loadChunk(chunkX, chunkY));
    }
    return this.chunks.get(key)!;
  }
  
  // 只加载可见块
  updateVisibleChunks(camera: Camera) {
    const minChunkX = Math.floor(camera.left / (CHUNK_SIZE * tileSize));
    const maxChunkX = Math.ceil(camera.right / (CHUNK_SIZE * tileSize));
    const minChunkY = Math.floor(camera.top / (CHUNK_SIZE * tileSize));
    const maxChunkY = Math.ceil(camera.bottom / (CHUNK_SIZE * tileSize));
    
    for (let cy = minChunkY; cy <= maxChunkY; cy++) {
      for (let cx = minChunkX; cx <= maxChunkX; cx++) {
        const chunk = this.getChunk(cx, cy);
        if (!chunk.gpuBuffer) {
          this.uploadChunkToGPU(chunk);
        }
      }
    }
    
    // 卸载远离的块
    this.unloadDistantChunks(camera);
  }
}
```

### 3. 实例缓存池

```typescript
// 问题：频繁创建/销毁 GPU Buffer 导致内存碎片
// 解决：缓存池复用

class BufferPool {
  private freeBuffers: GPUBuffer[] = [];
  private usedBuffers: Set<GPUBuffer> = new Set();
  
  acquire(size: number): GPUBuffer {
    // 找到足够大的 buffer
    const index = this.freeBuffers.findIndex(b => b.size >= size);
    
    if (index !== -1) {
      const buffer = this.freeBuffers.splice(index, 1)[0];
      this.usedBuffers.add(buffer);
      return buffer;
    }
    
    // 创建新 buffer（2 的幂次大小，减少碎片）
    const bufferSize = Math.pow(2, Math.ceil(Math.log2(size)));
    const buffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    
    this.usedBuffers.add(buffer);
    return buffer;
  }
  
  release(buffer: GPUBuffer): void {
    this.usedBuffers.delete(buffer);
    this.freeBuffers.push(buffer);
  }
}
```

### 4. 绘制批次优化

```typescript
// 问题：每层一次 draw call，100 层 = 100 次调用（慢）
// 解决：合并静态层，减少 draw call

class LayerBatcher {
  private staticLayerTexture: GPUTexture | null = null;
  private dynamicLayers: number[] = [];
  
  bakeStaticLayers(layers: LayerState[]): void {
    const staticLayers = layers.filter(l => l.static);
    
    // 创建离屏渲染目标
    const renderTarget = this.device.createTexture({
      size: [mapWidth * tileSize, mapHeight * tileSize],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    
    // 渲染所有静态层到一张纹理
    const encoder = this.device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: renderTarget.createView(),
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    
    for (const layer of staticLayers) {
      this.renderLayer(renderPass, layer);
    }
    
    renderPass.end();
    this.device.queue.submit([encoder.finish()]);
    
    this.staticLayerTexture = renderTarget;
  }
  
  render() {
    // 1 次调用绘制所有静态层（作为背景纹理）
    this.renderStaticTexture();
    
    // N 次调用绘制动态层
    for (const layerIndex of this.dynamicLayers) {
      this.renderLayer(layerIndex);
    }
  }
}
```

---

## 总结

这份详细方案提供了：

1. **完整的数据结构设计**：从内存布局到 GPU Buffer
2. **明确的 API 接口**：每层的输入输出定义
3. **精确的调用关系**：数据如何在层间流动
4. **可执行的代码示例**：真实的 TypeScript/AssemblyScript/WGSL 代码
5. **性能优化策略**：差分更新、分块、缓存池、批次合并

每一层都有：
- 明确的职责边界
- 清晰的接口定义
- 具体的实现细节
- 性能优化考量

这是一份真正可以指导实现的技术文档。

