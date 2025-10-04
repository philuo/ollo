/**
 * 纹理加载器
 * 负责加载和管理纹理资源
 */
export class TextureLoader {
  private device: GPUDevice;
  private textureCache: Map<string, GPUTexture> = new Map();

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * 加载图片纹理
   */
  async loadTexture(url: string): Promise<GPUTexture | null> {
    // 检查缓存
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url)!;
    }

    try {
      // 加载图片
      const img = await this.loadImage(url);

      // 创建纹理
      const texture = this.device.createTexture({
        size: [img.width, img.height, 1],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // 将图片数据写入纹理
      const imageBitmap = await createImageBitmap(img);
      this.device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture },
        [img.width, img.height]
      );

      // 缓存纹理
      this.textureCache.set(url, texture);

      return texture;
    } catch (error) {
      console.error(`加载纹理失败: ${url}`, error);
      return null;
    }
  }

  /**
   * 加载多个图片纹理（批量加载）
   */
  async loadTextures(urls: string[]): Promise<(GPUTexture | null)[]> {
    const promises = urls.map(url => this.loadTexture(url));
    return Promise.all(promises);
  }

  /**
   * 加载图片
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  /**
   * 创建纹理绑定组
   */
  createTextureBindGroup(
    texture: GPUTexture,
    pipeline: GPURenderPipeline,
    groupIndex: number = 0
  ): GPUBindGroup {
    const sampler = this.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      mipmapFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(groupIndex),
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
  }

  /**
   * 清理缓存
   */
  clearCache() {
    for (const texture of this.textureCache.values()) {
      texture.destroy();
    }
    this.textureCache.clear();
  }

  /**
   * 获取缓存的纹理
   */
  getCachedTexture(url: string): GPUTexture | undefined {
    return this.textureCache.get(url);
  }
}

