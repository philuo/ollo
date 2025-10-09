/**
 * 无限画布 WebGPU 渲染器
 * 负责渲染网格和处理坐标转换
 */

/**
 * 视图变换
 */
export interface ViewTransform {
  x: number;
  y: number;
  zoom: number;
}

/**
 * 网格设置
 */
export interface GridSettings {
  cellWidth: number;
  cellHeight: number;
  gridLineWidth: number;
  gridLineColor: string;
  showGrid: boolean;
  gridCols: number;  // 网格列数
  gridRows: number;  // 网格行数
}

/**
 * 完整着色器代码 (WGSL)
 */
const shaderCode = `
// 共享结构体定义
struct Uniforms {
  viewMatrix: mat3x3f,
  gridSize: vec2f,
  canvasSize: vec2f,
  gridLineWidth: f32,
  padding: f32,
}

struct Colors {
  backgroundColor: vec4f,
  gridColor: vec4f,
  highlightColor: vec4f,
  hoveredCell: vec2i,
  showGrid: u32,
  padding: u32,
  gridRange: vec2i,  // 网格范围 (cols, rows)
  padding2: vec2u,
}

struct VertexInput {
  @location(0) position: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec2f,
}

// Uniform 绑定
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<uniform> colors: Colors;

// 顶点着色器
@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  
  // 将屏幕坐标转换为世界坐标
  let screenPos = vec2f(
    (input.position.x + 1.0) * 0.5 * uniforms.canvasSize.x,
    (1.0 - input.position.y) * 0.5 * uniforms.canvasSize.y
  );
  
  output.worldPos = screenPos;
  
  return output;
}

// 片段着色器
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  // 从视图矩阵提取参数
  let scaleX = uniforms.viewMatrix[0][0];
  let scaleY = -uniforms.viewMatrix[1][1];
  let translateX = uniforms.viewMatrix[2][0];
  let translateY = uniforms.viewMatrix[2][1];
  
  // 反推原始参数
  let zoom = scaleX / (2.0 / uniforms.canvasSize.x);
  let viewX = -translateX / scaleX;
  let viewY = -translateY / scaleY;
  
  // 屏幕坐标转世界坐标
  let worldX = (input.worldPos.x - uniforms.canvasSize.x * 0.5) / zoom + viewX;
  let worldY = (input.worldPos.y - uniforms.canvasSize.y * 0.5) / zoom + viewY;
  
  // 网格单元坐标
  let cellX = floor(worldX / uniforms.gridSize.x);
  let cellY = floor(worldY / uniforms.gridSize.y);
  
  var color = colors.backgroundColor;
  
  // 检查是否在网格范围内
  let inGridRange = cellX >= 0 && cellX < f32(colors.gridRange.x) && 
                    cellY >= 0 && cellY < f32(colors.gridRange.y);
  
  if (!inGridRange) {
    return color;  // 超出网格范围，直接返回背景色
  }
  
  // 绘制网格线（使用稳定的距离判断，消除移动时的闪烁）
  if (colors.showGrid > 0u) {
    // 线宽设置（保证至少1像素）
    let lineWidthPixels = max(uniforms.gridLineWidth, 1.0);
    
    // 计算当前单元格的网格线位置（世界坐标）
    // 使用精确的网格线位置，而不是相对位置，确保连续性
    let gridLeftX = cellX * uniforms.gridSize.x;
    let gridRightX = (cellX + 1.0) * uniforms.gridSize.x;
    let gridTopY = cellY * uniforms.gridSize.y;
    let gridBottomY = (cellY + 1.0) * uniforms.gridSize.y;
    
    // 计算到网格线的距离（世界坐标）
    // 距离是连续变化的，不会在单元格边界突变
    let distToLeft = worldX - gridLeftX;
    let distToRight = gridRightX - worldX;
    let distToTop = worldY - gridTopY;
    let distToBottom = gridBottomY - worldY;
    
    // 转换为屏幕像素单位（所有方向使用统一的缩放）
    let distToLeftPx = distToLeft * zoom;
    let distToRightPx = distToRight * zoom;
    let distToTopPx = distToTop * zoom;
    let distToBottomPx = distToBottom * zoom;
    
    // 稳定的判断条件：使用完整的 lineWidthPixels 确保线条完整显示
    // 使用 < 比较，避免 >= 的边界不确定性
    var onGridLine = false;
    
    // 垂直线判断（完全对称，避免闪烁）
    if (cellX == 0.0 && distToLeftPx < lineWidthPixels) {
      onGridLine = true;  // 第一列的左边线
    }
    if (distToRightPx < lineWidthPixels) {
      onGridLine = true;  // 所有单元的右边线
    }
    
    // 水平线判断（与垂直线使用相同逻辑）
    if (cellY == 0.0 && distToTopPx < lineWidthPixels) {
      onGridLine = true;  // 第一行的上边线
    }
    if (distToBottomPx < lineWidthPixels) {
      onGridLine = true;  // 所有单元的下边线
    }
    
    if (onGridLine) {
      color = colors.gridColor;
    }
  }
  
  // 高亮悬浮的网格
  if (cellX == f32(colors.hoveredCell.x) && cellY == f32(colors.hoveredCell.y)) {
    color = mix(color, colors.highlightColor, 0.3);
  }
  
  return color;
}
`;

/**
 * 无限画布渲染器
 */
export class InfiniteCanvasRenderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;
  private canvas: HTMLCanvasElement;

  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private colorBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private vertexBuffer!: GPUBuffer;

  private viewTransform: ViewTransform = { x: 0, y: 0, zoom: 0.5 };
  private gridSettings: GridSettings = {
    cellWidth: 64,
    cellHeight: 64,
    gridLineWidth: 1,
    gridLineColor: '#ffffff80',
    showGrid: true,
    gridCols: 64,
    gridRows: 64,
  };
  private backgroundColor: string = '#000000';
  private hoveredCell: { x: number; y: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat
  ) {
    this.canvas = canvas;
    this.device = device;
    this.context = context;
    this.format = format;
  }

  /**
   * 初始化渲染器
   */
  async init(): Promise<void> {
    // 创建着色器模块
    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
    });

    // 创建全屏四边形顶点缓冲区
    const vertices = new Float32Array([
      -1.0, -1.0, // 左下
       1.0, -1.0, // 右下
       1.0,  1.0, // 右上
      -1.0, -1.0, // 左下
       1.0,  1.0, // 右上
      -1.0,  1.0, // 左上
    ]);

    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();

    // 创建 uniform 缓冲区
    this.uniformBuffer = this.device.createBuffer({
      size: 80, // mat3x3(36) + vec2(8) + vec2(8) + f32(4) + padding(24) = 80
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 创建颜色缓冲区
    this.colorBuffer = this.device.createBuffer({
      size: 96, // vec4(16) + vec4(16) + vec4(16) + vec2i(8) + u32(4) + padding(4) + vec2i(8) + padding(24) = 96
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 创建渲染管线
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 8, // 2 floats * 4 bytes
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
            ],
          },
        ],
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

    // 创建绑定组
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.colorBuffer },
        },
      ],
    });

    // 初始化 uniform 和 color 数据
    this.updateUniforms();
    this.updateColors();

    console.log('无限画布渲染器初始化成功');
  }

  /**
   * 设置视图变换
   */
  setViewTransform(transform: ViewTransform): void {
    this.viewTransform = transform;
    this.updateUniforms();
  }

  /**
   * 设置网格设置
   */
  setGridSettings(settings: GridSettings): void {
    this.gridSettings = settings;
    this.updateUniforms();
    this.updateColors();
  }

  /**
   * 设置背景颜色
   */
  setBackgroundColor(color: string): void {
    this.backgroundColor = color;
    this.updateColors();
  }

  /**
   * 设置悬浮单元格
   */
  setHoveredCell(cell: { x: number; y: number } | null): void {
    this.hoveredCell = cell;
    this.updateColors();
  }

  /**
   * 渲染
   */
  render(): void {
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.draw(6, 1, 0, 0);

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 更新 uniforms
   */
  private updateUniforms(): void {
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const zoom = this.viewTransform.zoom;
    const scaleX = (2.0 / canvasWidth) * zoom;
    const scaleY = (2.0 / canvasHeight) * zoom;
    const translateX = -this.viewTransform.x * scaleX;
    const translateY = -this.viewTransform.y * scaleY;

    // 视图矩阵 (列主序)
    const viewMatrix = new Float32Array([
      scaleX, 0, 0, 0,
      0, -scaleY, 0, 0,
      translateX, translateY, 1, 0,
    ]);

    const gridSize = new Float32Array([
      this.gridSettings.cellWidth,
      this.gridSettings.cellHeight,
    ]);

    const canvasSize = new Float32Array([canvasWidth, canvasHeight]);
    const gridLineWidth = new Float32Array([this.gridSettings.gridLineWidth]);

    // 组装 uniform 数据
    const uniformData = new Float32Array(20); // 80 bytes / 4 = 20 floats
    uniformData.set(viewMatrix, 0); // 12 floats
    uniformData.set(gridSize, 12); // 2 floats
    uniformData.set(canvasSize, 14); // 2 floats
    uniformData.set(gridLineWidth, 16); // 1 float
    // padding: 17-19

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  /**
   * 更新颜色
   */
  private updateColors(): void {
    const bgColor = this.hexToRgba(this.backgroundColor);
    const gridColor = this.hexToRgba(this.gridSettings.gridLineColor);
    const highlightColor = new Float32Array([0.2, 0.5, 1.0, 0.5]); // 蓝色高亮

    const hoveredX = this.hoveredCell?.x ?? -999999;
    const hoveredY = this.hoveredCell?.y ?? -999999;

    const colorData = new Float32Array(24); // 96 bytes / 4 = 24 floats
    colorData.set(bgColor, 0); // 4 floats
    colorData.set(gridColor, 4); // 4 floats
    colorData.set(highlightColor, 8); // 4 floats

    // hoveredCell (vec2i)
    const hoveredCellData = new Int32Array([hoveredX, hoveredY]);
    const hoveredCellFloat = new Float32Array(hoveredCellData.buffer);
    colorData.set(hoveredCellFloat, 12); // 2 floats (实际是 2 ints)

    // showGrid (u32)
    const showGridData = new Uint32Array([this.gridSettings.showGrid ? 1 : 0]);
    const showGridFloat = new Float32Array(showGridData.buffer);
    colorData.set(showGridFloat, 14); // 1 float (实际是 1 uint)
    // padding: 15

    // gridRange (vec2i)
    const gridRangeData = new Int32Array([this.gridSettings.gridCols, this.gridSettings.gridRows]);
    const gridRangeFloat = new Float32Array(gridRangeData.buffer);
    colorData.set(gridRangeFloat, 16); // 2 floats (实际是 2 ints)
    // padding: 18-23

    this.device.queue.writeBuffer(this.colorBuffer, 0, colorData);
  }

  /**
   * 十六进制颜色转 RGBA
   */
  private hexToRgba(hex: string): Float32Array {
    // 移除 # 符号
    hex = hex.replace('#', '');

    // 处理短格式
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }

    // 处理带透明度的格式
    let r = 0, g = 0, b = 0, a = 1.0;

    if (hex.length === 8) {
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
      a = parseInt(hex.substring(6, 8), 16) / 255;
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
    }

    return new Float32Array([r, g, b, a]);
  }

  /**
   * 屏幕坐标转世界坐标
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    // Canvas 内部分辨率
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    // Canvas 显示尺寸
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    
    // 计算缩放比例
    const scaleX = canvasWidth / displayWidth;
    const scaleY = canvasHeight / displayHeight;
    
    // 将鼠标坐标从显示尺寸转换为内部分辨率
    const canvasX = screenX * scaleX;
    const canvasY = screenY * scaleY;

    const zoom = this.viewTransform.zoom;
    const worldX = (canvasX - canvasWidth / 2) / zoom + this.viewTransform.x;
    const worldY = (canvasY - canvasHeight / 2) / zoom + this.viewTransform.y;

    return { x: worldX, y: worldY };
  }

  /**
   * 屏幕坐标转网格坐标
   */
  screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
    const world = this.screenToWorld(screenX, screenY);
    return {
      x: Math.floor(world.x / this.gridSettings.cellWidth),
      y: Math.floor(world.y / this.gridSettings.cellHeight),
    };
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
    }
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
    }
    if (this.colorBuffer) {
      this.colorBuffer.destroy();
    }
  }
}

