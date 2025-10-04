import { onMount, createSignal, For, Show } from 'solid-js';
import { CharacterController } from './webgpu/CharacterController';
import './App.css';

export default function App() {
  let canvasRef: HTMLCanvasElement | undefined;
  let controller: CharacterController | undefined;

  const [isInitialized, setIsInitialized] = createSignal(false);
  const [currentCharacter, setCurrentCharacter] = createSignal<string | null>(null);
  const [availableAnimations, setAvailableAnimations] = createSignal<string[]>([]);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentAnimation, setCurrentAnimation] = createSignal<string | null>(null);
  const [currentFrame, setCurrentFrame] = createSignal(0);
  const [totalFrames, setTotalFrames] = createSignal(0);
  const [isLoading, setIsLoading] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  // 所有可用角色配置
  const characters = [
    {
      name: 'Player',
      displayName: '玩家 - Bomb Guy',
      basePath: '/src/sprites/1-Player-Bomb Guy',
      animations: [
        { name: 'Idle', folderName: '1-Idle', frameCount: 26 },
        { name: 'Run', folderName: '2-Run', frameCount: 14 },
        { name: 'Jump_Anticipation', folderName: '3-Jump Anticipation', frameCount: 1 },
        { name: 'Jump', folderName: '4-Jump', frameCount: 4 },
        { name: 'Fall', folderName: '5-Fall', frameCount: 2 },
        { name: 'Ground', folderName: '6-Ground', frameCount: 3 },
        { name: 'Hit', folderName: '7-Hit', frameCount: 8 },
        { name: 'Dead_Hit', folderName: '8-Dead Hit', frameCount: 6 },
        { name: 'Dead_Ground', folderName: '9-Dead Ground', frameCount: 4 },
        { name: 'Door_In', folderName: '10-Door In', frameCount: 16 },
        { name: 'Door_Out', folderName: '11-Door Out', frameCount: 16 },
      ],
    },
    {
      name: 'Pirate',
      displayName: '敌人 - Bald Pirate',
      basePath: '/src/sprites/2-Enemy-Bald Pirate',
      animations: [
        { name: 'Idle', folderName: '1-Idle', frameCount: 34 },
        { name: 'Run', folderName: '2-Run', frameCount: 14 },
        { name: 'Jump_Anticipation', folderName: '3-Jump Anticipation', frameCount: 1 },
        { name: 'Jump', folderName: '4-Jump', frameCount: 4 },
        { name: 'Fall', folderName: '5-Fall', frameCount: 2 },
        { name: 'Ground', folderName: '6-Ground', frameCount: 3 },
        { name: 'Attack', folderName: '7-Attack', frameCount: 12 },
        { name: 'Hit', folderName: '8-Hit', frameCount: 8 },
        { name: 'Dead_Hit', folderName: '9-Dead Hit', frameCount: 6 },
        { name: 'Dead_Ground', folderName: '10-Dead Ground', frameCount: 4 },
      ],
    },
    {
      name: 'Cucumber',
      displayName: '敌人 - Cucumber',
      basePath: '/src/sprites/3-Enemy-Cucumber',
      animations: [
        { name: 'Idle', folderName: '1-Idle', frameCount: 36 },
        { name: 'Run', folderName: '2-Run', frameCount: 12 },
        { name: 'Jump_Anticipation', folderName: '3-Jump Anticipation', frameCount: 1 },
        { name: 'Jump', folderName: '4-Jump', frameCount: 4 },
        { name: 'Fall', folderName: '5-Fall', frameCount: 2 },
        { name: 'Ground', folderName: '6-Ground', frameCount: 3 },
        { name: 'Attack', folderName: '7-Attack', frameCount: 11 },
        { name: 'Blow_Wick', folderName: '8-Blow the wick', frameCount: 11 },
        { name: 'Hit', folderName: '9-Hit', frameCount: 8 },
        { name: 'Dead_Hit', folderName: '10-Dead Hit', frameCount: 6 },
        { name: 'Dead_Ground', folderName: '11-Dead Ground', frameCount: 4 },
      ],
    },
  ];

  onMount(async () => {
    if (!canvasRef) return;

    try {
      // 创建控制器
      controller = new CharacterController(canvasRef);

      // 初始化 WebGPU
      const success = await controller.init();
      if (!success) {
        setErrorMessage('WebGPU 初始化失败，请确保您的浏览器支持 WebGPU');
        return;
      }

      // 注册所有角色
      characters.forEach(char => {
        controller!.registerCharacter(char);
      });

      setIsInitialized(true);
      console.log('应用初始化成功');
    } catch (error) {
      console.error('初始化失败:', error);
      setErrorMessage('初始化失败: ' + (error as Error).message);
    }
  });

  // 加载角色
  const loadCharacter = async (characterName: string) => {
    if (!controller) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const success = await controller.loadCharacter(characterName);
      if (success) {
        setCurrentCharacter(characterName);
        setAvailableAnimations(controller.getCurrentCharacterAnimations());
        setIsPlaying(false);
        setCurrentAnimation(null);
      } else {
        setErrorMessage('角色加载失败');
      }
    } catch (error) {
      console.error('加载角色失败:', error);
      setErrorMessage('加载角色失败: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // 播放动画
  const playAnimation = (animName: string) => {
    if (!controller) return;

    controller.playAnimation(animName);
    setCurrentAnimation(animName);
    setIsPlaying(true);

    // 启动状态更新
    startStatusUpdate();
  };

  // 暂停动画
  const pauseAnimation = () => {
    if (!controller) return;

    controller.pauseAnimation();
    setIsPlaying(false);
  };

  // 继续播放
  const resumeAnimation = () => {
    if (!controller || !currentAnimation()) return;

    controller.playAnimation(currentAnimation()!);
    setIsPlaying(true);
    startStatusUpdate();
  };

  // 停止动画
  const stopAnimation = () => {
    if (!controller) return;

    controller.stopAnimation();
    setIsPlaying(false);
    setCurrentAnimation(null);
    setCurrentFrame(0);
    setTotalFrames(0);
  };

  // 更新状态信息
  let statusUpdateInterval: number | null = null;
  const startStatusUpdate = () => {
    if (statusUpdateInterval !== null) return;

    statusUpdateInterval = window.setInterval(() => {
      if (!controller) return;

      const status = controller.getAnimationStatus();
      setCurrentFrame(status.currentFrame);
      setTotalFrames(status.totalFrames);

      if (!status.isPlaying) {
        if (statusUpdateInterval !== null) {
          clearInterval(statusUpdateInterval);
          statusUpdateInterval = null;
        }
      }
    }, 100);
  };

  return (
    <div class="app-container">
      <h1>WebGPU 精灵动画播放器</h1>

      <div class="main-content">
        {/* Canvas 区域 */}
        <div class="canvas-container">
          <canvas ref={canvasRef} width={800} height={800} />
        </div>

        {/* 控制面板 */}
        <div class="control-panel">
          <Show when={errorMessage()}>
            <div class="error-message">{errorMessage()}</div>
          </Show>

          <Show when={!isInitialized()}>
            <div class="loading">正在初始化 WebGPU...</div>
          </Show>

          <Show when={isInitialized()}>
            {/* 角色选择 */}
            <div class="section">
              <h2>选择角色</h2>
              <div class="button-group">
                <For each={characters}>
                  {char => (
                    <button
                      onClick={() => loadCharacter(char.name)}
                      disabled={isLoading()}
                      classList={{
                        active: currentCharacter() === char.name,
                      }}
                    >
                      {char.displayName}
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* 动画控制 */}
            <Show when={currentCharacter()}>
              <div class="section">
                <h2>选择动画</h2>
                <div class="animation-list">
                  <For each={availableAnimations()}>
                    {anim => (
                      <button
                        onClick={() => playAnimation(anim)}
                        disabled={isPlaying()}
                        classList={{
                          active: currentAnimation() === anim,
                        }}
                      >
                        {anim.replace(/_/g, ' ')}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* 播放控制 */}
              <div class="section">
                <h2>播放控制</h2>
                <div class="playback-controls">
                  <Show when={!isPlaying()}>
                    <button onClick={resumeAnimation} disabled={!currentAnimation()}>
                      ▶ 播放
                    </button>
                  </Show>
                  <Show when={isPlaying()}>
                    <button onClick={pauseAnimation}>⏸ 暂停</button>
                  </Show>
                  <button onClick={stopAnimation} disabled={!currentAnimation()}>
                    ⏹ 停止
                  </button>
                </div>
              </div>

              {/* 状态信息 */}
              <Show when={currentAnimation()}>
                <div class="section">
                  <h2>动画信息</h2>
                  <div class="info">
                    <p>当前动画: {currentAnimation()?.replace(/_/g, ' ')}</p>
                    <p>
                      当前帧: {currentFrame() + 1} / {totalFrames()}
                    </p>
                    <p>帧率: 20 FPS (50ms/帧)</p>
                    <p>状态: {isPlaying() ? '播放中' : '已暂停'}</p>
                  </div>
                </div>
              </Show>
            </Show>
          </Show>

          <Show when={isLoading()}>
            <div class="loading">正在加载角色资源...</div>
          </Show>
        </div>
      </div>
    </div>
  );
}
