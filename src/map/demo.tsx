/**
 * TileMap 编辑器演示页面
 * 展示如何使用 TileMap 编辑器
 */

import { TileMapEditor } from './TileMapEditor';

/**
 * 演示应用
 */
export function TileMapDemo() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
    }}>
      <TileMapEditor />
    </div>
  );
}

export default TileMapDemo;

