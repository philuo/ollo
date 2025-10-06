import { Renderer } from './Renderer';
import { TextureLoader } from './TextureLoader';
import { SpriteAnimation, AnimationConfig, LoopMode } from './SpriteAnimation';
import { SpriteRenderer } from './SpriteRenderer';

/**
 * 角色配置
 */
export interface CharacterConfig {
  name: string;
  basePath: string; // 角色资源基础路径
  animations: {
    name: string;
    folderName: string; // 动画文件夹名称
    frameCount: number; // 帧数
  }[];
}

/**
 * 角色控制器
 * 统一管理角色的加载、动画播放等
 */
export class CharacterController {
  private renderer: Renderer;
  private textureLoader!: TextureLoader;
  private spriteAnimation!: SpriteAnimation;
  private spriteRenderer!: SpriteRenderer;
  private currentCharacter: string | null = null;
  private characters: Map<string, CharacterConfig> = new Map();
  private animationLoopId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
  }

  /**
   * 初始化控制器
   */
  async init(): Promise<boolean> {
    const success = await this.renderer.init();
    if (!success) {
      return false;
    }

    // 在 Renderer 初始化成功后再创建其他组件
    this.textureLoader = new TextureLoader(this.renderer.getDevice());
    this.spriteAnimation = new SpriteAnimation(this.textureLoader);
    this.spriteRenderer = new SpriteRenderer(this.renderer);
    this.spriteRenderer.init();
    
    return true;
  }

  /**
   * 注册角色
   */
  registerCharacter(config: CharacterConfig) {
    this.characters.set(config.name, config);

    // 为角色的每个动画创建配置
    for (const anim of config.animations) {
      const frames: string[] = [];
      for (let i = 1; i <= anim.frameCount; i++) {
        frames.push(`${config.basePath}/${anim.folderName}/${i}.png`);
      }

      const animConfig: AnimationConfig = {
        name: `${config.name}_${anim.name}`,
        frames,
        fps: 20, // 20 FPS
      };

      this.spriteAnimation.addAnimation(animConfig);
    }

    console.log(`角色已注册: ${config.name}`);
  }

  /**
   * 加载角色（加载所有动画）
   */
  async loadCharacter(characterName: string): Promise<boolean> {
    const config = this.characters.get(characterName);
    if (!config) {
      console.error(`角色不存在: ${characterName}`);
      return false;
    }

    console.log(`开始加载角色: ${characterName}`);

    // 加载所有动画
    const loadPromises = config.animations.map(anim => {
      const animName = `${config.name}_${anim.name}`;
      return this.spriteAnimation.loadAnimation(animName);
    });

    const results = await Promise.all(loadPromises);

    if (results.every(r => r)) {
      this.currentCharacter = characterName;
      console.log(`角色加载成功: ${characterName}`);
      return true;
    } else {
      console.error(`角色加载失败: ${characterName}`);
      return false;
    }
  }

  /**
   * 播放动画
   */
  playAnimation(animationName: string) {
    if (!this.currentCharacter) {
      console.error('未加载任何角色');
      return;
    }

    const fullAnimName = `${this.currentCharacter}_${animationName}`;
    this.spriteAnimation.play(fullAnimName);
    this.startRenderLoop();
  }

  /**
   * 暂停动画
   */
  pauseAnimation() {
    this.spriteAnimation.pause();
  }

  /**
   * 停止动画
   */
  stopAnimation() {
    this.spriteAnimation.stop();
    if (this.animationLoopId !== null) {
      cancelAnimationFrame(this.animationLoopId);
      this.animationLoopId = null;
    }
  }

  /**
   * 开始渲染循环
   */
  private startRenderLoop() {
    if (this.animationLoopId !== null) {
      return; // 已经在运行
    }

    const renderLoop = (currentTime: number) => {
      // 更新动画
      this.spriteAnimation.update(currentTime);

      // 渲染当前帧
      const texture = this.spriteAnimation.getCurrentTexture();
      if (texture) {
        this.spriteRenderer.render(texture);
      }

      // 继续循环
      if (this.spriteAnimation.getIsPlaying()) {
        this.animationLoopId = requestAnimationFrame(renderLoop);
      } else {
        this.animationLoopId = null;
      }
    };

    this.animationLoopId = requestAnimationFrame(renderLoop);
  }

  /**
   * 获取当前角色名称
   */
  getCurrentCharacter(): string | null {
    return this.currentCharacter;
  }

  /**
   * 获取当前角色的所有动画
   */
  getCurrentCharacterAnimations(): string[] {
    if (!this.currentCharacter) {
      return [];
    }

    const config = this.characters.get(this.currentCharacter);
    if (!config) {
      return [];
    }

    return config.animations.map(a => a.name);
  }

  /**
   * 获取动画播放状态
   */
  getAnimationStatus() {
    return {
      isPlaying: this.spriteAnimation.getIsPlaying(),
      currentAnimation: this.spriteAnimation.getCurrentAnimationName(),
      currentFrame: this.spriteAnimation.getCurrentFrame(),
      totalFrames: this.spriteAnimation.getTotalFrames(),
    };
  }

  /**
   * 获取所有注册的角色
   */
  getAllCharacters(): string[] {
    return Array.from(this.characters.keys());
  }

  /**
   * 设置播放模式
   */
  setLoopMode(mode: LoopMode) {
    this.spriteAnimation.setLoopMode(mode);
  }

  /**
   * 获取当前播放模式
   */
  getLoopMode(): LoopMode {
    return this.spriteAnimation.getLoopMode();
  }

  /**
   * 获取当前动画的FPS
   */
  getCurrentFPS(): number {
    return this.spriteAnimation.getCurrentFPS();
  }

  /**
   * 设置当前动画的FPS
   */
  setCurrentFPS(fps: number) {
    this.spriteAnimation.setCurrentFPS(fps);
  }

  /**
   * 获取指定动画的FPS
   */
  getAnimationFPS(animationName: string): number {
    if (!this.currentCharacter) {
      return 20;
    }
    const fullAnimName = `${this.currentCharacter}_${animationName}`;
    return this.spriteAnimation.getAnimationFPS(fullAnimName);
  }

  /**
   * 设置指定动画的FPS
   */
  setAnimationFPS(animationName: string, fps: number) {
    if (!this.currentCharacter) {
      return;
    }
    const fullAnimName = `${this.currentCharacter}_${animationName}`;
    this.spriteAnimation.setAnimationFPS(fullAnimName, fps);
  }

  /**
   * 跳转到指定帧
   */
  goToFrame(frameIndex: number) {
    this.spriteAnimation.goToFrame(frameIndex);
    // 如果当前没有在播放，手动渲染一次
    if (!this.spriteAnimation.getIsPlaying()) {
      const texture = this.spriteAnimation.getCurrentTexture();
      if (texture) {
        this.spriteRenderer.render(texture);
      }
    }
  }

  /**
   * 获取当前动画的所有帧路径
   */
  getCurrentFramePaths(): string[] {
    return this.spriteAnimation.getCurrentFramePaths();
  }

  /**
   * 获取指定动画的所有帧路径
   */
  getAnimationFramePaths(animationName: string): string[] {
    if (!this.currentCharacter) {
      return [];
    }
    const fullAnimName = `${this.currentCharacter}_${animationName}`;
    return this.spriteAnimation.getAnimationFramePaths(fullAnimName);
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopAnimation();
    this.textureLoader.clearCache();
  }
}

