import { TextureLoader } from './TextureLoader';

/**
 * 动画配置
 */
export interface AnimationConfig {
  name: string;
  frames: string[]; // 帧图片路径列表
  fps?: number; // 帧率，默认20
}

/**
 * 播放模式
 */
export type LoopMode = 'once' | 'loop';

/**
 * 精灵动画类
 * 负责管理和播放序列帧动画
 */
export class SpriteAnimation {
  private textureLoader: TextureLoader;
  private animations: Map<string, AnimationConfig> = new Map();
  private currentAnimation: string | null = null;
  private currentFrame: number = 0;
  private isPlaying: boolean = false;
  private lastFrameTime: number = 0;
  private textures: Map<string, GPUTexture[]> = new Map();
  private loadedAnimations: Set<string> = new Set();
  private loopMode: LoopMode = 'loop'; // 默认循环播放

  constructor(textureLoader: TextureLoader) {
    this.textureLoader = textureLoader;
  }

  /**
   * 添加动画配置
   */
  addAnimation(config: AnimationConfig) {
    this.animations.set(config.name, config);
  }

  /**
   * 加载动画资源
   */
  async loadAnimation(animationName: string): Promise<boolean> {
    const config = this.animations.get(animationName);
    if (!config) {
      console.error(`动画不存在: ${animationName}`);
      return false;
    }

    if (this.loadedAnimations.has(animationName)) {
      return true;
    }

    try {
      console.log(`加载动画: ${animationName}, 共 ${config.frames.length} 帧`);
      const textures = await this.textureLoader.loadTextures(config.frames);
      
      // 检查是否所有纹理都加载成功
      if (textures.some(t => t === null)) {
        console.error(`动画 ${animationName} 部分帧加载失败`);
        return false;
      }

      this.textures.set(animationName, textures as GPUTexture[]);
      this.loadedAnimations.add(animationName);
      console.log(`动画 ${animationName} 加载成功`);
      return true;
    } catch (error) {
      console.error(`加载动画失败: ${animationName}`, error);
      return false;
    }
  }

  /**
   * 播放动画
   */
  play(animationName: string) {
    if (!this.loadedAnimations.has(animationName)) {
      console.error(`动画未加载: ${animationName}`);
      return;
    }

    if (this.currentAnimation !== animationName) {
      this.currentAnimation = animationName;
      this.currentFrame = 0;
      this.lastFrameTime = performance.now();
    }

    this.isPlaying = true;
    console.log(`播放动画: ${animationName}`);
  }

  /**
   * 暂停动画
   */
  pause() {
    this.isPlaying = false;
    console.log('动画已暂停');
  }

  /**
   * 停止动画（重置到第一帧）
   */
  stop() {
    this.isPlaying = false;
    this.currentFrame = 0;
    console.log('动画已停止');
  }

  /**
   * 更新动画（每帧调用）
   */
  update(currentTime: number): boolean {
    if (!this.isPlaying || !this.currentAnimation) {
      return false;
    }

    const config = this.animations.get(this.currentAnimation);
    if (!config) {
      return false;
    }

    // 计算当前动画的帧间隔（使用动画自己的fps设置）
    const fps = config.fps || 20;
    const frameInterval = 1000 / fps;

    // 检查是否需要切换到下一帧
    if (currentTime - this.lastFrameTime >= frameInterval) {
      const nextFrame = this.currentFrame + 1;
      
      // 根据播放模式处理帧切换
      if (this.loopMode === 'once') {
        // 单次播放：到达最后一帧后停止
        if (nextFrame >= config.frames.length) {
          this.isPlaying = false;
          console.log('动画播放完成（单次）');
          return true;
        }
        this.currentFrame = nextFrame;
      } else {
        // 循环播放：回到第一帧
        this.currentFrame = nextFrame % config.frames.length;
      }
      
      this.lastFrameTime = currentTime;
      return true; // 表示需要重新渲染
    }

    return false;
  }

  /**
   * 获取当前帧的纹理
   */
  getCurrentTexture(): GPUTexture | null {
    if (!this.currentAnimation) {
      return null;
    }

    const textures = this.textures.get(this.currentAnimation);
    if (!textures || textures.length === 0) {
      return null;
    }

    return textures[this.currentFrame];
  }

  /**
   * 获取当前帧索引
   */
  getCurrentFrame(): number {
    return this.currentFrame;
  }

  /**
   * 获取当前动画名称
   */
  getCurrentAnimationName(): string | null {
    return this.currentAnimation;
  }

  /**
   * 是否正在播放
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * 获取当前动画的总帧数
   */
  getTotalFrames(): number {
    if (!this.currentAnimation) {
      return 0;
    }
    const config = this.animations.get(this.currentAnimation);
    return config ? config.frames.length : 0;
  }

  /**
   * 获取所有已加载的动画名称
   */
  getLoadedAnimations(): string[] {
    return Array.from(this.loadedAnimations);
  }

  /**
   * 获取所有动画配置
   */
  getAllAnimations(): string[] {
    return Array.from(this.animations.keys());
  }

  /**
   * 设置播放模式
   */
  setLoopMode(mode: LoopMode) {
    this.loopMode = mode;
    console.log(`播放模式已设置为: ${mode === 'once' ? '单次播放' : '循环播放'}`);
  }

  /**
   * 获取当前播放模式
   */
  getLoopMode(): LoopMode {
    return this.loopMode;
  }

  /**
   * 获取当前动画的FPS
   */
  getCurrentFPS(): number {
    if (!this.currentAnimation) {
      return 20; // 默认值
    }
    const config = this.animations.get(this.currentAnimation);
    return config?.fps || 20;
  }

  /**
   * 设置当前动画的FPS
   */
  setCurrentFPS(fps: number) {
    if (!this.currentAnimation) {
      return;
    }
    const config = this.animations.get(this.currentAnimation);
    if (config) {
      config.fps = fps;
      console.log(`动画 ${this.currentAnimation} 的帧率已设置为: ${fps} FPS`);
    }
  }

  /**
   * 获取指定动画的FPS
   */
  getAnimationFPS(animationName: string): number {
    const config = this.animations.get(animationName);
    return config?.fps || 20;
  }

  /**
   * 设置指定动画的FPS
   */
  setAnimationFPS(animationName: string, fps: number) {
    const config = this.animations.get(animationName);
    if (config) {
      config.fps = fps;
      console.log(`动画 ${animationName} 的帧率已设置为: ${fps} FPS`);
    }
  }
}

