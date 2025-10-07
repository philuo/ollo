# TileMap 编辑器快速开始指南

## 5 分钟上手

### 步骤 1: 导入编辑器

```tsx
import { TileMapEditor } from './map';

function App() {
  return <TileMapEditor />;
}
```

### 步骤 2: 生成测试瓦片集（可选）

如果你还没有瓦片集图片，可以使用内置的生成器：

```tsx
import { TestTileSetGenerator } from './map';

// 在浏览器控制台中运行
const dataUrl = TestTileSetGenerator.generateColorGrid(8, 8, 32);
TestTileSetGenerator.downloadTileset(dataUrl, 'test-tileset.png');
```

或者生成地形瓦片集：

```tsx
const terrainUrl = TestTileSetGenerator.generateTerrainTileset(32);
TestTileSetGenerator.downloadTileset(terrainUrl, 'terrain-tileset.png');
```

### 步骤 3: 开始编辑

1. **上传瓦片集**
   - 点击工具栏中的"上传瓦片集"按钮
   - 选择你的图片文件（或使用步骤 2 生成的文件）
   - 编辑器会自动检测网格

2. **选择瓦片**
   - 在右侧面板中点击你想使用的瓦片
   - 被选中的瓦片会高亮显示

3. **绘制地图**
   - 在左侧画布上点击鼠标左键绘制
   - 按住鼠标拖动可以连续绘制

4. **视图控制**
   - 滚动鼠标滚轮缩放
   - 按住中键或 Alt+左键拖动平移

5. **保存工作**
   - 点击"导出地图"保存为 JSON 文件
   - 使用"导入地图"重新加载

## 完整示例

```tsx
import { createSignal } from 'solid-js';
import { TileMapEditor, TestTileSetGenerator } from './map';

function MyMapEditor() {
  // 可以在组件挂载时自动生成测试瓦片集
  const generateTestTiles = () => {
    const dataUrl = TestTileSetGenerator.generateColorGrid();
    // 可以将其转换为 File 对象并自动加载
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'test-tileset.png', { type: 'image/png' });
        // 这里可以触发文件上传逻辑
        console.log('Test tileset generated:', file);
      });
  };

  return (
    <div>
      <button onClick={generateTestTiles}>
        生成测试瓦片集
      </button>
      <TileMapEditor />
    </div>
  );
}
```

## 键盘快捷键

| 操作 | 快捷键 |
|------|--------|
| 缩放 | 鼠标滚轮 |
| 平移 | 中键拖动 或 Alt+左键拖动 |
| 绘制 | 左键点击/拖动 |

## 工具介绍

### 笔刷工具
- 用于绘制选中的瓦片
- 支持点击和拖拽绘制

### 橡皮擦工具
- 用于删除瓦片
- 将瓦片位置设置为空

### 图层系统
- 支持多图层编辑
- 可以独立控制每个图层的可见性
- 在图层下拉菜单中切换当前编辑图层

## 调整网格参数

如果自动检测的网格不准确，你可以：

1. 在代码中手动设置：

```tsx
import { GridDetector, TileSet } from './map';

// 手动指定网格参数
const gridResult = GridDetector.manualGrid(
  imageWidth,
  imageHeight,
  32,  // 瓦片宽度
  32,  // 瓦片高度
  1,   // 间距
  0    // 边距
);

// 创建瓦片集时使用
const tileSet = new TileSet({
  id: 0,
  name: 'My Tileset',
  imageUrl: 'path/to/image.png',
  tileWidth: 32,
  tileHeight: 32,
  columns: gridResult.columns,
  rows: gridResult.rows,
  spacing: 1,
  margin: 0,
});
```

2. 或者修改 `TileSet.ts` 中的 `updateGrid` 方法

## 地图数据格式

导出的地图是一个紧凑的 JSON 文件：

```json
{
  "v": "1.0.0",         // 版本
  "w": 50,              // 宽度（瓦片数）
  "h": 50,              // 高度（瓦片数）
  "tw": 32,             // 瓦片宽度（像素）
  "th": 32,             // 瓦片高度（像素）
  "ts": [...],          // 瓦片集列表
  "l": [...]            // 图层列表
}
```

## 性能提示

- **小地图**（< 50x50）：性能优秀，可以实时编辑
- **中等地图**（50x50 - 100x100）：流畅运行
- **大地图**（> 100x100）：建议分块编辑

## 浏览器要求

确保你的浏览器支持 WebGPU：

- Chrome/Edge 113+
- Safari 17.4+ (macOS 14+)
- Firefox（实验性）

检查 WebGPU 支持：

```javascript
if (navigator.gpu) {
  console.log('✅ WebGPU 已支持');
} else {
  console.log('❌ WebGPU 不支持');
}
```

## 下一步

- 阅读 [README.md](./README.md) 了解详细功能
- 查看 [USAGE_EXAMPLE.md](./USAGE_EXAMPLE.md) 学习高级用法
- 探索源代码自定义编辑器

## 常见问题

**Q: 为什么上传图片后没有显示？**

A: 检查浏览器控制台是否有错误。确保图片格式正确（PNG、JPG 等）。

**Q: 如何更改地图大小？**

A: 点击工具栏中的"调整大小"按钮，输入新的宽度和高度。

**Q: 导出的文件很大怎么办？**

A: 使用 `exportMap(mapData, false)` 不包含图片数据，只保存引用。

**Q: 可以导入 Tiled 或 Godot 的地图吗？**

A: 当前版本不支持，但你可以编写转换器将其转换为本格式。

## 获取帮助

- 查看源代码中的注释
- 阅读完整文档
- 提交 Issue 报告问题

