# TileMap 编辑器使用示例

## 在 AppRouter 中集成

### 1. 添加路由

在 `src/AppRouter.tsx` 中添加 TileMap 编辑器路由：

```tsx
import { Router, Route } from '@solidjs/router';
import { TileMapEditor } from './map';

function AppRouter() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/tilemap" component={TileMapEditor} />
      {/* 其他路由 */}
    </Router>
  );
}
```

### 2. 直接使用

如果想直接显示编辑器：

```tsx
// src/main.tsx
import { render } from 'solid-js/web';
import { TileMapEditor } from './map';

render(() => <TileMapEditor />, document.getElementById('root')!);
```

## 自定义使用

### 创建自定义地图编辑器

```tsx
import { createSignal, onMount } from 'solid-js';
import {
  TileMapRenderer,
  TileSetManager,
  TileMapDataManager,
  TileSet,
  type TileMapData,
} from './map';

function CustomMapEditor() {
  let canvasRef: HTMLCanvasElement | undefined;
  const [mapData, setMapData] = createSignal<TileMapData>(
    TileMapDataManager.createEmptyMap(30, 20, 32, 32)
  );

  onMount(async () => {
    if (!canvasRef) return;

    // 初始化 WebGPU
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) return;

    const context = canvasRef.getContext('webgpu');
    if (!context) return;

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });

    // 创建管理器和渲染器
    const tileSetManager = new TileSetManager();
    const renderer = new TileMapRenderer(
      canvasRef,
      device,
      context,
      format,
      tileSetManager
    );
    await renderer.init();
    renderer.setMapData(mapData());

    // 渲染循环
    function renderLoop() {
      renderer.render();
      requestAnimationFrame(renderLoop);
    }
    renderLoop();
  });

  return <canvas ref={canvasRef} width={1280} height={720} />;
}
```

### 程序化创建地图

```tsx
import { TileMapDataManager, type TileMapData } from './map';

// 创建地图
let map = TileMapDataManager.createEmptyMap(50, 50, 32, 32);

// 添加图层
map = TileMapDataManager.addLayer(map, 'Background');
map = TileMapDataManager.addLayer(map, 'Foreground');

// 程序化填充瓦片
for (let y = 0; y < 50; y++) {
  for (let x = 0; x < 50; x++) {
    // 创建棋盘图案
    const tileIndex = (x + y) % 2 === 0 ? 0 : 1;
    map = TileMapDataManager.setTile(map, 0, x, y, {
      tilesetId: 0,
      tileIndex,
    });
  }
}

// 导出
const json = await TileMapDataManager.exportMap(map, true);
console.log('Map size:', new Blob([json]).size, 'bytes');
```

### 从已有地图加载

```tsx
import { TileMapDataManager, TileSet, TileSetManager } from './map';

async function loadMap(jsonString: string, device: GPUDevice) {
  // 导入地图
  const mapData = TileMapDataManager.importMap(jsonString);

  // 创建瓦片集管理器
  const tileSetManager = new TileSetManager();

  // 加载所有瓦片集
  for (const tsDef of mapData.tileSets) {
    const tileSet = await TileSet.createFromDefinition(tsDef, device);
    if (tileSet) {
      tileSetManager.addTileSet(tileSet);
    }
  }

  return { mapData, tileSetManager };
}

// 使用
const jsonData = await fetch('/maps/level1.json').then(r => r.text());
const { mapData, tileSetManager } = await loadMap(jsonData, device);
```

## 高级功能

### 自定义网格检测

```tsx
import { GridDetector } from './map';

// 手动设置网格参数
const gridResult = GridDetector.manualGrid(
  512,    // 图片宽度
  384,    // 图片高度
  32,     // 瓦片宽度
  32,     // 瓦片高度
  1,      // 间距
  0       // 边距
);

console.log(gridResult);
// {
//   tileWidth: 32,
//   tileHeight: 32,
//   columns: 16,
//   rows: 12,
//   spacing: 1,
//   margin: 0,
//   confidence: 1.0
// }
```

### 导出为不同格式

```tsx
import { TileMapDataManager } from './map';

// 导出（不包含图片数据，体积更小）
const jsonWithoutImages = await TileMapDataManager.exportMap(mapData, false);

// 导出（包含图片数据，可独立使用）
const jsonWithImages = await TileMapDataManager.exportMap(mapData, true);

// 比较大小
const sizeWithout = new Blob([jsonWithoutImages]).size;
const sizeWith = new Blob([jsonWithImages]).size;
console.log(`Without images: ${sizeWithout} bytes`);
console.log(`With images: ${sizeWith} bytes`);
console.log(`Difference: ${sizeWith - sizeWithout} bytes`);
```

### 视图控制

```tsx
import { TileMapRenderer, type ViewTransform } from './map';

// 创建渲染器后
const renderer = new TileMapRenderer(/* ... */);

// 设置视图
const view: ViewTransform = {
  x: 100,     // 水平偏移（像素）
  y: 100,     // 垂直偏移（像素）
  zoom: 2.0,  // 缩放级别
};
renderer.setViewTransform(view);

// 屏幕坐标转瓦片坐标
const tilePos = renderer.screenToTile(mouseX, mouseY);
console.log(`Tile at: ${tilePos.x}, ${tilePos.y}`);

// 屏幕坐标转世界坐标
const worldPos = renderer.screenToWorld(mouseX, mouseY);
console.log(`World position: ${worldPos.x}, ${worldPos.y}`);
```

## 性能优化技巧

### 1. 批量更新

```tsx
// 不好：每次更新都触发重新渲染
for (let i = 0; i < 100; i++) {
  mapData = TileMapDataManager.setTile(mapData, 0, i, 0, tile);
  renderer.setMapData(mapData); // 避免这样做
}

// 好：批量更新后一次性设置
let tempMapData = mapData;
for (let i = 0; i < 100; i++) {
  tempMapData = TileMapDataManager.setTile(tempMapData, 0, i, 0, tile);
}
setMapData(tempMapData);
renderer.setMapData(tempMapData); // 只调用一次
```

### 2. 限制地图大小

对于非常大的地图（如 1000x1000），考虑：

- 使用分块加载
- 实现视锥剔除
- 减少图层数量
- 优化瓦片集大小

### 3. 纹理优化

```tsx
// 使用合适大小的瓦片集图片
// 推荐大小：512x512、1024x1024、2048x2048

// 避免使用过大的单个瓦片
// 推荐瓦片大小：16x16、32x32、64x64
```

## 常见问题

### Q: 如何处理不同分辨率的屏幕？

```tsx
// 使用设备像素比
const dpr = window.devicePixelRatio || 1;
canvas.width = canvas.clientWidth * dpr;
canvas.height = canvas.clientHeight * dpr;
```

### Q: 如何实现多选和批量编辑？

这个功能将在未来版本中添加。当前可以通过循环调用 `setTile` 实现。

### Q: 支持动画瓦片吗？

当前版本不支持，但可以通过定期更新瓦片索引来模拟动画。

### Q: 如何导出为图片？

```tsx
// 渲染后导出为图片
renderer.render();
const dataUrl = canvas.toDataURL('image/png');

// 下载
const a = document.createElement('a');
a.href = dataUrl;
a.download = 'map.png';
a.click();
```

## 最佳实践

1. **合理使用图层**：
   - 地形层（地面、墙壁）
   - 装饰层（植物、物品）
   - 碰撞层（游戏逻辑使用）

2. **瓦片集组织**：
   - 按主题分类（如：地牢、森林、城市）
   - 保持一致的瓦片大小
   - 使用有意义的命名

3. **性能考虑**：
   - 限制同时渲染的图层数量
   - 使用合适的缩放级别
   - 避免频繁重建渲染批次

4. **数据管理**：
   - 定期保存工作
   - 使用版本控制管理地图文件
   - 保留备份

