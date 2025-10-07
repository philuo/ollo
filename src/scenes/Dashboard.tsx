/**
 * 应用仪表板 - 功能选择主页
 */

import { Show, createSignal } from 'solid-js';
import WelcomeGuide from './WelcomeGuide';
import './Dashboard.css';

export interface DashboardProps {
  onSelectMode: (mode: string) => void;
}

export default function Dashboard(props: DashboardProps) {
  const [hoveredCard, setHoveredCard] = createSignal<string | null>(null);
  const [showGuide, setShowGuide] = createSignal(!localStorage.getItem('ollo-guide-completed'));

  const features = [
    {
      id: 'player',
      title: '动画播放器',
      icon: '🎬',
      description: '使用 WebGPU 播放和预览精灵动画，支持多种播放模式和实时控制',
      color: '#667eea',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      features: ['实时预览', 'WebGPU 加速', '多种播放模式', '性能监控'],
    },
    {
      id: 'composer',
      title: '雪碧图合成',
      icon: '🎨',
      description: '强大的雪碧图合成工具，支持序列帧合成、实时预览和多种导出格式',
      color: '#f093fb',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      features: ['批量处理', 'KTX2 压缩', '实时预览', '多格式导出'],
    },
    {
      id: 'tilemap',
      title: 'TileMap 编辑器',
      icon: '🗺️',
      description: '基于 WebGPU 的 2D 地图编辑器，智能瓦片识别，支持多图层编辑和高效压缩',
      color: '#4facfe',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      features: ['智能网格检测', '多图层支持', '高性能渲染', 'RLE 压缩'],
    },
  ];

  const handleCloseGuide = () => {
    setShowGuide(false);
    localStorage.setItem('ollo-guide-completed', 'true');
  };

  const handleShowGuide = () => {
    setShowGuide(true);
  };

  return (
    <div class="dashboard">
      {/* 欢迎引导 */}
      <Show when={showGuide()}>
        <WelcomeGuide 
          onClose={handleCloseGuide}
          onSelectMode={props.onSelectMode}
        />
      </Show>

      {/* 头部 */}
      <header class="dashboard-header">
        <div class="header-content">
          <h1 class="title">
            <span class="title-icon">⚡</span>
            Ollo Game Tools
          </h1>
          <p class="subtitle">专业的游戏资源制作工具集</p>
        </div>
        <div class="header-decoration">
          <div class="decoration-circle"></div>
          <div class="decoration-circle"></div>
          <div class="decoration-circle"></div>
        </div>
      </header>

      {/* 功能卡片 */}
      <div class="features-grid">
        {features.map((feature) => (
          <div
            class={`feature-card ${hoveredCard() === feature.id ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredCard(feature.id)}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => props.onSelectMode(feature.id)}
            style={{ '--card-color': feature.color, '--card-gradient': feature.gradient }}
          >
            <div class="card-background"></div>
            <div class="card-content">
              <div class="card-icon">{feature.icon}</div>
              <h3 class="card-title">{feature.title}</h3>
              <p class="card-description">{feature.description}</p>
              
              <ul class="card-features">
                {feature.features.map((feat) => (
                  <li>
                    <span class="feature-bullet">✓</span>
                    {feat}
                  </li>
                ))}
              </ul>

              <div class="card-action">
                <button class="action-button">
                  开始使用
                  <span class="button-arrow">→</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 特性介绍 */}
      <div class="highlights">
        <div class="highlight-item">
          <div class="highlight-icon">⚡</div>
          <h4>高性能</h4>
          <p>基于 WebGPU 的硬件加速渲染</p>
        </div>
        <div class="highlight-item">
          <div class="highlight-icon">🎯</div>
          <h4>易用性</h4>
          <p>直观的用户界面和工作流程</p>
        </div>
        <div class="highlight-item">
          <div class="highlight-icon">🔧</div>
          <h4>专业级</h4>
          <p>满足专业游戏开发需求</p>
        </div>
        <div class="highlight-item">
          <div class="highlight-icon">🚀</div>
          <h4>现代化</h4>
          <p>采用最新的 Web 技术标准</p>
        </div>
      </div>

      {/* 底部信息 */}
      <footer class="dashboard-footer">
        <button 
          class="guide-trigger"
          onClick={handleShowGuide}
          style={{
            padding: '10px 20px',
            background: 'rgba(102, 126, 234, 0.2)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            'border-radius': '8px',
            color: '#667eea',
            cursor: 'pointer',
            'font-weight': '600',
            'font-size': '14px',
            transition: 'all 0.3s ease',
            'margin-bottom': '20px',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
          }}
        >
          📖 查看新手引导
        </button>
        <p>
          使用 <strong>WebGPU</strong> + <strong>Solid.js</strong> + <strong>TypeScript</strong> 构建
        </p>
        <p class="footer-note">
          需要支持 WebGPU 的现代浏览器 (Chrome 113+, Safari 17.4+)
        </p>
      </footer>
    </div>
  );
}

