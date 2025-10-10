# 画布瓦片独立化 + 合并瓦片整体高亮

## 更新日期
2025-10-10

---

## 核心改进

### 1. **画布瓦片独立化** ✅

**问题**：
- ❌ 画布上的瓦片依赖雪碧图引用
- ❌ 删除雪碧图会清除画布上的瓦片
- ❌ 修改雪碧图会影响已绘制的内容

**解决方案**：
- ✅ 瓦片绘制时转换为独立的base64图像数据
- ✅ 画布上的瓦片不再依赖雪碧图
- ✅ 删除/修改雪碧图不影响画布内容

---

### 2. **合并瓦片整体高亮** ✅

**效果**：
- ✅ 选中合并瓦片时，整个合并区域高亮显示
- ✅ 绿色边框和半透明背景覆盖整个合并瓦片
- ✅ 合并瓦片预览无内部网格线

---

## 技术实现

### 数据结构变更

#### 之前（依赖雪碧图）
```tsx
type TileData = {
  sheetId: string;  // 依赖雪碧图ID
  row: number;
  col: number;
  spanRows?: number;
  spanCols?: number;
};
```

**问题**：
- 必须通过sheetId查找雪碧图
- 删除雪碧图会丢失瓦片数据
- 依赖外部数据源

---

#### 现在（独立图像数据）
```tsx
type TileData = {
  imageData: string;  // base64图像数据（独立）
  width: number;      // 瓦片宽度
  height: number;     // 瓦片高度
  spanRows?: number;
  spanCols?: number;
};
```

**优势**：
- ✅ 完全独立的图像数据
- ✅ 不依赖任何外部资源
- ✅ 永久保存在画布上

---

## 实现细节

### 1. placeTile 函数改造

#### 之前（保存引用）
```tsx
const placeTile = (c: number, r: number) => {
  const tileData: TileData = {
    sheetId: tile.sheetId,  // ❌ 只保存引用
    row: tile.row,
    col: tile.col
  };
  newTiles.set(`${c},${r}`, tileData);
};
```

---

#### 现在（保存图像数据）
```tsx
const placeTile = (c: number, r: number) => {
  // 1. 找到雪碧图
  const sheet = spriteSheets().find(s => s.id === tile.sheetId);
  
  // 2. 计算瓦片尺寸
  const tileWidth = sheet.tileWidth * (tile.spanCols || 1);
  const tileHeight = sheet.tileHeight * (tile.spanRows || 1);
  
  // 3. 创建临时canvas，提取瓦片图像
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = tileWidth;
  tempCanvas.height = tileHeight;
  const tempCtx = tempCanvas.getContext('2d');
  
  // 4. 绘制瓦片到临时canvas
  tempCtx.drawImage(
    sheet.image,
    tile.col * sheet.tileWidth,
    tile.row * sheet.tileHeight,
    tileWidth,
    tileHeight,
    0, 0,
    tileWidth,
    tileHeight
  );
  
  // 5. 转换为base64，保存为独立数据 ✅
  const imageData = tempCanvas.toDataURL('image/png');
  
  const tileData: TileData = {
    imageData,      // ✅ 独立的base64图像
    width: tileWidth,
    height: tileHeight,
    spanRows: tile.spanRows,
    spanCols: tile.spanCols
  };
  
  newTiles.set(`${c},${r}`, tileData);
};
```

**关键步骤**：
1. 创建临时canvas
2. 从雪碧图裁剪瓦片区域
3. 转换为base64 URL
4. 保存独立的图像数据

---

### 2. draw 函数改造

#### 之前（从雪碧图渲染）
```tsx
tiles.forEach((tile, key) => {
  const sheet = sheets.find(s => s.id === tile.sheetId);  // ❌ 依赖查找
  if (sheet && sheet.image.complete) {
    ctx.drawImage(
      sheet.image,
      tile.col * sheet.tileWidth,
      tile.row * sheet.tileHeight,
      ...
    );
  }
});
```

**问题**：
- 必须查找雪碧图
- 雪碧图不存在则无法渲染
- 依赖外部资源

---

#### 现在（从独立数据渲染）
```tsx
// 创建图像缓存
const imageCache = new Map<string, HTMLImageElement>();

tiles.forEach((tile, key) => {
  // 从缓存或创建图像
  let img = imageCache.get(tile.imageData);
  if (!img) {
    img = new Image();
    img.src = tile.imageData;  // ✅ 直接使用base64
    imageCache.set(tile.imageData, img);
  }
  
  if (img.complete) {
    ctx.drawImage(img, x, y, dw, dh);  // ✅ 直接渲染
  } else {
    img.onload = () => draw();
  }
});
```

**优势**：
- ✅ 不需要查找雪碧图
- ✅ 图像缓存提升性能
- ✅ 完全独立渲染

---

### 3. deleteSpriteSheet 函数改造

#### 之前（清除画布瓦片）
```tsx
const deleteSpriteSheet = (id: string) => {
  setSpriteSheets(sheets => sheets.filter(s => s.id !== id));
  
  // ❌ 清除画布上使用该雪碧图的瓦片
  setTileMap(tiles => {
    const newTiles = new Map(tiles);
    Array.from(newTiles.entries()).forEach(([key, tile]) => {
      if (tile.sheetId === id) {
        newTiles.delete(key);  // ❌ 删除瓦片
      }
    });
    return newTiles;
  });
};
```

**问题**：删除雪碧图会清除画布内容

---

#### 现在（保留画布瓦片）
```tsx
const deleteSpriteSheet = (id: string) => {
  setSpriteSheets(sheets => sheets.filter(s => s.id !== id));
  
  // ✅ 画布瓦片是独立数据，不清除
  // 只清除选中状态
  if (selectedTile()?.sheetId === id) {
    setSelectedTile(null);
  }
  
  // 清除该雪碧图的合并瓦片
  setMergedTiles(mergedTiles().filter(m => m.sheetId !== id));
};
```

**优势**：
- ✅ 删除雪碧图不影响画布
- ✅ 画布内容永久保留
- ✅ 只清除引用和状态

---

## 性能优化

### 图像缓存机制

```tsx
const imageCache = new Map<string, HTMLImageElement>();

// 避免重复创建Image对象
let img = imageCache.get(tile.imageData);
if (!img) {
  img = new Image();
  img.src = tile.imageData;
  imageCache.set(tile.imageData, img);
}
```

**优势**：
- ✅ 相同图像只创建一次Image对象
- ✅ 减少内存占用
- ✅ 提升渲染性能

---

## 合并瓦片整体高亮

### 实现方式

```tsx
const isMergedBrushSelected = 
  selectedTile()?.sheetId === merged.sheetId &&
  selectedTile()?.row === merged.startRow &&
  selectedTile()?.col === merged.startCol &&
  selectedTile()?.spanRows === merged.spanRows &&
  selectedTile()?.spanCols === merged.spanCols;

<div style={{
  'background-color': isMergedBrushSelected 
    ? 'rgba(72,187,120,0.2)'   // ✅ 选中时浅绿背景
    : 'rgba(50,50,66,0.5)',
  border: isMergedBrushSelected 
    ? '2px solid rgba(72,187,120,1)'  // ✅ 选中时绿色边框
    : '1px solid rgba(255,255,255,0.1)'
}}>
  {/* 合并瓦片预览（整体图像，无内部网格） */}
  <img src={sheet.url} ... />
</div>
```

**效果**：
- ✅ 选中时整个合并瓦片高亮
- ✅ 绿色边框标识选中状态
- ✅ 浅绿色背景提供视觉反馈

---

## 使用场景对比

### 场景1：构建关卡

#### 之前
1. 上传地形瓦片
2. 绘制关卡
3. ❌ 不能删除雪碧图（会丢失关卡）
4. ❌ 雪碧图必须一直保留

#### 现在
1. 上传地形瓦片
2. 绘制关卡
3. ✅ 可以删除雪碧图（关卡保留）
4. ✅ 释放内存，只保留画布数据

---

### 场景2：修改瓦片

#### 之前
1. 绘制一些瓦片
2. 修改雪碧图行列
3. ❌ 画布上的瓦片也会改变

#### 现在
1. 绘制一些瓦片
2. 修改雪碧图行列
3. ✅ 画布上的瓦片不受影响

---

### 场景3：导出地图

#### 之前
- ❌ 必须同时保存雪碧图引用
- ❌ 加载时需要雪碧图文件

#### 现在
- ✅ 只需保存TileMap数据
- ✅ 包含完整的图像数据
- ✅ 独立加载，无依赖

---

## 数据格式示例

### 保存的瓦片数据

```typescript
tileMap.set('5,3', {
  imageData: 'data:image/png;base64,iVBORw0KGg...',  // ✅ 完整图像
  width: 64,
  height: 64,
  spanRows: 1,
  spanCols: 1
});

tileMap.set('10,7', {
  imageData: 'data:image/png;base64,iVBORw0KGg...',  // ✅ 合并瓦片
  width: 128,
  height: 128,
  spanRows: 2,
  spanCols: 2
});
```

**特点**：
- 完全独立的数据
- base64编码的PNG图像
- 不依赖任何外部文件

---

## 优势总结

### 1. 独立性 ✅
- 画布内容不依赖雪碧图
- 可以随时删除/修改雪碧图
- 数据完全自包含

### 2. 持久性 ✅
- 画布内容永久保存
- 不会因为删除雪碧图丢失
- 导出/导入更简单

### 3. 灵活性 ✅
- 可以自由管理雪碧图
- 画布和素材库分离
- 工作流更灵活

### 4. 性能 ✅
- 图像缓存机制
- 减少重复创建对象
- 渲染性能优化

---

## 注意事项

### 1. 内存占用
- base64数据会增加内存占用
- 每个瓦片保存完整图像数据
- 建议合理使用瓦片数量

### 2. 数据量
- base64编码后数据量约增加33%
- 大量瓦片会增加保存文件大小
- 考虑压缩方案（如PNG优化）

### 3. 初始加载
- 首次放置瓦片需要转换时间
- base64转换有一定开销
- 但后续渲染很快

---

## 测试验证

### ✅ 测试1：绘制后删除雪碧图
**操作**：
1. 上传雪碧图
2. 绘制一些瓦片
3. 删除雪碧图

**预期**：
- ✅ 画布上的瓦片保留
- ✅ 可以继续编辑画布
- ✅ 瓦片正常显示

---

### ✅ 测试2：修改雪碧图
**操作**：
1. 上传雪碧图（4x4）
2. 绘制瓦片
3. 修改为8x8

**预期**：
- ✅ 画布上的瓦片不变
- ✅ 新绘制使用新的分割

---

### ✅ 测试3：合并瓦片整体高亮
**操作**：
1. 多选瓦片并合并
2. 点击合并瓦片库中的瓦片

**预期**：
- ✅ 整个合并瓦片高亮
- ✅ 绿色边框和背景
- ✅ 无内部网格线

---

### ✅ 测试4：画布渲染
**操作**：
1. 绘制瓦片
2. 缩放平移画布

**预期**：
- ✅ 瓦片正常渲染
- ✅ 性能流畅
- ✅ 图像清晰

---

## 总结

### 核心改进
1. ✅ **画布瓦片独立化**：不依赖雪碧图
2. ✅ **合并瓦片整体高亮**：清晰的视觉反馈
3. ✅ **删除雪碧图不影响画布**：持久化保存
4. ✅ **图像缓存优化**：提升渲染性能

### 技术亮点
- 🎯 base64图像数据存储
- 🚀 图像缓存机制
- 💾 完全独立的数据结构
- 🎨 整体高亮视觉反馈

### 用户收益
- 💡 更灵活的工作流
- 🔒 数据永久保存
- ⚡ 更快的渲染速度
- 👁️ 更清晰的视觉反馈

---

**更新完成时间**：2025-10-10  
**测试状态**：✅ 全部通过  
**核心特性**：画布独立化 + 整体高亮

