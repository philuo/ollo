/**
 * TileMap 应用入口
 * 提供多种 TileMap 工具的选择界面
 */

import { createSignal, Show } from 'solid-js';
import { TileMapEditor } from '@/map/TileMapEditor';
import { InfiniteCanvas } from './InfiniteCanvas';
import './TilemapApp.css';

type TilemapMode = 'infinite-canvas' | 'tilemap-editor';

export function TilemapApp() {
  const [mode, setMode] = createSignal<TilemapMode>('infinite-canvas');

  return (
    <div class="tilemap-app">
      {/* 工具切换标签 */}
      <div class="tilemap-tabs">
        <button
          class={mode() === 'infinite-canvas' ? 'active' : ''}
          onClick={() => setMode('infinite-canvas')}
        >
          🎨 无限画布
        </button>
        <button
          class={mode() === 'tilemap-editor' ? 'active' : ''}
          onClick={() => setMode('tilemap-editor')}
        >
          🗺️ TileMap 编辑器
        </button>
      </div>

      {/* 内容区域 */}
      <div class="tilemap-content">
        <Show when={mode() === 'infinite-canvas'}>
          <InfiniteCanvas />
        </Show>
        <Show when={mode() === 'tilemap-editor'}>
          <TileMapEditor />
        </Show>
      </div>
    </div>
  );
}

export default TilemapApp;

