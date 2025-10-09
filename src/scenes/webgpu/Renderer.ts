/**
 * WebGPU 渲染器核心类
 * 负责初始化和管理WebGPU上下文
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * 初始化 WebGPU
   */
  async init(): Promise<boolean> {
    if (!navigator.gpu) {
      console.error('WebGPU 不被支持');
      return false;
    }

    try {
      // 请求 GPU 适配器
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.error('无法获取 GPU 适配器');
        return false;
      }

      // 请求 GPU 设备
      this.device = await adapter.requestDevice();

      // 配置 canvas 上下文
      const context = this.canvas.getContext('webgpu');
      if (!context) {
        console.error('无法获取 WebGPU 上下文');
        return false;
      }
      this.context = context;

      // 获取首选格式
      this.format = navigator.gpu.getPreferredCanvasFormat();

      // 配置上下文
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied',
      });

      console.log('WebGPU 初始化成功');
      return true;
    } catch (error) {
      console.error('WebGPU 初始化失败:', error);
      return false;
    }
  }

  /**
   * 获取 GPU 设备
   */
  getDevice(): GPUDevice {
    return this.device;
  }

  /**
   * 获取 Canvas 上下文
   */
  getContext(): GPUCanvasContext {
    return this.context;
  }

  /**
   * 获取纹理格式
   */
  getFormat(): GPUTextureFormat {
    return this.format;
  }

  /**
   * 清除画布
   */
  clear(r: number = 0.1, g: number = 0.1, b: number = 0.1, a: number = 1.0) {
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r, g, b, a },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 创建渲染管线
   */
  createRenderPipeline(
    vertexShader: string,
    fragmentShader: string,
    vertexBufferLayout: GPUVertexBufferLayout[]
  ): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({
      code: vertexShader + '\n' + fragmentShader,
    });

    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: vertexBufferLayout,
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
  }
}
