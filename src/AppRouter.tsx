import { createSignal, Show } from 'solid-js';
import App from '@/scenes/App';
import Dashboard from '@/scenes/Dashboard';
import SpriteSheetComposer from '@/utils/SpriteSheetComposer';
import { TileMapEditor } from '@/map';

type AppMode = 'dashboard' | 'player' | 'composer' | 'tilemap';

export default function AppRouter() {
  const [mode, setMode] = createSignal<AppMode>('dashboard');

  const buttonStyle = (currentMode: AppMode) => ({
    padding: '10px 20px',
    'border-radius': '8px',
    border: 'none',
    'font-weight': '600',
    'font-size': '14px',
    cursor: 'pointer',
    background: mode() === currentMode 
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
      : 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    transition: 'all 0.3s ease',
    'box-shadow': mode() === currentMode 
      ? '0 4px 15px rgba(102, 126, 234, 0.4)' 
      : 'none',
    transform: mode() === currentMode ? 'translateY(-2px)' : 'none',
  });

  return (
    <div>
      {/* 导航栏 */}
      <Show when={mode() !== 'dashboard'}>
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          'z-index': 1000,
          background: 'rgba(30, 30, 46, 0.95)',
          padding: '12px 24px',
          display: 'flex',
          gap: '12px',
          'justify-content': 'center',
          'align-items': 'center',
          'backdrop-filter': 'blur(10px)',
          'border-bottom': '1px solid rgba(255, 255, 255, 0.1)',
          'box-shadow': '0 2px 20px rgba(0, 0, 0, 0.3)',
        }}>
          <button
            onClick={() => setMode('dashboard')}
            style={{
              padding: '8px 16px',
              'border-radius': '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              'font-weight': '600',
              'font-size': '14px',
              cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'white',
              transition: 'all 0.3s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            ← 返回首页
          </button>
          <div style={{
            width: '1px',
            height: '24px',
            background: 'rgba(255, 255, 255, 0.2)',
            margin: '0 8px',
          }}></div>
          <button onClick={() => setMode('player')} style={buttonStyle('player')}>
            🎬 动画播放器
          </button>
          <button onClick={() => setMode('composer')} style={buttonStyle('composer')}>
            🎨 雪碧图合成
          </button>
          <button onClick={() => setMode('tilemap')} style={buttonStyle('tilemap')}>
            🗺️ TileMap 编辑器
          </button>
        </div>
      </Show>

      {/* 内容区域 */}
      <div style={{ 'margin-top': mode() !== 'dashboard' ? '60px' : '0' }}>
        <Show when={mode() === 'dashboard'}>
          <Dashboard onSelectMode={setMode} />
        </Show>
        <Show when={mode() === 'player'}>
          <App />
        </Show>
        <Show when={mode() === 'composer'}>
          <SpriteSheetComposer />
        </Show>
        <Show when={mode() === 'tilemap'}>
          <TileMapEditor />
        </Show>
      </div>
    </div>
  );
}

