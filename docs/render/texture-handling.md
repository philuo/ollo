# 纹理图片加载、处理、缓存与绘制最佳实践

## 概述

本文档详细介绍在现代 Web 环境下，特别是使用 WebGPU 进行 2D 游戏开发时，纹理处理的完整流程和最佳实践。

## 1. 纹理加载（Texture Loading）

### 1.1 异步加载策略

```typescript
class TextureLoader {
    private loadQueue: Map<string, Promise<ImageBitmap>> = new Map();
    private maxConcurrent: number = 6; // 浏览器并发限制
    private currentLoading: number = 0;

    async loadTexture(url: string): Promise<ImageBitmap> {
        // 避免重复加载
        if (this.loadQueue.has(url)) {
            return this.loadQueue.get(url)!;
        }

        const loadPromise = this.queueLoad(url);
        this.loadQueue.set(url, loadPromise);
        return loadPromise;
    }

    private async queueLoad(url: string): Promise<ImageBitmap> {
        // 等待可用的加载槽
        while (this.currentLoading >= this.maxConcurrent) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        this.currentLoading++;
        try {
            return await this.fetchAndDecode(url);
        } finally {
            this.currentLoading--;
        }
    }

    private async fetchAndDecode(url: string): Promise<ImageBitmap> {
        const response = await fetch(url);
        const blob = await response.blob();
        
        // createImageBitmap 比 Image 对象更高效
        return await createImageBitmap(blob, {
            premultiplyAlpha: 'premultiply',  // 预乘 alpha
            colorSpaceConversion: 'default',  // 色彩空间转换
            imageOrientation: 'flipY'          // WebGPU 纹理坐标系
        });
    }
}
```

### 1.2 优先级加载

```typescript
enum LoadPriority {
    CRITICAL = 0,  // 立即需要（当前场景）
    HIGH = 1,      // 很快需要（附近区域）
    NORMAL = 2,    // 正常优先级
    LOW = 3        // 预加载
}

class PriorityTextureLoader {
    private queues: Map<LoadPriority, string[]> = new Map();
    private loading: Set<string> = new Set();

    requestLoad(url: string, priority: LoadPriority): Promise<ImageBitmap> {
        if (!this.queues.has(priority)) {
            this.queues.set(priority, []);
        }
        
        const queue = this.queues.get(priority)!;
        if (!queue.includes(url)) {
            queue.push(url);
        }

        this.processQueue();
        return this.waitForLoad(url);
    }

    private async processQueue() {
        // 按优先级处理
        for (let priority = LoadPriority.CRITICAL; priority <= LoadPriority.LOW; priority++) {
            const queue = this.queues.get(priority) || [];
            while (queue.length > 0 && this.loading.size < this.maxConcurrent) {
                const url = queue.shift()!;
                this.loadTexture(url, priority);
            }
        }
    }
}
```

### 1.3 渐进式加载

```typescript
class ProgressiveTextureLoader {
    async loadProgressive(url: string): Promise<{
        thumbnail: ImageBitmap,
        full: Promise<ImageBitmap>
    }> {
        // 1. 先加载低分辨率缩略图
        const thumbnailUrl = url.replace(/(\.\w+)$/, '_thumb$1');
        const thumbnail = await this.loadTexture(thumbnailUrl).catch(() => 
            // 如果没有缩略图，创建低分辨率版本
            this.createLowResVersion(url)
        );

        // 2. 异步加载完整版本
        const full = this.loadTexture(url);

        return { thumbnail, full };
    }

    private async createLowResVersion(url: string): Promise<ImageBitmap> {
        const full = await this.loadTexture(url);
        const canvas = new OffscreenCanvas(full.width / 4, full.height / 4);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(full, 0, 0, canvas.width, canvas.height);
        return createImageBitmap(canvas);
    }
}
```

## 2. 纹理处理（Texture Processing）

### 2.1 纹理图集生成（Texture Atlas）

```typescript
interface AtlasNode {
    x: number;
    y: number;
    width: number;
    height: number;
    used: boolean;
    down?: AtlasNode;
    right?: AtlasNode;
}

class TextureAtlasBuilder {
    private root: AtlasNode;
    private canvas: OffscreenCanvas;
    private ctx: OffscreenCanvasRenderingContext2D;
    private rects: Map<string, Rect> = new Map();

    constructor(width: number = 2048, height: number = 2048) {
        this.canvas = new OffscreenCanvas(width, height);
        this.ctx = this.canvas.getContext('2d', {
            alpha: true,
            willReadFrequently: false
        })!;
        
        this.root = {
            x: 0, y: 0,
            width: width,
            height: height,
            used: false
        };
    }

    async addTexture(id: string, image: ImageBitmap, padding: number = 1): Promise<Rect | null> {
        // 二叉树装箱算法（Binary Tree Bin Packing）
        const node = this.findNode(this.root, image.width + padding * 2, image.height + padding * 2);
        
        if (!node) return null;

        const fitNode = this.splitNode(node, image.width + padding * 2, image.height + padding * 2);
        
        // 绘制到图集，添加 padding 防止纹理渗色
        this.ctx.drawImage(
            image,
            fitNode.x + padding,
            fitNode.y + padding,
            image.width,
            image.height
        );

        // 计算 UV 坐标（归一化）
        const rect = {
            x: (fitNode.x + padding) / this.canvas.width,
            y: (fitNode.y + padding) / this.canvas.height,
            width: image.width / this.canvas.width,
            height: image.height / this.canvas.height
        };

        this.rects.set(id, rect);
        return rect;
    }

    private findNode(node: AtlasNode, width: number, height: number): AtlasNode | null {
        if (node.used) {
            return this.findNode(node.right!, width, height) || 
                   this.findNode(node.down!, width, height);
        } else if (width <= node.width && height <= node.height) {
            return node;
        }
        return null;
    }

    private splitNode(node: AtlasNode, width: number, height: number): AtlasNode {
        node.used = true;
        node.down = {
            x: node.x,
            y: node.y + height,
            width: node.width,
            height: node.height - height,
            used: false
        };
        node.right = {
            x: node.x + width,
            y: node.y,
            width: node.width - width,
            height: height,
            used: false
        };
        return node;
    }

    async build(): Promise<ImageBitmap> {
        return createImageBitmap(this.canvas);
    }

    getRect(id: string): Rect | undefined {
        return this.rects.get(id);
    }
}
```

### 2.2 Mipmap 生成

```typescript
class MipmapGenerator {
    generateMipmaps(source: ImageBitmap): ImageBitmap[] {
        const mipmaps: ImageBitmap[] = [source];
        let currentWidth = source.width;
        let currentHeight = source.height;
        let currentSource = source;

        while (currentWidth > 1 || currentHeight > 1) {
            currentWidth = Math.max(1, Math.floor(currentWidth / 2));
            currentHeight = Math.max(1, Math.floor(currentHeight / 2));

            const canvas = new OffscreenCanvas(currentWidth, currentHeight);
            const ctx = canvas.getContext('2d', {
                alpha: true,
                // 使用高质量缩放
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            })!;

            ctx.drawImage(currentSource, 0, 0, currentWidth, currentHeight);
            
            const mipmap = await createImageBitmap(canvas);
            mipmaps.push(mipmap);
            currentSource = mipmap;
        }

        return mipmaps;
    }

    async generateMipmapsGPU(device: GPUDevice, texture: GPUTexture): Promise<void> {
        // 使用 GPU 计算着色器生成 mipmap（更高效）
        const mipmapShader = device.createShaderModule({
            code: `
                @group(0) @binding(0) var src_texture: texture_2d<f32>;
                @group(0) @binding(1) var dst_texture: texture_storage_2d<rgba8unorm, write>;
                @group(0) @binding(2) var texture_sampler: sampler;

                @compute @workgroup_size(8, 8)
                fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                    let dst_size = textureDimensions(dst_texture);
                    if (id.x >= dst_size.x || id.y >= dst_size.y) {
                        return;
                    }

                    let src_size = textureDimensions(src_texture);
                    let uv = (vec2<f32>(id.xy) + 0.5) / vec2<f32>(dst_size);
                    
                    // 使用线性插值采样
                    let color = textureSampleLevel(src_texture, texture_sampler, uv, 0.0);
                    textureStore(dst_texture, id.xy, color);
                }
            `
        });

        // 为每个 mip level 生成
        for (let level = 1; level < texture.mipLevelCount; level++) {
            // ... compute pass setup
        }
    }
}
```

### 2.3 纹理压缩

```typescript
class TextureCompressor {
    /**
     * 使用 Basis Universal 压缩纹理
     * Basis 是一种现代纹理压缩格式，可以转码为各种 GPU 格式
     */
    async compressToBasis(image: ImageBitmap): Promise<ArrayBuffer> {
        // 需要 basis_encoder.wasm
        const encoder = await this.loadBasisEncoder();
        
        const imageData = await this.extractImageData(image);
        
        return encoder.encode(imageData, {
            quality: 128,           // 0-255
            compressionLevel: 2,    // 0-5
            uastc: false,          // false = ETC1S (更小), true = UASTC (更高质量)
            mipmaps: true,
            yFlip: true
        });
    }

    /**
     * KTX2 容器格式
     */
    async compressToKTX2(image: ImageBitmap): Promise<ArrayBuffer> {
        // KTX2 是 Khronos 标准纹理容器格式
        // 支持多种压缩格式：BC7, ETC2, ASTC 等
        
        const ktx2Encoder = await this.loadKTX2Encoder();
        const imageData = await this.extractImageData(image);
        
        return ktx2Encoder.encode(imageData, {
            format: 'BC7',          // 桌面优先
            etcFormat: 'ETC2',      // 移动设备回退
            quality: 'high',
            mipmaps: true
        });
    }

    private async extractImageData(image: ImageBitmap): Promise<Uint8Array> {
        const canvas = new OffscreenCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, image.width, image.height);
        return new Uint8Array(imageData.data.buffer);
    }
}
```

## 3. 纹理缓存（Texture Caching）

### 3.1 LRU 缓存策略

```typescript
class LRUTextureCache {
    private cache: Map<string, CacheEntry> = new Map();
    private accessOrder: string[] = [];
    private maxSize: number; // 字节
    private currentSize: number = 0;

    constructor(maxSizeMB: number = 512) {
        this.maxSize = maxSizeMB * 1024 * 1024;
    }

    get(key: string): GPUTexture | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // 更新访问顺序
        this.updateAccessOrder(key);
        entry.lastAccess = Date.now();
        entry.accessCount++;

        return entry.texture;
    }

    set(key: string, texture: GPUTexture, size: number): void {
        // 如果已存在，先删除
        if (this.cache.has(key)) {
            this.delete(key);
        }

        // 确保有足够空间
        this.makeSpace(size);

        const entry: CacheEntry = {
            texture,
            size,
            lastAccess: Date.now(),
            accessCount: 1
        };

        this.cache.set(key, entry);
        this.accessOrder.push(key);
        this.currentSize += size;
    }

    private makeSpace(requiredSize: number): void {
        while (this.currentSize + requiredSize > this.maxSize && this.accessOrder.length > 0) {
            // 移除最久未使用的
            const oldestKey = this.accessOrder[0];
            this.delete(oldestKey);
        }
    }

    private delete(key: string): void {
        const entry = this.cache.get(key);
        if (!entry) return;

        entry.texture.destroy();
        this.cache.delete(key);
        this.currentSize -= entry.size;
        
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    private updateAccessOrder(key: string): void {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);
    }
}

interface CacheEntry {
    texture: GPUTexture;
    size: number;
    lastAccess: number;
    accessCount: number;
}
```

### 3.2 分层缓存

```typescript
class TieredTextureCache {
    private l1Cache: LRUTextureCache;  // 热数据（GPU 内存）
    private l2Cache: Map<string, ImageBitmap>; // 温数据（CPU 内存）
    private l3Cache: Map<string, Promise<ImageBitmap>>; // 冷数据（磁盘/网络）

    constructor(
        private device: GPUDevice,
        private loader: TextureLoader
    ) {
        this.l1Cache = new LRUTextureCache(256); // 256 MB GPU
        this.l2Cache = new Map(); // CPU memory
        this.l3Cache = new Map(); // Loading promises
    }

    async getTexture(url: string): Promise<GPUTexture> {
        // L1: GPU 纹理缓存
        let gpuTexture = this.l1Cache.get(url);
        if (gpuTexture) {
            return gpuTexture;
        }

        // L2: CPU ImageBitmap 缓存
        let imageBitmap = this.l2Cache.get(url);
        if (!imageBitmap) {
            // L3: 异步加载
            if (!this.l3Cache.has(url)) {
                this.l3Cache.set(url, this.loader.loadTexture(url));
            }
            imageBitmap = await this.l3Cache.get(url)!;
            this.l2Cache.set(url, imageBitmap);
        }

        // 上传到 GPU
        gpuTexture = this.uploadToGPU(imageBitmap);
        this.l1Cache.set(url, gpuTexture, imageBitmap.width * imageBitmap.height * 4);

        return gpuTexture;
    }

    private uploadToGPU(imageBitmap: ImageBitmap): GPUTexture {
        const texture = this.device.createTexture({
            size: [imageBitmap.width, imageBitmap.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | 
                   GPUTextureUsage.COPY_DST | 
                   GPUTextureUsage.RENDER_ATTACHMENT
        });

        this.device.queue.copyExternalImageToTexture(
            { source: imageBitmap, flipY: true },
            { texture: texture },
            [imageBitmap.width, imageBitmap.height]
        );

        return texture;
    }
}
```

### 3.3 预测性预加载

```typescript
class PredictivePreloader {
    private player Vector2;
    private moveDirection: Vector2 = { x: 0, y: 0 };
    private preloadRadius: number = 3; // 预加载半径（屏幕数）

    update(playerPos: Vector2, velocity: Vector2): void {
        this.playerPos = playerPos;
        
        // 计算移动方向
        if (velocity.x !== 0 || velocity.y !== 0) {
            this.moveDirection = this.normalize(velocity);
        }

        // 预加载前方区域的纹理
        this.preloadTextures();
    }

    private preloadTextures(): void {
        const screenWidth = 1920;
        const screenHeight = 1080;
        
        // 当前屏幕中心
        const centerX = this.playerPos.x;
        const centerY = this.playerPos.y;

        // 根据移动方向偏移预加载中心
        const offsetX = this.moveDirection.x * screenWidth;
        const offsetY = this.moveDirection.y * screenHeight;

        const preloadCenterX = centerX + offsetX;
        const preloadCenterY = centerY + offsetY;

        // 获取该区域需要的纹理
        const textures = this.getTileTexturesInArea(
            preloadCenterX - screenWidth * this.preloadRadius,
            preloadCenterY - screenHeight * this.preloadRadius,
            screenWidth * this.preloadRadius * 2,
            screenHeight * this.preloadRadius * 2
        );

        // 异步预加载
        for (const texUrl of textures) {
            this.textureCache.getTexture(texUrl).catch(err => {
                console.warn(`Preload failed: ${texUrl}`, err);
            });
        }
    }
}
```

## 4. WebGPU 纹理绘制

### 4.1 批量绘制

```typescript
class WebGPUBatchRenderer {
    private device: GPUDevice;
    private pipeline: GPURenderPipeline;
    private instanceBuffer: GPUBuffer;
    private maxInstances: number = 10000;

    async draw(sprites: Sprite[]): Promise<void> {
        // 按纹理分组
        const batches = this.groupByTexture(sprites);

        const commandEncoder = this.device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({...});

        renderPass.setPipeline(this.pipeline);

        for (const [texture, instances] of batches) {
            if (instances.length === 0) continue;

            // 更新实例数据
            this.updateInstanceBuffer(instances);

            // 绑定纹理
            const bindGroup = this.device.createBindGroup({
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: texture.createView() },
                    { binding: 1, resource: { buffer: this.instanceBuffer } }
                ]
            });

            renderPass.setBindGroup(0, bindGroup);
            
            // 绘制所有实例
            renderPass.draw(6, instances.length, 0, 0); // 6 vertices per quad
        }

        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    private groupByTexture(sprites: Sprite[]): Map<GPUTexture, SpriteInstance[]> {
        const groups = new Map<GPUTexture, SpriteInstance[]>();
        
        for (const sprite of sprites) {
            if (!groups.has(sprite.texture)) {
                groups.set(sprite.texture, []);
            }
            groups.get(sprite.texture)!.push({
                position: sprite.position,
                size: sprite.size,
                uv: sprite.uv,
                color: sprite.color
            });
        }

        return groups;
    }
}
```

### 4.2 Shader 实现

```wgsl
// Vertex Shader
struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
}

struct InstanceData {
    position: vec2<f32>,
    size: vec2<f32>,
    uv_offset: vec2<f32>,
    uv_size: vec2<f32>,
    color: vec4<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
}

@group(0) @binding(1) var<storage, read> instances: array<InstanceData>;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    let instance = instances[input.instanceIndex];
    
    // Quad vertices (0,0), (1,0), (1,1), (0,1)
    var vertices = array<vec2<f32>, 6>(
        vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(1.0, 1.0),
        vec2(0.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 1.0)
    );
    
    let vertex = vertices[input.vertexIndex];
    
    // Transform vertex
    let world_pos = instance.position + vertex * instance.size;
    
    var output: VertexOutput;
    output.position = camera.projection * vec4(world_pos, 0.0, 1.0);
    output.uv = instance.uv_offset + vertex * instance.uv_size;
    output.color = instance.color;
    
    return output;
}

// Fragment Shader
@group(0) @binding(0) var texture: texture_2d<f32>;
@group(0) @binding(2) var texture_sampler: sampler;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let tex_color = textureSample(texture, texture_sampler, input.uv);
    return tex_color * input.color;
}
```

## 5. 性能优化建议

### 5.1 纹理格式选择

```typescript
const textureFormatGuide = {
    // 通用格式
    'rgba8unorm': '默认选择，良好的兼容性',
    'bgra8unorm': 'Canvas 兼容，稍快',
    
    // 压缩格式（需要检查支持）
    'bc7-rgba-unorm': 'PC/Console，高质量',
    'etc2-rgba8unorm': 'Mobile，Android',
    'astc-4x4-unorm': 'Mobile，iOS/Android，最佳',
    
    // HDR
    'rgba16float': 'HDR 纹理',
    
    // 无 alpha
    'rgb8unorm': '节省 25% 内存',
};

function selectTextureFormat(device: GPUDevice, hasAlpha: boolean): GPUTextureFormat {
    const features = device.features;
    
    if (hasAlpha) {
        // 检查压缩格式支持
        if (features.has('texture-compression-bc')) {
            return 'bc7-rgba-unorm'; // PC
        } else if (features.has('texture-compression-astc')) {
            return 'astc-4x4-unorm'; // Mobile
        } else if (features.has('texture-compression-etc2')) {
            return 'etc2-rgba8unorm'; // Mobile
        }
        return 'rgba8unorm'; // Fallback
    } else {
        // 无 alpha 通道
        return 'bgra8unorm'; // 或 'rgb8unorm' 如果支持
    }
}
```

### 5.2 内存管理

```typescript
class TextureMemoryManager {
    private allocatedMemory: number = 0;
    private memoryLimit: number;
    private allocations: Map<GPUTexture, number> = new Map();

    constructor(limitMB: number = 1024) {
        this.memoryLimit = limitMB * 1024 * 1024;
    }

    createTexture(device: GPUDevice, descriptor: GPUTextureDescriptor): GPUTexture | null {
        const size = this.calculateTextureSize(descriptor);
        
        if (this.allocatedMemory + size > this.memoryLimit) {
            console.warn('Texture memory limit exceeded');
            return null;
        }

        const texture = device.createTexture(descriptor);
        this.allocations.set(texture, size);
        this.allocatedMemory += size;

        return texture;
    }

    destroyTexture(texture: GPUTexture): void {
        const size = this.allocations.get(texture);
        if (size) {
            texture.destroy();
            this.allocations.delete(texture);
            this.allocatedMemory -= size;
        }
    }

    private calculateTextureSize(descriptor: GPUTextureDescriptor): number {
        const [width, height, depth = 1] = descriptor.size;
        const mipLevels = descriptor.mipLevelCount || 1;
        const bytesPerPixel = this.getBytesPerPixel(descriptor.format);
        
        let totalSize = 0;
        for (let i = 0; i < mipLevels; i++) {
            const mipWidth = Math.max(1, width >> i);
            const mipHeight = Math.max(1, height >> i);
            totalSize += mipWidth * mipHeight * depth * bytesPerPixel;
        }
        
        return totalSize;
    }

    private getBytesPerPixel(format: GPUTextureFormat): number {
        const formatSizes: Record<string, number> = {
            'rgba8unorm': 4,
            'bgra8unorm': 4,
            'rgb8unorm': 3,
            'rgba16float': 8,
            'bc7-rgba-unorm': 1, // 压缩格式
            'etc2-rgba8unorm': 1,
            // ... 更多格式
        };
        return formatSizes[format] || 4;
    }
}
```

### 5.3 性能监控

```typescript
class TexturePerformanceMonitor {
    private metrics = {
        texturesLoaded: 0,
        loadTime: 0,
        uploadTime: 0,
        memoryUsed: 0,
        cacheHits: 0,
        cacheMisses: 0
    };

    recordLoad(duration: number): void {
        this.metrics.texturesLoaded++;
        this.metrics.loadTime += duration;
    }

    recordCacheHit(hit: boolean): void {
        if (hit) {
            this.metrics.cacheHits++;
        } else {
            this.metrics.cacheMisses++;
        }
    }

    getReport(): string {
        const avgLoadTime = this.metrics.loadTime / this.metrics.texturesLoaded;
        const hitRate = this.metrics.cacheHits / 
            (this.metrics.cacheHits + this.metrics.cacheMisses);
        
        return `
Texture Performance Report:
- Textures Loaded: ${this.metrics.texturesLoaded}
- Avg Load Time: ${avgLoadTime.toFixed(2)}ms
- Memory Used: ${(this.metrics.memoryUsed / 1024 / 1024).toFixed(2)}MB
- Cache Hit Rate: ${(hitRate * 100).toFixed(1)}%
        `;
    }
}
```

## 6. 最佳实践总结

### 加载阶段
1. ✅ 使用 `createImageBitmap` 而非 `Image` 对象
2. ✅ 实施优先级加载系统
3. ✅ 限制并发加载数量（浏览器限制）
4. ✅ 预加载关键资源
5. ✅ 使用渐进式加载提升体验

### 处理阶段
1. ✅ 生成纹理图集减少状态切换
2. ✅ 使用 GPU 生成 mipmap
3. ✅ 考虑纹理压缩（KTX2/Basis）
4. ✅ 添加 padding 防止纹理渗色

### 缓存阶段
1. ✅ 实施多层缓存策略（GPU/CPU/Disk）
2. ✅ 使用 LRU 或其他淘汰策略
3. ✅ 预测性预加载常用纹理
4. ✅ 监控内存使用

### 绘制阶段
1. ✅ 批量绘制减少 Draw Call
2. ✅ 使用实例化渲染
3. ✅ 按纹理分组
4. ✅ 选择合适的纹理格式
5. ✅ 启用各向异性过滤提升质量

## 参考资源

- WebGPU Specification: https://www.w3.org/TR/webgpu/
- Basis Universal: https://github.com/BinomialLLC/basis_universal
- KTX2: https://www.khronos.org/ktx/
- Web Performance APIs: https://developer.mozilla.org/en-US/docs/Web/API/Performance

