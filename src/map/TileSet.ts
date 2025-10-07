/**
 * TileSet 管理类
 * 处理瓦片集的加载、管理和渲染
 */

import { GridDetector, GridDetectionResult } from './GridDetector';
import { TileSetDefinition } from './TileMapData';

/**
 * 瓦片集类
 */
export class TileSet {
  private definition: TileSetDefinition;
  private image: HTMLImageElement | null = null;
  private texture: GPUTexture | null = null;
  private device: GPUDevice | null = null;

  constructor(definition: TileSetDefinition) {
    this.definition = definition;
  }

  /**
   * 从文件创建瓦片集
   */
  static async createFromFile(
    file: File,
    id: number,
    device: GPUDevice
  ): Promise<TileSet | null> {
    try {
      // 读取文件为 URL
      const imageUrl = URL.createObjectURL(file);
      const img = await this.loadImage(imageUrl);

      // 自动检测网格
      const gridResult = await GridDetector.detectGrid(imageUrl);
      
      if (!gridResult) {
        console.error('Failed to detect grid');
        return null;
      }

      // 读取为 base64（用于导出）
      const imageData = await this.fileToBase64(file);

      const definition: TileSetDefinition = {
        id,
        name: file.name,
        imageUrl,
        imageData,
        tileWidth: gridResult.tileWidth,
        tileHeight: gridResult.tileHeight,
        columns: gridResult.columns,
        rows: gridResult.rows,
        spacing: gridResult.spacing,
        margin: gridResult.margin,
      };

      const tileSet = new TileSet(definition);
      await tileSet.loadTexture(device);
      
      return tileSet;
    } catch (error) {
      console.error('Failed to create tileset from file:', error);
      return null;
    }
  }

  /**
   * 从定义创建瓦片集
   */
  static async createFromDefinition(
    definition: TileSetDefinition,
    device: GPUDevice
  ): Promise<TileSet | null> {
    try {
      const tileSet = new TileSet(definition);
      
      // 如果有 imageData，使用它；否则使用 imageUrl
      if (definition.imageData && !definition.imageUrl) {
        // 从 base64 创建 URL
        const blob = await fetch(definition.imageData).then(r => r.blob());
        definition.imageUrl = URL.createObjectURL(blob);
      }
      
      await tileSet.loadTexture(device);
      return tileSet;
    } catch (error) {
      console.error('Failed to create tileset from definition:', error);
      return null;
    }
  }

  /**
   * 加载纹理
   */
  async loadTexture(device: GPUDevice): Promise<void> {
    this.device = device;
    
    if (!this.definition.imageUrl) {
      throw new Error('No image URL');
    }

    this.image = await TileSet.loadImage(this.definition.imageUrl);

    // 创建 WebGPU 纹理
    this.texture = device.createTexture({
      size: [this.image.width, this.image.height, 1],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // 将图片数据写入纹理
    const imageBitmap = await createImageBitmap(this.image);
    device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: this.texture },
      [this.image.width, this.image.height]
    );
  }

  /**
   * 更新网格参数
   */
  updateGrid(
    tileWidth: number,
    tileHeight: number,
    spacing: number = 0,
    margin: number = 0
  ): void {
    if (!this.image) return;

    this.definition.tileWidth = tileWidth;
    this.definition.tileHeight = tileHeight;
    this.definition.spacing = spacing;
    this.definition.margin = margin;
    
    // 重新计算列数和行数
    this.definition.columns = Math.floor(
      (this.image.width - 2 * margin + spacing) / (tileWidth + spacing)
    );
    this.definition.rows = Math.floor(
      (this.image.height - 2 * margin + spacing) / (tileHeight + spacing)
    );
  }

  /**
   * 获取瓦片的纹理坐标
   */
  getTileUV(tileIndex: number): { u: number; v: number; w: number; h: number } | null {
    if (!this.image) return null;

    const col = tileIndex % this.definition.columns;
    const row = Math.floor(tileIndex / this.definition.columns);

    if (row >= this.definition.rows) {
      return null;
    }

    const x = this.definition.margin + col * (this.definition.tileWidth + this.definition.spacing);
    const y = this.definition.margin + row * (this.definition.tileHeight + this.definition.spacing);

    return {
      u: x / this.image.width,
      v: y / this.image.height,
      w: this.definition.tileWidth / this.image.width,
      h: this.definition.tileHeight / this.image.height,
    };
  }

  /**
   * 获取瓦片总数
   */
  getTileCount(): number {
    return this.definition.columns * this.definition.rows;
  }

  /**
   * 获取定义
   */
  getDefinition(): TileSetDefinition {
    return this.definition;
  }

  /**
   * 获取纹理
   */
  getTexture(): GPUTexture | null {
    return this.texture;
  }

  /**
   * 获取图片
   */
  getImage(): HTMLImageElement | null {
    return this.image;
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.texture) {
      this.texture.destroy();
      this.texture = null;
    }
    if (this.definition.imageUrl && this.definition.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.definition.imageUrl);
    }
  }

  /**
   * 加载图片
   */
  private static loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  /**
   * 文件转 base64
   */
  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

/**
 * TileSet 管理器
 */
export class TileSetManager {
  private tileSets: Map<number, TileSet> = new Map();
  private nextId = 0;

  /**
   * 添加瓦片集
   */
  addTileSet(tileSet: TileSet): number {
    const id = tileSet.getDefinition().id >= 0 ? tileSet.getDefinition().id : this.nextId++;
    this.tileSets.set(id, tileSet);
    return id;
  }

  /**
   * 获取瓦片集
   */
  getTileSet(id: number): TileSet | undefined {
    return this.tileSets.get(id);
  }

  /**
   * 移除瓦片集
   */
  removeTileSet(id: number): void {
    const tileSet = this.tileSets.get(id);
    if (tileSet) {
      tileSet.destroy();
      this.tileSets.delete(id);
    }
  }

  /**
   * 获取所有瓦片集
   */
  getAllTileSets(): TileSet[] {
    return Array.from(this.tileSets.values());
  }

  /**
   * 清空
   */
  clear(): void {
    for (const tileSet of this.tileSets.values()) {
      tileSet.destroy();
    }
    this.tileSets.clear();
    this.nextId = 0;
  }

  /**
   * 获取瓦片集定义列表
   */
  getDefinitions(): TileSetDefinition[] {
    return Array.from(this.tileSets.values()).map(ts => ts.getDefinition());
  }
}

