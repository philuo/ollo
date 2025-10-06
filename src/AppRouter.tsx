import { createSignal, Show } from 'solid-js';
import App from '@/scenes/App';
import SpriteSheetComposer from '@/utils/SpriteSheetComposer';

type AppMode = 'player' | 'composer';

export default function AppRouter() {
  const [mode, setMode] = createSignal<AppMode>('player');

  return (
    <div>
      {/* 导航栏 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        'z-index': 1000,
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '10px 20px',
        display: 'flex',
        gap: '10px',
        'justify-content': 'center',
        'backdrop-filter': 'blur(10px)',
      }}>
        <button
          onClick={() => setMode('player')}
          style={{
            padding: '8px 16px',
            'border-radius': '6px',
            border: 'none',
            'font-weight': '600',
            cursor: 'pointer',
            background: mode() === 'player' ? '#667eea' : '#f0f0f0',
            color: mode() === 'player' ? 'white' : '#333',
            transition: 'all 0.3s',
          }}
        >
          🎬 动画播放器
        </button>
        <button
          onClick={() => setMode('composer')}
          style={{
            padding: '8px 16px',
            'border-radius': '6px',
            border: 'none',
            'font-weight': '600',
            cursor: 'pointer',
            background: mode() === 'composer' ? '#667eea' : '#f0f0f0',
            color: mode() === 'composer' ? 'white' : '#333',
            transition: 'all 0.3s',
          }}
        >
          🎨 雪碧图合成
        </button>
      </div>

      {/* 内容区域 */}
      <div style={{ 'margin-top': '50px' }}>
        <Show when={mode() === 'player'}>
          <App />
        </Show>
        <Show when={mode() === 'composer'}>
          <SpriteSheetComposer />
        </Show>
      </div>
    </div>
  );
}

