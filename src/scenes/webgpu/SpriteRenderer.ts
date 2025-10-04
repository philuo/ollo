import { Renderer } from './Renderer';

/**
 * 顶点着色器（WGSL）
 */
const vertexShader = `
struct VertexInput {
  @location(0) position: vec2f,
  @location(1) texCoord: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texCoord: vec2f,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  output.texCoord = input.texCoord;
  return output;
}
`;

/**
 * 片段着色器（WGSL）
 */
const fragmentShader = `
@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;

@fragment
fn fs_main(@location(0) texCoord: vec2f) -> @location(0) vec4f {
  return textureSample(myTexture, mySampler, texCoord);
}
`;

/**
 * 精灵渲染器
 * 负责在 WebGPU 中绘制精灵
 */
export class SpriteRenderer {
  private renderer: Renderer;
  private pipeline!: GPURenderPipeline;
  private vertexBuffer!: GPUBuffer;
  private indexBuffer!: GPUBuffer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * 初始化精灵渲染器
   */
  init() {
    const device = this.renderer.getDevice();

    // 创建顶点缓冲区（矩形精灵）
    // 位置 (x, y), 纹理坐标 (u, v)
    const vertices = new Float32Array([
      // x, y, u, v
      -0.5, 0.5, 0.0, 0.0, // 左上
      0.5, 0.5, 1.0, 0.0, // 右上
      0.5, -0.5, 1.0, 1.0, // 右下
      -0.5, -0.5, 0.0, 1.0, // 左下
    ]);

    this.vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();

    // 创建索引缓冲区
    const indices = new Uint16Array([
      0, 1, 2, // 第一个三角形
      0, 2, 3, // 第二个三角形
    ]);

    this.indexBuffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
    this.indexBuffer.unmap();

    // 创建渲染管线
    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 16, // 4 floats * 4 bytes
      attributes: [
        {
          // position
          shaderLocation: 0,
          offset: 0,
          format: 'float32x2',
        },
        {
          // texCoord
          shaderLocation: 1,
          offset: 8,
          format: 'float32x2',
        },
      ],
    };

    this.pipeline = this.renderer.createRenderPipeline(
      vertexShader,
      fragmentShader,
      [vertexBufferLayout]
    );

    console.log('精灵渲染器初始化成功');
  }

  /**
   * 渲染精灵
   */
  render(texture: GPUTexture) {
    const device = this.renderer.getDevice();
    const context = this.renderer.getContext();

    // 创建纹理绑定组
    const sampler = device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      mipmapFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    const bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: sampler,
        },
        {
          binding: 1,
          resource: texture.createView(),
        },
      ],
    });

    // 创建命令编码器
    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    // 开始渲染通道
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
    renderPass.setIndexBuffer(this.indexBuffer, 'uint16');
    renderPass.setBindGroup(0, bindGroup);
    renderPass.drawIndexed(6, 1, 0, 0, 0);
    renderPass.end();

    // 提交命令
    device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 获取渲染管线
   */
  getPipeline(): GPURenderPipeline {
    return this.pipeline;
  }
}

