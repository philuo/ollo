# WebGPU 高效实现 TileMap 技术指南

## 概述

本文档详细介绍如何使用 WebGPU 构建高性能的 2D Tilemap 渲染系统，结合 Godot 的设计理念和 WebGPU 的现代特性。

## 1. 架构设计

### 1.1 整体架构

```typescript
interface TileMapArchitecture {
    // 数据层
    tileMapData: TileMapData;          // 瓦片数据（稀疏存储）
    tileSetManager: TileSetManager;     // 瓦片集管理
    
    // 渲染层
    renderer: TileMapRenderer;          // WebGPU 渲染器
    camera: Camera2D;                   // 相机系统
    
    // 优化层
    chunkManager: ChunkManager;         // 分块管理
    cullingSystem: CullingSystem;       // 剔除系统
    
    // GPU 资源
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    buffers: GPUBuffers;
}
```

### 1.2 数据结构设计

```typescript
// 瓦片数据（CPU 端）
class TileMapData {
    private layers: Map<number, TileLayer> = new Map();
    private chunkSize: number = 32; // 32x32 瓦片一个块
    
    getTile(layer: number, x: number, y: number): Tile | null {
        const tileLayer = this.layers.get(layer);
        if (!tileLayer) return null;
        
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkY = Math.floor(y / this.chunkSize);
        const chunk = tileLayer.getChunk(chunkX, chunkY);
        
        if (!chunk) return null;
        
        const localX = x % this.chunkSize;
        const localY = y % this.chunkSize;
        return chunk.getTile(localX, localY);
    }
    
    setTile(layer: number, x: number, y: number, tile: Tile): void {
        let tileLayer = this.layers.get(layer);
        if (!tileLayer) {
            tileLayer = new TileLayer(layer);
            this.layers.set(layer, tileLayer);
        }
        
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkY = Math.floor(y / this.chunkSize);
        let chunk = tileLayer.getChunk(chunkX, chunkY);
        
        if (!chunk) {
            chunk = new TileChunk(chunkX, chunkY, this.chunkSize);
            tileLayer.setChunk(chunkX, chunkY, chunk);
        }
        
        const localX = x % this.chunkSize;
        const localY = y % this.chunkSize;
        chunk.setTile(localX, localY, tile);
        chunk.markDirty();
    }
}

// 瓦片层
class TileLayer {
    public layerIndex: number;
    public zIndex: number = 0;
    public visible: boolean = true;
    public modulate: Color = { r: 1, g: 1, b: 1, a: 1 };
    private chunks: Map<string, TileChunk> = new Map();
    
    constructor(layerIndex: number) {
        this.layerIndex = layerIndex;
    }
    
    getChunk(x: number, y: number): TileChunk | null {
        return this.chunks.get(`${x},${y}`) || null;
    }
    
    setChunk(x: number, y: number, chunk: TileChunk): void {
        this.chunks.set(`${x},${y}`, chunk);
    }
    
    getAllChunks(): TileChunk[] {
        return Array.from(this.chunks.values());
    }
}

// 瓦片块
class TileChunk {
    public chunkX: number;
    public chunkY: number;
    public size: number;
    private tiles: (Tile | null)[];
    private dirty: boolean = true;
    private gpuBuffer: GPUBuffer | null = null;
    
    constructor(chunkX: number, chunkY: number, size: number) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.size = size;
        this.tiles = new Array(size * size).fill(null);
    }
    
    getTile(x: number, y: number): Tile | null {
        return this.tiles[y * this.size + x];
    }
    
    setTile(x: number, y: number, tile: Tile): void {
        this.tiles[y * this.size + x] = tile;
        this.dirty = true;
    }
    
    markDirty(): void {
        this.dirty = true;
    }
    
    isDirty(): boolean {
        return this.dirty;
    }
    
    clearDirty(): void {
        this.dirty = false;
    }
    
    getBounds(): Rect {
        return {
            x: this.chunkX * this.size,
            y: this.chunkY * this.size,
            width: this.size,
            height: this.size
        };
    }
}

// 瓦片定义
interface Tile {
    tilesetId: number;      // 瓦片集 ID
    tileId: number;         // 瓦片 ID
    flipX: boolean;         // 水平翻转
    flipY: boolean;         // 垂直翻转
    rotate: number;         // 旋转（0, 90, 180, 270）
}
```

## 2. WebGPU 渲染实现

### 2.1 渲染管线设置

```typescript
class TileMapRenderer {
    private device: GPUDevice;
    private context: GPUCanvasContext;
    private pipeline: GPURenderPipeline;
    private bindGroupLayout: GPUBindGroupLayout;
    
    async initialize(device: GPUDevice, canvas: HTMLCanvasElement): Promise<void> {
        this.device = device;
        this.context = canvas.getContext('webgpu')!;
        
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: presentationFormat,
            alphaMode: 'premultiplied'
        });
        
        await this.createPipeline(presentationFormat);
    }
    
    private async createPipeline(format: GPUTextureFormat): Promise<void> {
        // 创建着色器模块
        const shaderModule = this.device.createShaderModule({
            label: 'TileMap Shader',
            code: this.getShaderCode()
        });
        
        // 创建 BindGroup 布局
        this.bindGroupLayout = this.device.createBindGroupLayout({
            label: 'TileMap BindGroup Layout',
            entries: [
                {
                    // Camera uniform
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                },
                {
                    // Tileset texture
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' }
                },
                {
                    // Sampler
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                },
                {
                    // Tile instance data
                    binding: 3,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' }
                }
            ]
        });
        
        // 创建管线布局
        const pipelineLayout = this.device.createPipelineLayout({
            label: 'TileMap Pipeline Layout',
            bindGroupLayouts: [this.bindGroupLayout]
        });
        
        // 创建渲染管线
        this.pipeline = this.device.createRenderPipeline({
            label: 'TileMap Pipeline',
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        }
                    }
                }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none'
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less-equal'
            }
        });
    }
    
    private getShaderCode(): string {
        return `
            // 定义在下一节
        `;
    }
}
```

### 2.2 Shader 实现

```wgsl
// ============ Vertex Shader ============

struct CameraUniform {
    viewProjection: mat4x4<f32>,
    position: vec2<f32>,
    zoom: f32,
    _padding: f32,
}

struct TileInstance {
    position: vec2<f32>,        // 世界坐标
    tileUV: vec4<f32>,          // UV 坐标 (x, y, width, height)
    tileSize: vec2<f32>,        // 瓦片大小
    flags: u32,                 // 翻转和旋转标志
    colorModulate: u32,         // RGBA8 压缩颜色
}

struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
}

@group(0) @binding(0) var<uniform> camera: CameraUniform;
@group(0) @binding(3) var<storage, read> instances: array<TileInstance>;

// Quad vertices: (0,0), (1,0), (1,1), (0,1) as two triangles
const QUAD_VERTICES = array<vec2<f32>, 6>(
    vec2(0.0, 0.0),
    vec2(1.0, 0.0),
    vec2(1.0, 1.0),
    vec2(0.0, 0.0),
    vec2(1.0, 1.0),
    vec2(0.0, 1.0)
);

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    let instance = instances[input.instanceIndex];
    let vertex = QUAD_VERTICES[input.vertexIndex];
    
    // 解析标志位
    let flipX = bool(instance.flags & 1u);
    let flipY = bool(instance.flags & 2u);
    let rotate = (instance.flags >> 2u) & 3u; // 0, 1, 2, 3 = 0°, 90°, 180°, 270°
    
    // 应用翻转
    var localVertex = vertex;
    if (flipX) {
        localVertex.x = 1.0 - localVertex.x;
    }
    if (flipY) {
        localVertex.y = 1.0 - localVertex.y;
    }
    
    // 应用旋转
    localVertex = rotateVertex(localVertex, rotate);
    
    // 计算世界坐标
    let worldPos = instance.position + localVertex * instance.tileSize;
    
    // 计算 UV 坐标
    var uv = instance.tileUV.xy + vertex * instance.tileUV.zw;
    
    // 解压颜色
    let r = f32((instance.colorModulate >> 24u) & 0xFFu) / 255.0;
    let g = f32((instance.colorModulate >> 16u) & 0xFFu) / 255.0;
    let b = f32((instance.colorModulate >> 8u) & 0xFFu) / 255.0;
    let a = f32(instance.colorModulate & 0xFFu) / 255.0;
    
    var output: VertexOutput;
    output.position = camera.viewProjection * vec4(worldPos, 0.0, 1.0);
    output.uv = uv;
    output.color = vec4(r, g, b, a);
    
    return output;
}

fn rotateVertex(vertex: vec2<f32>, rotation: u32) -> vec2<f32> {
    // 围绕 (0.5, 0.5) 旋转
    let centered = vertex - vec2(0.5, 0.5);
    var rotated: vec2<f32>;
    
    switch rotation {
        case 0u: { // 0°
            rotated = centered;
        }
        case 1u: { // 90°
            rotated = vec2(-centered.y, centered.x);
        }
        case 2u: { // 180°
            rotated = -centered;
        }
        case 3u: { // 270°
            rotated = vec2(centered.y, -centered.x);
        }
        default: {
            rotated = centered;
        }
    }
    
    return rotated + vec2(0.5, 0.5);
}

// ============ Fragment Shader ============

@group(0) @binding(1) var tilesetTexture: texture_2d<f32>;
@group(0) @binding(2) var tilesetSampler: sampler;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let texColor = textureSample(tilesetTexture, tilesetSampler, input.uv);
    let finalColor = texColor * input.color;
    
    // 丢弃完全透明的像素（可选，用于优化）
    if (finalColor.a < 0.01) {
        discard;
    }
    
    return finalColor;
}
```

### 2.3 Instance Buffer 管理

```typescript
class TileInstanceBuffer {
    private device: GPUDevice;
    private buffer: GPUBuffer;
    private capacity: number;
    private instanceData: Float32Array;
    private instanceCount: number = 0;
    
    constructor(device: GPUDevice, maxInstances: number = 10000) {
        this.device = device;
        this.capacity = maxInstances;
        
        // 每个实例：vec2 position, vec4 tileUV, vec2 tileSize, u32 flags, u32 color
        // = 2 + 4 + 2 + 1 + 1 = 10 floats (40 bytes)
        const bytesPerInstance = 40;
        
        this.buffer = device.createBuffer({
            label: 'Tile Instance Buffer',
            size: maxInstances * bytesPerInstance,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        
        this.instanceData = new Float32Array(maxInstances * 10);
    }
    
    clear(): void {
        this.instanceCount = 0;
    }
    
    addInstance(instance: TileInstanceData): void {
        if (this.instanceCount >= this.capacity) {
            console.warn('Instance buffer full!');
            return;
        }
        
        const offset = this.instanceCount * 10;
        
        // Position
        this.instanceData[offset + 0] = instance.position.x;
        this.instanceData[offset + 1] = instance.position.y;
        
        // UV
        this.instanceData[offset + 2] = instance.uv.x;
        this.instanceData[offset + 3] = instance.uv.y;
        this.instanceData[offset + 4] = instance.uv.width;
        this.instanceData[offset + 5] = instance.uv.height;
        
        // Size
        this.instanceData[offset + 6] = instance.size.x;
        this.instanceData[offset + 7] = instance.size.y;
        
        // Flags (as float32, will be reinterpreted as u32 in shader)
        let flags = 0;
        if (instance.flipX) flags |= 1;
        if (instance.flipY) flags |= 2;
        flags |= (instance.rotation & 3) << 2;
        this.instanceData[offset + 8] = new Float32Array(new Uint32Array([flags]).buffer)[0];
        
        // Color (packed RGBA8)
        const r = Math.floor(instance.color.r * 255);
        const g = Math.floor(instance.color.g * 255);
        const b = Math.floor(instance.color.b * 255);
        const a = Math.floor(instance.color.a * 255);
        const packedColor = (r << 24) | (g << 16) | (b << 8) | a;
        this.instanceData[offset + 9] = new Float32Array(new Uint32Array([packedColor]).buffer)[0];
        
        this.instanceCount++;
    }
    
    upload(): void {
        if (this.instanceCount === 0) return;
        
        // 只上传使用的部分
        const data = this.instanceData.slice(0, this.instanceCount * 10);
        this.device.queue.writeBuffer(this.buffer, 0, data);
    }
    
    getBuffer(): GPUBuffer {
        return this.buffer;
    }
    
    getInstanceCount(): number {
        return this.instanceCount;
    }
}

interface TileInstanceData {
    position: { x: number, y: number };
    uv: { x: number, y: number, width: number, height: number };
    size: { x: number, y: number };
    flipX: boolean;
    flipY: boolean;
    rotation: number; // 0-3
    color: { r: number, g: number, b: number, a: number };
}
```

## 3. 视锥剔除系统

### 3.1 基于 Chunk 的剔除

```typescript
class ChunkCullingSystem {
    private camera: Camera2D;
    
    getVisibleChunks(
        chunks: TileChunk[],
        camera: Camera2D
    ): TileChunk[] {
        const viewport = camera.getViewportRect();
        const visibleChunks: TileChunk[] = [];
        
        for (const chunk of chunks) {
            if (this.isChunkVisible(chunk, viewport)) {
                visibleChunks.push(chunk);
            }
        }
        
        return visibleChunks;
    }
    
    private isChunkVisible(chunk: TileChunk, viewport: Rect): boolean {
        const bounds = chunk.getBounds();
        
        // AABB 相交测试
        return !(
            bounds.x + bounds.width < viewport.x ||
            bounds.x > viewport.x + viewport.width ||
            bounds.y + bounds.height < viewport.y ||
            bounds.y > viewport.y + viewport.height
        );
    }
}
```

### 3.2 GPU Frustum Culling（高级）

```typescript
class GPUFrustumCulling {
    private device: GPUDevice;
    private cullingPipeline: GPUComputePipeline;
    
    async initialize(device: GPUDevice): Promise<void> {
        this.device = device;
        
        const shaderModule = device.createShaderModule({
            code: `
                struct ChunkBounds {
                    min: vec2<f32>,
                    max: vec2<f32>,
                }
                
                struct ViewportUniform {
                    min: vec2<f32>,
                    max: vec2<f32>,
                }
                
                @group(0) @binding(0) var<storage, read> chunkBounds: array<ChunkBounds>;
                @group(0) @binding(1) var<uniform> viewport: ViewportUniform;
                @group(0) @binding(2) var<storage, read_write> visibilityFlags: array<u32>;
                
                @compute @workgroup_size(64)
                fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                    let chunkIndex = id.x;
                    if (chunkIndex >= arrayLength(&chunkBounds)) {
                        return;
                    }
                    
                    let bounds = chunkBounds[chunkIndex];
                    
                    // AABB intersection test
                    let visible = !(
                        bounds.max.x < viewport.min.x ||
                        bounds.min.x > viewport.max.x ||
                        bounds.max.y < viewport.min.y ||
                        bounds.min.y > viewport.max.y
                    );
                    
                    visibilityFlags[chunkIndex] = select(0u, 1u, visible);
                }
            `
        });
        
        this.cullingPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            }
        });
    }
    
    async cullChunks(
        chunks: TileChunk[],
        viewport: Rect
    ): Promise<boolean[]> {
        // 创建 bounds buffer
        const boundsData = new Float32Array(chunks.length * 4);
        chunks.forEach((chunk, i) => {
            const bounds = chunk.getBounds();
            boundsData[i * 4 + 0] = bounds.x;
            boundsData[i * 4 + 1] = bounds.y;
            boundsData[i * 4 + 2] = bounds.x + bounds.width;
            boundsData[i * 4 + 3] = bounds.y + bounds.height;
        });
        
        const boundsBuffer = this.device.createBuffer({
            size: boundsData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(boundsBuffer, 0, boundsData);
        
        // 创建 viewport buffer
        const viewportData = new Float32Array([
            viewport.x,
            viewport.y,
            viewport.x + viewport.width,
            viewport.y + viewport.height
        ]);
        const viewportBuffer = this.device.createBuffer({
            size: viewportData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(viewportBuffer, 0, viewportData);
        
        // 创建结果 buffer
        const resultBuffer = this.device.createBuffer({
            size: chunks.length * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });
        
        const readBuffer = this.device.createBuffer({
            size: chunks.length * 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });
        
        // 执行计算
        const bindGroup = this.device.createBindGroup({
            layout: this.cullingPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: boundsBuffer } },
                { binding: 1, resource: { buffer: viewportBuffer } },
                { binding: 2, resource: { buffer: resultBuffer } }
            ]
        });
        
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.cullingPipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatchWorkgroups(Math.ceil(chunks.length / 64));
        passEncoder.end();
        
        commandEncoder.copyBufferToBuffer(resultBuffer, 0, readBuffer, 0, chunks.length * 4);
        this.device.queue.submit([commandEncoder.finish()]);
        
        // 读取结果
        await readBuffer.mapAsync(GPUMapMode.READ);
        const result = new Uint32Array(readBuffer.getMappedRange());
        const visibility = Array.from(result).map(v => v !== 0);
        readBuffer.unmap();
        
        // 清理
        boundsBuffer.destroy();
        viewportBuffer.destroy();
        resultBuffer.destroy();
        readBuffer.destroy();
        
        return visibility;
    }
}
```

## 4. 批量渲染优化

### 4.1 按 TileSet 分组批处理

```typescript
class BatchRenderer {
    render(
        chunks: TileChunk[],
        tileSetManager: TileSetManager,
        camera: Camera2D
    ): void {
        // 1. 按 TileSet 分组
        const batches = new Map<number, TileInstanceData[]>();
        
        for (const chunk of chunks) {
            this.collectChunkInstances(chunk, batches);
        }
        
        // 2. 为每个 TileSet 批次创建 buffer 并渲染
        for (const [tileSetId, instances] of batches) {
            const tileSet = tileSetManager.getTileSet(tileSetId);
            if (!tileSet || instances.length === 0) continue;
            
            this.renderBatch(tileSet, instances, camera);
        }
    }
    
    private collectChunkInstances(
        chunk: TileChunk,
        batches: Map<number, TileInstanceData[]>
    ): void {
        const bounds = chunk.getBounds();
        
        for (let y = 0; y < chunk.size; y++) {
            for (let x = 0; x < chunk.size; x++) {
                const tile = chunk.getTile(x, y);
                if (!tile) continue;
                
                if (!batches.has(tile.tilesetId)) {
                    batches.set(tile.tilesetId, []);
                }
                
                const instance = this.createInstance(tile, bounds.x + x, bounds.y + y);
                batches.get(tile.tilesetId)!.push(instance);
            }
        }
    }
    
    private createInstance(tile: Tile, worldX: number, worldY: number): TileInstanceData {
        const tileSet = this.tileSetManager.getTileSet(tile.tilesetId);
        const uv = tileSet.getTileUV(tile.tileId);
        
        return {
            position: { x: worldX * TILE_SIZE, y: worldY * TILE_SIZE },
            uv: uv,
            size: { x: TILE_SIZE, y: TILE_SIZE },
            flipX: tile.flipX,
            flipY: tile.flipY,
            rotation: tile.rotate / 90,
            color: { r: 1, g: 1, b: 1, a: 1 }
        };
    }
}
```

### 4.2 Indirect Drawing（更高级）

```typescript
class IndirectDrawRenderer {
    private indirectBuffer: GPUBuffer;
    private indirectData: Uint32Array;
    
    setupIndirectBuffer(device: GPUDevice): void {
        // Indirect draw command structure:
        // - vertexCount: u32
        // - instanceCount: u32
        // - firstVertex: u32
        // - firstInstance: u32
        
        this.indirectData = new Uint32Array(4);
        this.indirectBuffer = device.createBuffer({
            size: 16, // 4 * u32
            usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST
        });
    }
    
    renderIndirect(
        renderPass: GPURenderPassEncoder,
        instanceCount: number
    ): void {
        // 设置 indirect draw 参数
        this.indirectData[0] = 6;              // 6 vertices (2 triangles)
        this.indirectData[1] = instanceCount;  // instance count
        this.indirectData[2] = 0;              // first vertex
        this.indirectData[3] = 0;              // first instance
        
        this.device.queue.writeBuffer(this.indirectBuffer, 0, this.indirectData);
        
        // Indirect draw
        renderPass.drawIndirect(this.indirectBuffer, 0);
    }
}
```

## 5. 动态更新优化

### 5.1 脏矩形更新

```typescript
class DirtyRectangleTracker {
    private dirtyRegions: Rect[] = [];
    private mergThreshold: number = 2; // 当矩形距离 < 2 时合并
    
    markDirty(x: number, y: number, width: number = 1, height: number = 1): void {
        const newRect = { x, y, width, height };
        
        // 尝试与现有矩形合并
        let merged = false;
        for (let i = 0; i < this.dirtyRegions.length; i++) {
            const existing = this.dirtyRegions[i];
            
            if (this.shouldMerge(existing, newRect)) {
                this.dirtyRegions[i] = this.mergeRects(existing, newRect);
                merged = true;
                break;
            }
        }
        
        if (!merged) {
            this.dirtyRegions.push(newRect);
        }
        
        // 定期合并所有矩形
        if (this.dirtyRegions.length > 10) {
            this.consolidate();
        }
    }
    
    getDirtyChunks(chunkSize: number): Set<string> {
        const dirtyChunks = new Set<string>();
        
        for (const rect of this.dirtyRegions) {
            const startChunkX = Math.floor(rect.x / chunkSize);
            const startChunkY = Math.floor(rect.y / chunkSize);
            const endChunkX = Math.floor((rect.x + rect.width - 1) / chunkSize);
            const endChunkY = Math.floor((rect.y + rect.height - 1) / chunkSize);
            
            for (let cy = startChunkY; cy <= endChunkY; cy++) {
                for (let cx = startChunkX; cx <= endChunkX; cx++) {
                    dirtyChunks.add(`${cx},${cy}`);
                }
            }
        }
        
        return dirtyChunks;
    }
    
    clear(): void {
        this.dirtyRegions = [];
    }
    
    private shouldMerge(a: Rect, b: Rect): boolean {
        // 检查是否相邻或重叠
        return !(
            a.x + a.width + this.mergeThreshold < b.x ||
            b.x + b.width + this.mergeThreshold < a.x ||
            a.y + a.height + this.mergeThreshold < b.y ||
            b.y + b.height + this.mergeThreshold < a.y
        );
    }
    
    private mergeRects(a: Rect, b: Rect): Rect {
        const minX = Math.min(a.x, b.x);
        const minY = Math.min(a.y, b.y);
        const maxX = Math.max(a.x + a.width, b.x + b.width);
        const maxY = Math.max(a.y + a.height, b.y + b.height);
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    private consolidate(): void {
        // 迭代合并所有可能的矩形
        let changed = true;
        while (changed && this.dirtyRegions.length > 1) {
            changed = false;
            
            for (let i = 0; i < this.dirtyRegions.length; i++) {
                for (let j = i + 1; j < this.dirtyRegions.length; j++) {
                    if (this.shouldMerge(this.dirtyRegions[i], this.dirtyRegions[j])) {
                        this.dirtyRegions[i] = this.mergeRects(
                            this.dirtyRegions[i],
                            this.dirtyRegions[j]
                        );
                        this.dirtyRegions.splice(j, 1);
                        changed = true;
                        break;
                    }
                }
                if (changed) break;
            }
        }
    }
}
```

### 5.2 Compute Shader 批量更新

```typescript
class ComputeBasedUpdater {
    private updatePipeline: GPUComputePipeline;
    
    async initialize(device: GPUDevice): Promise<void> {
        const shaderModule = device.createShaderModule({
            code: `
                struct TileUpdate {
                    x: u32,
                    y: u32,
                    tileId: u32,
                    flags: u32,
                }
                
                struct TileData {
                    // GPU 端瓦片数据
                    position: vec2<f32>,
                    uv: vec4<f32>,
                    // ...
                }
                
                @group(0) @binding(0) var<storage, read> updates: array<TileUpdate>;
                @group(0) @binding(1) var<storage, read_write> tileData: array<TileData>;
                @group(0) @binding(2) var<uniform> tileSetInfo: TileSetInfo;
                
                @compute @workgroup_size(64)
                fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                    let updateIndex = id.x;
                    if (updateIndex >= arrayLength(&updates)) {
                        return;
                    }
                    
                    let update = updates[updateIndex];
                    let dataIndex = update.y * tileSetInfo.mapWidth + update.x;
                    
                    // 计算 UV 等
                    let tileX = update.tileId % tileSetInfo.tilesPerRow;
                    let tileY = update.tileId / tileSetInfo.tilesPerRow;
                    let uvX = f32(tileX) * tileSetInfo.tileUVSize;
                    let uvY = f32(tileY) * tileSetInfo.tileUVSize;
                    
                    // 更新数据
                    tileData[dataIndex].position = vec2(f32(update.x), f32(update.y)) * tileSetInfo.tileSize;
                    tileData[dataIndex].uv = vec4(uvX, uvY, tileSetInfo.tileUVSize, tileSetInfo.tileUVSize);
                }
            `
        });
        
        this.updatePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            }
        });
    }
    
    async batchUpdate(updates: TileUpdate[]): Promise<void> {
        // 使用 compute shader 批量更新瓦片数据
        // 特别适用于大规模更新（> 1000 瓦片）
    }
}
```

## 6. 完整渲染流程

```typescript
class TileMapEngine {
    private device: GPUDevice;
    private renderer: TileMapRenderer;
    private tileMapData: TileMapData;
    private cullingSystem: ChunkCullingSystem;
    private instanceBuffer: TileInstanceBuffer;
    private dirtyTracker: DirtyRectangleTracker;
    
    async render(camera: Camera2D): Promise<void> {
        // 1. 视锥剔除，获取可见 chunks
        const visibleChunks = this.cullingSystem.getVisibleChunks(
            this.tileMapData.getAllChunks(),
            camera
        );
        
        // 2. 更新脏 chunks
        const dirtyChunks = this.dirtyTracker.getDirtyChunks(32);
        for (const chunk of visibleChunks) {
            const key = `${chunk.chunkX},${chunk.chunkY}`;
            if (chunk.isDirty() || dirtyChunks.has(key)) {
                this.rebuildChunk(chunk);
                chunk.clearDirty();
            }
        }
        this.dirtyTracker.clear();
        
        // 3. 收集所有可见瓦片实例
        this.instanceBuffer.clear();
        for (const chunk of visibleChunks) {
            this.collectChunkInstances(chunk);
        }
        
        // 4. 上传到 GPU
        this.instanceBuffer.upload();
        
        // 5. 渲染
        await this.renderer.render(
            this.instanceBuffer,
            camera
        );
    }
    
    private collectChunkInstances(chunk: TileChunk): void {
        const bounds = chunk.getBounds();
        
        for (let y = 0; y < chunk.size; y++) {
            for (let x = 0; x < chunk.size; x++) {
                const tile = chunk.getTile(x, y);
                if (!tile) continue;
                
                const instance = this.createTileInstance(
                    tile,
                    bounds.x + x,
                    bounds.y + y
                );
                
                this.instanceBuffer.addInstance(instance);
            }
        }
    }
}
```

## 7. 性能优化清单

### CPU 端优化
- ✅ 使用稀疏数据结构（HashMap）存储瓦片
- ✅ 分块管理（Chunk system）
- ✅ 视锥剔除减少处理量
- ✅ 脏矩形跟踪，只更新变化部分
- ✅ 对象池复用（Instance data）

### GPU 端优化
- ✅ 批量绘制减少 Draw Call
- ✅ 实例化渲染
- ✅ Storage Buffer 传输数据
- ✅ Compute Shader 用于大规模更新
- ✅ GPU Frustum Culling（可选）
- ✅ Indirect Drawing（可选）

### 内存优化
- ✅ 纹理图集减少纹理数量
- ✅ 压缩纹理格式
- ✅ Mipmap 减少纹理采样开销
- ✅ LRU 缓存淘汰不常用数据

### 渲染质量
- ✅ 各向异性过滤
- ✅ Premultiplied Alpha
- ✅ 正确的混合模式
- ✅ 深度测试支持多层

## 8. 性能基准

预期性能指标：

| 指标 | 目标值 |
|------|--------|
| Draw Calls | < 10 per frame |
| 可渲染瓦片数 | 100,000+ @ 60 FPS |
| 内存占用 | < 100 MB for 1M tiles |
| 更新延迟 | < 1ms for 1000 tiles |
| GPU 利用率 | 30-50% |

## 9. 实践建议

1. **从简单开始**：先实现基础渲染，再逐步添加优化
2. **性能测试**：使用真实场景数据测试
3. **GPU 调试**：使用 Chrome DevTools 的 WebGPU inspector
4. **Profiling**：定期 profile CPU 和 GPU 性能
5. **增量优化**：一次优化一个方面，测量效果

## 10. 参考实现

查看项目中的相关实现：
- `/src/map/TileMapRenderer.ts` - 基础渲染器
- `/src/tilemap/InfiniteCanvas.tsx` - 无限画布实现
- `/src/scenes/webgpu/` - WebGPU 基础设施

## 总结

WebGPU TileMap 实现的关键点：
1. **高效数据结构**：稀疏存储 + 分块管理
2. **智能剔除**：减少不必要的处理
3. **批量渲染**：最小化 Draw Call
4. **GPU 加速**：充分利用 GPU 并行能力
5. **增量更新**：只处理变化部分

通过这些技术，可以实现高性能的 2D Tilemap 渲染系统，支持大规模地图和实时编辑。

