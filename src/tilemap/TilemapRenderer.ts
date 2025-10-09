/**
 * Core WebGPU Tilemap Renderer for Infinite Canvas
 * Handles rendering of infinite grid with customizable appearance
 */

import {
  GridConfig,
  CanvasConfig,
  ViewTransform,
  TileMapViewport,
  RenderBounds,
  TilemapUniforms,
  RenderStats,
  GridHighlight,
  GridCell
} from './types';
import {
  createViewMatrix,
  calculateViewport,
  calculateVisibleBounds,
  screenToWorld,
  worldToScreen
} from './utils/math';
import { colorStringToRgba, rgbaToFloat32Array } from './utils/color';

// Import shaders
import vertexShaderSource from './shaders/vertex.wgsl?raw';
import fragmentShaderSource from './shaders/fragment.wgsl?raw';

export class TilemapRenderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private canvas: HTMLCanvasElement;
  private format: GPUTextureFormat;

  // WebGPU resources
  private pipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;

  // Grid data
  private gridConfig: GridConfig;
  private canvasConfig: CanvasConfig;
  private viewTransform: ViewTransform;

  // Rendering state
  private needsUpdate = true;
  private stats: RenderStats = {
    visibleGrids: 0,
    totalGrids: 0,
    fps: 0,
    frameTime: 0
  };

  // Performance tracking
  private lastFrameTime = performance.now();
  private frameCount = 0;
  private fpsUpdateTime = performance.now();

  // Grid highlighting
  private highlight: GridHighlight = { cell: null, visible: false };

  constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    gridConfig: GridConfig,
    canvasConfig: CanvasConfig
  ) {
    this.canvas = canvas;
    this.device = device;
    this.context = context;
    this.format = format;
    this.gridConfig = gridConfig;
    this.canvasConfig = canvasConfig;
    this.viewTransform = { x: 0, y: 0, zoom: 1.0 };
  }

  /**
   * Initialize the WebGPU renderer
   */
  async init(): Promise<void> {
    try {
      // Create shader module
      const shaderModule = this.device.createShaderModule({
        code: vertexShaderSource + '\n' + fragmentShaderSource,
      });

      // Create uniform buffer
      this.uniformBuffer = this.device.createBuffer({
        size: 256, // Enough space for all uniforms
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Define vertex buffer layouts
      const vertexBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 12, // position(2) + gridCoord(2) + instanceType(1) = 5 floats, padded to 12 bytes
        stepMode: 'vertex',
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' },  // position
          { shaderLocation: 1, offset: 8, format: 'sint32x2' },  // gridCoord
        ],
      };

      // Create render pipeline
      this.pipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [vertexBufferLayout],
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
        depthStencil: undefined,
        multisample: {
          count: 1,
        },
      });

      // Create bind group
      this.bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: this.uniformBuffer },
          },
        ],
      });

      console.log('Tilemap renderer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize tilemap renderer:', error);
      throw error;
    }
  }

  /**
   * Update the view transform
   */
  setViewTransform(transform: Partial<ViewTransform>): void {
    this.viewTransform = { ...this.viewTransform, ...transform };
    this.needsUpdate = true;
  }

  /**
   * Update grid configuration
   */
  updateGridConfig(config: Partial<GridConfig>): void {
    this.gridConfig = { ...this.gridConfig, ...config };
    this.needsUpdate = true;
  }

  /**
   * Update canvas configuration
   */
  updateCanvasConfig(config: Partial<CanvasConfig>): void {
    this.canvasConfig = { ...this.canvasConfig, ...config };
    this.needsUpdate = true;
  }

  /**
   * Set grid highlight
   */
  setHighlight(cell: GridCell | null): void {
    this.highlight = { cell, visible: cell !== null };
    this.needsUpdate = true;
  }

  /**
   * Main render method
   */
  render(): void {
    if (!this.pipeline || !this.uniformBuffer || !this.bindGroup) {
      console.warn('Renderer not properly initialized');
      return;
    }

    const startTime = performance.now();

    // Update uniforms if needed
    if (this.needsUpdate) {
      this.updateUniforms();
      this.needsUpdate = false;
    }

    // Calculate visible bounds
    const viewport = calculateViewport(this.viewTransform, this.canvas.width, this.canvas.height);
    const bounds = calculateVisibleBounds(viewport, this.canvasConfig.gridSize, this.gridConfig.borderWidth);

    // Create command encoder
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    // Begin render pass
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: this.getClearColor(),
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    // Set pipeline and bind group
    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);

    // Render visible grid cells
    this.renderGridCells(renderPass, bounds);

    // Render highlight if visible
    if (this.highlight.visible && this.highlight.cell) {
      this.renderHighlight(renderPass, this.highlight.cell);
    }

    renderPass.end();

    // Submit commands
    this.device.queue.submit([commandEncoder.finish()]);

    // Update stats
    this.updateStats(performance.now() - startTime);
  }

  /**
   * Render grid cells within bounds
   */
  private renderGridCells(renderPass: GPURenderPassEncoder, bounds: RenderBounds): void {
    const cellSize = this.canvasConfig.gridSize + this.gridConfig.borderWidth * 2;
    const vertices: number[] = [];
    const indices: number[] = [];

    let vertexCount = 0;
    let gridCount = 0;

    // Generate vertices for visible grid cells
    for (let row = bounds.startRow; row <= bounds.endRow; row++) {
      for (let col = bounds.startCol; col <= bounds.endCol; col++) {
        // Calculate cell position
        const x = col * cellSize;
        const y = row * cellSize;

        // Add quad vertices (normalized to -1 to 1)
        const halfSize = this.canvasConfig.gridSize / 2;
        vertices.push(
          // Top-left
          -1, -1, row, col,
          // Top-right
          1, -1, row, col,
          // Bottom-right
          1, 1, row, col,
          // Bottom-left
          -1, 1, row, col
        );

        // Add quad indices
        const baseIndex = vertexCount;
        indices.push(
          baseIndex, baseIndex + 1, baseIndex + 2,
          baseIndex, baseIndex + 2, baseIndex + 3
        );

        vertexCount += 4;
        gridCount++;
      }
    }

    if (vertices.length === 0) return;

    // Create and populate vertex buffer
    const vertexData = new Float32Array(vertices);
    const vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertexData);
    vertexBuffer.unmap();

    // Create and populate index buffer
    const indexData = new Uint16Array(indices);
    const indexBuffer = this.device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint16Array(indexBuffer.getMappedRange()).set(indexData);
    indexBuffer.unmap();

    // Draw
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indexBuffer, 'uint16');
    renderPass.drawIndexed(indices.length);

    // Update stats
    this.stats.visibleGrids = gridCount;
    this.stats.totalGrids = this.gridConfig.rows * this.gridConfig.columns;

    // Clean up buffers (they'll be garbage collected)
    vertexBuffer.destroy();
    indexBuffer.destroy();
  }

  /**
   * Render highlighted cell
   */
  private renderHighlight(renderPass: GPURenderPassEncoder, cell: GridCell): void {
    const cellSize = this.canvasConfig.gridSize + this.gridConfig.borderWidth * 2;
    const x = cell.column * cellSize;
    const y = cell.row * cellSize;

    // Create highlight quad
    const vertices = new Float32Array([
      -1, -1, cell.row, cell.column,
      1, -1, cell.row, cell.column,
      1, 1, cell.row, cell.column,
      -1, 1, cell.row, cell.column,
    ]);

    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    // Create buffers
    const vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
    vertexBuffer.unmap();

    const indexBuffer = this.device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint16Array(indexBuffer.getMappedRange()).set(indices);
    indexBuffer.unmap();

    // Draw highlight
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indexBuffer, 'uint16');
    renderPass.drawIndexed(6);

    // Clean up
    vertexBuffer.destroy();
    indexBuffer.destroy();
  }

  /**
   * Update uniform buffer
   */
  private updateUniforms(): void {
    if (!this.uniformBuffer) return;

    const viewMatrix = createViewMatrix(this.viewTransform);
    const gridSize = new Float32Array([this.canvasConfig.gridSize, this.canvasConfig.gridSize]);
    const gridConfig = new Float32Array([
      this.gridConfig.rows,
      this.gridConfig.columns,
      this.gridConfig.borderWidth,
      0 // padding
    ]);

    const gridColor = rgbaToFloat32Array(colorStringToRgba(this.gridConfig.borderColor));
    const backgroundColor = rgbaToFloat32Array(colorStringToRgba(this.canvasConfig.backgroundColor));

    // Combine all uniforms into a single buffer
    const uniformData = new Float32Array(64); // 256 bytes / 4 bytes per float
    uniformData.set(viewMatrix, 0);
    uniformData.set(gridSize, 9);
    uniformData.set(gridConfig, 11);
    uniformData.set(gridColor, 15);
    uniformData.set(backgroundColor, 19);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  /**
   * Get clear color based on canvas config
   */
  private getClearColor(): GPUColorDict {
    const color = colorStringToRgba(this.canvasConfig.backgroundColor);
    return {
      r: color.r,
      g: color.g,
      b: color.b,
      a: color.a,
    };
  }

  /**
   * Update performance stats
   */
  private updateStats(frameTime: number): void {
    this.stats.frameTime = frameTime;
    this.frameCount++;

    const now = performance.now();
    if (now - this.fpsUpdateTime >= 1000) {
      this.stats.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }
  }

  /**
   * Get current render stats
   */
  getStats(): RenderStats {
    return { ...this.stats };
  }

  /**
   * Convert screen coordinates to grid coordinates
   */
  screenToGrid(screenX: number, screenY: number): GridCell | null {
    const world = screenToWorld(screenX, screenY, this.viewTransform, this.canvas.width, this.canvas.height);
    const cellSize = this.canvasConfig.gridSize + this.gridConfig.borderWidth * 2;

    const column = Math.floor(world.x / cellSize);
    const row = Math.floor(world.y / cellSize);

    // Check if within grid bounds
    if (row >= 0 && row < this.gridConfig.rows && column >= 0 && column < this.gridConfig.columns) {
      return {
        x: column * cellSize,
        y: row * cellSize,
        row,
        column
      };
    }

    return null;
  }

  /**
   * Get current view transform
   */
  getViewTransform(): ViewTransform {
    return { ...this.viewTransform };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }
    this.pipeline = null;
    this.bindGroup = null;
  }
}
