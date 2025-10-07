/**
 * TileMap WebGPU 渲染器
 * 使用 WebGPU 高效渲染瓦片地图
 */

import { TileMapData, Tile } from './TileMapData';
import { TileSet, TileSetManager } from './TileSet';

/**
 * 顶点着色器（WGSL）
 */
const vertexShader = `
struct Uniforms {
  viewMatrix: mat3x3f,
  tileSize: vec2f,
}

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) texCoord: vec2f,
  @location(2) tilePos: vec2f,     // 瓦片在地图中的位置
  @location(3) tileUV: vec4f,       // 瓦片在纹理中的UV (u, v, w, h)
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texCoord: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  // 计算瓦片的世界位置
  let worldPos = vec2f(
    input.tilePos.x * uniforms.tileSize.x + input.position.x * uniforms.tileSize.x,
    input.tilePos.y * uniforms.tileSize.y + input.position.y * uniforms.tileSize.y
  );
  
  // 应用视图变换
  let transformedPos = uniforms.viewMatrix * vec3f(worldPos, 1.0);
  output.position = vec4f(transformedPos.xy, 0.0, 1.0);
  
  // 计算纹理坐标
  output.texCoord = vec2f(
    input.tileUV.x + input.texCoord.x * input.tileUV.z,
    input.tileUV.y + input.texCoord.y * input.tileUV.w
  );
  
  return output;
}
`;

/**
 * 片段着色器（WGSL）
 */
const fragmentShader = `
@group(1) @binding(0) var mySampler: sampler;
@group(1) @binding(1) var myTexture: texture_2d<f32>;

struct FragmentInput {
  @location(0) texCoord: vec2f,
}

@fragment
fn fs_main(input: FragmentInput) -> @location(0) vec4f {
  return textureSample(myTexture, mySampler, input.texCoord);
}
`;

/**
 * 视图变换
 */
export interface ViewTransform {
  x: number;
  y: number;
  zoom: number;
}

/**
 * TileMap 渲染器
 */
export class TileMapRenderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;
  private canvas: HTMLCanvasElement;
  
  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private uniformBindGroup!: GPUBindGroup;
  private sampler!: GPUSampler;
  
  private tileSetManager: TileSetManager;
  private mapData: TileMapData | null = null;
  
  private viewTransform: ViewTransform = { x: 0, y: 0, zoom: 1.0 };
  
  // 渲染批次缓存
  private renderBatches: Map<number, RenderBatch> = new Map();
  
  constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    tileSetManager: TileSetManager
  ) {
    this.canvas = canvas;
    this.device = device;
    this.context = context;
    this.format = format;
    this.tileSetManager = tileSetManager;
  }

  /**
   * 初始化渲染器
   */
  async init(): Promise<void> {
    // 创建采样器
    this.sampler = this.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      mipmapFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // 创建 uniform 缓冲区
    this.uniformBuffer = this.device.createBuffer({
      size: 64, // mat3x3 (36 bytes) + vec2 (8 bytes) + padding (20 bytes) = 64 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 创建渲染管线
    const shaderModule = this.device.createShaderModule({
      code: vertexShader + '\n' + fragmentShader,
    });

    // 四边形顶点缓冲区布局（每个顶点）
    const quadBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 16, // 4 floats * 4 bytes
      stepMode: 'vertex',
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x2' },  // position
        { shaderLocation: 1, offset: 8, format: 'float32x2' },  // texCoord
      ],
    };

    // 实例数据缓冲区布局（每个瓦片实例）
    const instanceBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 24, // 6 floats * 4 bytes
      stepMode: 'instance',
      attributes: [
        { shaderLocation: 2, offset: 0, format: 'float32x2' },  // tilePos
        { shaderLocation: 3, offset: 8, format: 'float32x4' },  // tileUV (vec4)
      ],
    };

    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [quadBufferLayout, instanceBufferLayout],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.format,
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
      },
    });

    // 创建 uniform 绑定组
    this.uniformBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });

    console.log('TileMap 渲染器初始化成功');
  }

  /**
   * 设置地图数据
   */
  setMapData(mapData: TileMapData): void {
    this.mapData = mapData;
    this.rebuildRenderBatches();
  }

  /**
   * 设置视图变换
   */
  setViewTransform(transform: ViewTransform): void {
    this.viewTransform = transform;
    this.updateUniforms();
  }

  /**
   * 渲染地图
   */
  render(): void {
    if (!this.mapData) return;

    // 更新 uniforms
    this.updateUniforms();

    // 创建命令编码器
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    // 开始渲染通道
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.2, g: 0.2, b: 0.25, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.uniformBindGroup);

    // 渲染每个图层
    for (const layer of this.mapData.layers) {
      if (!layer.visible) continue;

      // 渲染每个瓦片集的批次
      for (const [tilesetId, batch] of this.renderBatches) {
        if (batch.instanceCount === 0) continue;

        const tileSet = this.tileSetManager.getTileSet(tilesetId);
        if (!tileSet) continue;

        const texture = tileSet.getTexture();
        if (!texture) continue;

        // 创建纹理绑定组
        const textureBindGroup = this.device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(1),
          entries: [
            {
              binding: 0,
              resource: this.sampler,
            },
            {
              binding: 1,
              resource: texture.createView(),
            },
          ],
        });

        renderPass.setBindGroup(1, textureBindGroup);
        renderPass.setVertexBuffer(0, batch.quadBuffer);
        renderPass.setVertexBuffer(1, batch.instanceBuffer);
        renderPass.setIndexBuffer(batch.indexBuffer, 'uint16');
        renderPass.drawIndexed(6, batch.instanceCount, 0, 0, 0);
      }
    }

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 重建渲染批次
   */
  private rebuildRenderBatches(): void {
    // 清除旧批次
    for (const batch of this.renderBatches.values()) {
      batch.quadBuffer.destroy();
      batch.instanceBuffer.destroy();
      batch.indexBuffer.destroy();
    }
    this.renderBatches.clear();

    if (!this.mapData) return;

    // 为每个瓦片集创建批次
    const tileSets = this.tileSetManager.getAllTileSets();
    for (const tileSet of tileSets) {
      const tilesetId = tileSet.getDefinition().id;
      const instances: number[] = [];

      // 收集使用此瓦片集的所有瓦片
      for (let layerIdx = 0; layerIdx < this.mapData.layers.length; layerIdx++) {
        const layer = this.mapData.layers[layerIdx];
        
        for (let y = 0; y < this.mapData.height; y++) {
          for (let x = 0; x < this.mapData.width; x++) {
            const tile = layer.tiles[y][x];
            if (tile && tile.tilesetId === tilesetId) {
              const uv = tileSet.getTileUV(tile.tileIndex);
              if (uv) {
                // 每个实例：tilePos(2), tileUV(4) = 6 个浮点数
                instances.push(
                  x, y,           // tilePos
                  uv.u, uv.v, uv.w, uv.h  // tileUV
                );
              }
            }
          }
        }
      }

      if (instances.length === 0) continue;

      const instanceCount = instances.length / 6;

      // 创建四边形顶点缓冲区（所有实例共享）
      const quadVertices = new Float32Array([
        // position, texCoord
        0.0, 0.0,  0.0, 0.0,  // 左上
        1.0, 0.0,  1.0, 0.0,  // 右上
        1.0, 1.0,  1.0, 1.0,  // 右下
        0.0, 1.0,  0.0, 1.0,  // 左下
      ]);

      const quadBuffer = this.device.createBuffer({
        size: quadVertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Float32Array(quadBuffer.getMappedRange()).set(quadVertices);
      quadBuffer.unmap();

      // 创建实例缓冲区
      const instanceData = new Float32Array(instances);
      const instanceBuffer = this.device.createBuffer({
        size: instanceData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Float32Array(instanceBuffer.getMappedRange()).set(instanceData);
      instanceBuffer.unmap();

      // 创建索引缓冲区
      const indices = new Uint16Array([
        0, 1, 2,  // 第一个三角形
        0, 2, 3,  // 第二个三角形
      ]);

      const indexBuffer = this.device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Uint16Array(indexBuffer.getMappedRange()).set(indices);
      indexBuffer.unmap();

      this.renderBatches.set(tilesetId, {
        quadBuffer,
        instanceBuffer,
        indexBuffer,
        instanceCount,
      });
    }
  }

  /**
   * 更新 uniforms
   */
  private updateUniforms(): void {
    if (!this.mapData) return;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // 计算视图矩阵（2D 正交投影 + 平移 + 缩放）
    const zoom = this.viewTransform.zoom;
    const scaleX = (2.0 / canvasWidth) * zoom;
    const scaleY = (2.0 / canvasHeight) * zoom;
    const translateX = -this.viewTransform.x * scaleX;
    const translateY = -this.viewTransform.y * scaleY;

    // mat3x3 in column-major order
    const viewMatrix = new Float32Array([
      scaleX, 0, 0,
      0, -scaleY, 0,  // 翻转 Y 轴
      translateX, translateY, 1,
      0  // padding
    ]);

    const tileSize = new Float32Array([
      this.mapData.tileWidth,
      this.mapData.tileHeight,
    ]);

    // 写入 uniform 缓冲区
    const uniformData = new Float32Array(16); // 64 bytes / 4 = 16 floats
    uniformData.set(viewMatrix, 0);
    uniformData.set(tileSize, 12);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  /**
   * 屏幕坐标转世界坐标
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    if (!this.mapData) return { x: 0, y: 0 };

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const zoom = this.viewTransform.zoom;
    const worldX = (screenX / zoom - canvasWidth / (2 * zoom)) + this.viewTransform.x;
    const worldY = (screenY / zoom - canvasHeight / (2 * zoom)) + this.viewTransform.y;

    return { x: worldX, y: worldY };
  }

  /**
   * 世界坐标转瓦片坐标
   */
  worldToTile(worldX: number, worldY: number): { x: number; y: number } {
    if (!this.mapData) return { x: 0, y: 0 };

    return {
      x: Math.floor(worldX / this.mapData.tileWidth),
      y: Math.floor(worldY / this.mapData.tileHeight),
    };
  }

  /**
   * 屏幕坐标转瓦片坐标
   */
  screenToTile(screenX: number, screenY: number): { x: number; y: number } {
    const world = this.screenToWorld(screenX, screenY);
    return this.worldToTile(world.x, world.y);
  }

  /**
   * 销毁
   */
  destroy(): void {
    for (const batch of this.renderBatches.values()) {
      batch.quadBuffer.destroy();
      batch.instanceBuffer.destroy();
      batch.indexBuffer.destroy();
    }
    this.renderBatches.clear();
    
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
    }
  }
}

/**
 * 渲染批次
 */
interface RenderBatch {
  quadBuffer: GPUBuffer;
  instanceBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  instanceCount: number;
}

