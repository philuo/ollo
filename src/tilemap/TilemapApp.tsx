/**
 * Main Tilemap Application Component
 * Integrates the canvas, configuration panel, and overall application state
 */

import { createSignal, createEffect, onMount } from 'solid-js';
import { TilemapCanvas } from './components/TilemapCanvas';
import { ConfigPanel } from './components/ConfigPanel';
import {
  TileMapConfig,
  GridConfig,
  CanvasConfig,
  ViewTransform,
  RenderStats
} from './types';

export function TilemapApp() {
  // Default configuration
  const defaultGridConfig: GridConfig = {
    rows: 20,
    columns: 20,
    borderWidth: 1,
    borderColor: '#666666'
  };

  const defaultCanvasConfig: CanvasConfig = {
    backgroundColor: 'black',
    gridSize: 32
  };

  const defaultView: Partial<ViewTransform> = {
    x: 0,
    y: 0,
    zoom: 1.0
  };

  // Application state
  const [config, setConfig] = createSignal<TileMapConfig>({
    canvas: {
      width: 800,
      height: 600
    },
    grid: defaultGridConfig,
    canvasConfig: defaultCanvasConfig,
    initialView: defaultView,
    enableStats: true
  });

  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>();
  const [stats, setStats] = createSignal<RenderStats>({
    visibleGrids: 0,
    totalGrids: 0,
    fps: 0,
    frameTime: 0
  });

  const [showConfig, setShowConfig] = createSignal(true);

  // Handle configuration updates
  const handleConfigChange = (newConfig: TileMapConfig) => {
    setConfig(newConfig);
  };

  // Handle canvas reference
  const handleCanvasRef = (canvasElement: HTMLCanvasElement) => {
    setCanvas(canvasElement);
  };

  // Handle stats updates
  const handleStatsUpdate = (newStats: RenderStats) => {
    setStats(newStats);
  };

  // Toggle configuration panel
  const toggleConfig = () => {
    setShowConfig(!showConfig());
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setConfig({
      canvas: {
        width: 800,
        height: 600
      },
      grid: defaultGridConfig,
      canvasConfig: defaultCanvasConfig,
      initialView: defaultView,
      enableStats: true
    });
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      'flex-direction': 'column',
      'background-color': '#1e1e2e',
      overflow: 'hidden',
      font: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        padding: '12px 20px',
        'background-color': 'rgba(30, 30, 46, 0.95)',
        'border-bottom': '1px solid rgba(255, 255, 255, 0.1)',
        'box-shadow': '0 2px 10px rgba(0, 0, 0, 0.2)',
        'z-index': 100,
      }}>
        <div style={{
          display: 'flex',
          'align-items': 'center',
          gap: '12px'
        }}>
          <h1 style={{
            margin: 0,
            'font-size': '20px',
            'font-weight': '600',
            color: 'white',
            display: 'flex',
            'align-items': 'center',
            gap: '8px'
          }}>
            <span style={{ 'font-size': '24px' }}>🗺️</span>
            WebGPU TileMap 编辑器
          </h1>
          <div style={{
            padding: '4px 8px',
            'background-color': 'rgba(102, 126, 234, 0.2)',
            'border-radius': '4px',
            color: '#8b9dc3',
            'font-size': '11px',
            'font-weight': '500'
          }}>
            Beta
          </div>
        </div>

        <div style={{
          display: 'flex',
          'align-items': 'center',
          gap: '12px'
        }}>
          {/* Performance Stats */}
          <div style={{
            display: 'flex',
            'align-items': 'center',
            gap: '16px',
            padding: '6px 12px',
            'background-color': 'rgba(0, 0, 0, 0.3)',
            'border-radius': '6px',
            color: 'rgba(255, 255, 255, 0.8)',
            'font-size': '12px',
            'font-family': 'monospace'
          }}>
            <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
              <span style={{ color: stats().fps >= 50 ? '#4ade80' : stats().fps >= 30 ? '#fbbf24' : '#ef4444' }}>
                ●
              </span>
              <span>FPS: {stats().fps}</span>
            </div>
            <div>帧: {stats().frameTime.toFixed(1)}ms</div>
            <div>可见: {stats().visibleGrids}/{stats().totalGrids}</div>
          </div>

          {/* Action Buttons */}
          <button
            onClick={toggleConfig}
            style={{
              padding: '8px 16px',
              'background-color': showConfig() ? 'rgba(102, 126, 234, 0.8)' : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              'border-radius': '6px',
              color: 'white',
              'font-size': '13px',
              'font-weight': '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              if (!showConfig()) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              }
            }}
            onMouseOut={(e) => {
              if (!showConfig()) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
          >
            {showConfig() ? '隐藏配置' : '显示配置'}
          </button>

          <button
            onClick={resetToDefaults}
            style={{
              padding: '8px 16px',
              'background-color': 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              'border-radius': '6px',
              color: 'white',
              'font-size': '13px',
              'font-weight': '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            重置默认
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Canvas Container */}
        <div style={{
          flex: 1,
          position: 'relative',
          'background-color': '#0a0a0f'
        }}>
          <TilemapCanvas
            config={config()}
            onStatsUpdate={handleStatsUpdate}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          />
        </div>

        {/* Configuration Panel */}
        {showConfig() && (
          <div style={{
            width: '320px',
            'background-color': 'rgba(30, 30, 46, 0.8)',
            'border-left': '1px solid rgba(255, 255, 255, 0.1)',
            'backdrop-filter': 'blur(10px)',
            overflow: 'auto',
            'max-height': '100%'
          }}>
            <div style={{
              padding: '16px',
              'border-bottom': '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <ConfigPanel
                config={config()}
                onConfigChange={handleConfigChange}
              />
            </div>

            {/* Additional Information */}
            <div style={{
              padding: '16px',
              'border-top': '1px solid rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.6)',
              'font-size': '11px',
              'line-height': '1.5'
            }}>
              <div style={{
                'font-weight': '600',
                'margin-bottom': '8px',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>
                ℹ️ 使用说明
              </div>
              <div style={{ 'margin-bottom': '6px' }}>
                <strong>缩放:</strong> 使用鼠标滚轮，支持 10%-500% 缩放范围
              </div>
              <div style={{ 'margin-bottom': '6px' }}>
                <strong>平移:</strong> 按住 Alt 键 + 鼠标左键，或直接按住鼠标中键
              </div>
              <div style={{ 'margin-bottom': '6px' }}>
                <strong>网格高亮:</strong> 鼠标悬浮时自动高亮当前网格
              </div>
              <div style={{ 'margin-bottom': '6px' }}>
                <strong>性能:</strong> 基于 WebGPU 渲染，支持大规模网格
              </div>
              <div style={{ 'margin-top': '12px', 'font-size': '10px', color: 'rgba(255, 255, 255, 0.4)' }}>
                注意: 需要支持 WebGPU 的现代浏览器
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WebGPU Support Warning */}
      <div id="webgpu-warning" style={{
        display: 'none',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        'background-color': 'rgba(239, 68, 68, 0.9)',
        color: 'white',
        padding: '20px',
        'border-radius': '8px',
        'text-align': 'center',
        'max-width': '400px',
        'z-index': 1000
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>WebGPU 不支持</h3>
        <p style={{ margin: 0 }}>
          您的浏览器不支持 WebGPU。请使用最新的 Chrome、Edge 或 Firefox 浏览器。
        </p>
      </div>
    </div>
  );
}
