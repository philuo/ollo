/**
 * 欢迎引导页面
 * 为新用户提供快速入门指南
 */

import { createSignal, Show, For } from 'solid-js';
import './WelcomeGuide.css';

export interface WelcomeGuideProps {
  onClose: () => void;
  onSelectMode: (mode: string) => void;
}

export default function WelcomeGuide(props: WelcomeGuideProps) {
  const [currentStep, setCurrentStep] = createSignal(0);

  const steps = [
    {
      title: '欢迎使用 Ollo Game Tools',
      icon: '👋',
      content: '这是一套专业的游戏资源制作工具，包含动画播放器、雪碧图合成和 TileMap 编辑器。',
      action: '开始了解',
    },
    {
      title: '动画播放器',
      icon: '🎬',
      content: '使用 WebGPU 实时预览和播放精灵动画，支持多种播放模式和性能监控。',
      features: [
        '实时预览动画效果',
        '支持多种播放模式（循环、往返、单次）',
        'WebGPU 硬件加速渲染',
        '帧率和性能监控',
      ],
      action: '试用播放器',
      mode: 'player',
    },
    {
      title: '雪碧图合成',
      icon: '🎨',
      content: '强大的雪碧图合成工具，支持批量处理、实时预览和多种导出格式。',
      features: [
        '批量导入序列帧',
        'KTX2 高效压缩',
        '实时预览合成效果',
        '多格式导出（PNG, KTX2）',
      ],
      action: '开始合成',
      mode: 'composer',
    },
    {
      title: 'TileMap 编辑器',
      icon: '🗺️',
      content: '基于 WebGPU 的 2D 地图编辑器，智能识别瓦片网格，支持多图层编辑。',
      features: [
        '智能网格自动检测',
        '多图层独立编辑',
        '高性能 WebGPU 渲染',
        'RLE 压缩，体积极小',
      ],
      action: '创建地图',
      mode: 'tilemap',
    },
  ];

  const handleNext = () => {
    if (currentStep() < steps.length - 1) {
      setCurrentStep(currentStep() + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep() > 0) {
      setCurrentStep(currentStep() - 1);
    }
  };

  const handleAction = () => {
    const step = steps[currentStep()];
    if (step.mode) {
      props.onSelectMode(step.mode);
      props.onClose();
    } else {
      handleNext();
    }
  };

  return (
    <div class="welcome-guide-overlay" onClick={props.onClose}>
      <div class="welcome-guide" onClick={(e) => e.stopPropagation()}>
        <button class="close-button" onClick={props.onClose}>
          ✕
        </button>

        <div class="guide-content">
          <div class="step-indicator">
            <For each={steps}>
              {(_, index) => (
                <div
                  class={`indicator-dot ${currentStep() === index() ? 'active' : ''} ${currentStep() > index() ? 'completed' : ''}`}
                  onClick={() => setCurrentStep(index())}
                />
              )}
            </For>
          </div>

          <div class="step-content">
            <div class="step-icon">{steps[currentStep()].icon}</div>
            <h2 class="step-title">{steps[currentStep()].title}</h2>
            <p class="step-description">{steps[currentStep()].content}</p>

            <Show when={steps[currentStep()].features}>
              <ul class="step-features">
                <For each={steps[currentStep()].features}>
                  {(feature) => (
                    <li>
                      <span class="feature-check">✓</span>
                      {feature}
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>

          <div class="guide-actions">
            <button
              class="guide-button secondary"
              onClick={handlePrev}
              disabled={currentStep() === 0}
            >
              上一步
            </button>
            <button
              class="guide-button primary"
              onClick={handleAction}
            >
              {steps[currentStep()].action}
            </button>
            <Show when={currentStep() < steps.length - 1}>
              <button
                class="guide-button secondary"
                onClick={props.onClose}
              >
                跳过
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

