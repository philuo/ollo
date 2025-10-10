# 橡皮擦功能说明

## 功能概述

新增了橡皮擦功能，允许用户快速删除画布上已绘制的瓦片。

## 使用方法

### 基本操作
1. **按住 `D` 键** - 进入橡皮擦模式
2. **移动鼠标** - 悬浮到要删除的网格上
3. **自动删除** - 鼠标悬浮的网格瓦片会被立即删除
4. **释放 `D` 键** - 退出橡皮擦模式

### 视觉反馈

#### 画布上的反馈
- **普通模式**：悬浮单元格显示 **蓝色高亮**
- **橡皮擦模式**：悬浮单元格显示 **红色高亮**

#### 侧边栏反馈
- **视图信息区域**：显示 "🗑️ 橡皮擦模式" （红色文字）
- **替换**：隐藏 "已选瓦片" 信息

## 技术实现

### 核心逻辑

```typescript
// 状态管理
const [dKeyDown, setDKeyDown] = createSignal(false);

// 删除函数
const eraseTile = (c: number, r: number) => {
  const { cols, rows } = grid();
  if (c < 0 || c >= cols || r < 0 || r >= rows) return;
  
  setTileMap(tiles => {
    const newTiles = new Map(tiles);
    newTiles.delete(`${c},${r}`);
    return newTiles;
  });
  draw();
};

// 鼠标移动处理
const onMouseMove = (e: MouseEvent) => {
  const cell = toCell(e.clientX, e.clientY);
  
  // 橡皮擦模式：按住 D 键时删除瓦片
  if (dKeyDown() && cell) {
    eraseTile(cell.c, cell.r);
    return;
  }
  
  // 正常绘制逻辑...
};
```

### 键盘监听

```typescript
const onKeyDown = (e: KeyboardEvent) => {
  // D 键橡皮擦模式
  if (e.code === 'KeyD' && !dKeyDown()) {
    e.preventDefault();
    setDKeyDown(true);
  }
};

const onKeyUp = (e: KeyboardEvent) => {
  // D 键释放
  if (e.code === 'KeyD') {
    e.preventDefault();
    setDKeyDown(false);
  }
};
```

### 视觉高亮

```typescript
// 悬浮高亮根据模式改变颜色
if (hoverCell()) {
  // 橡皮擦模式显示红色
  if (dKeyDown()) {
    ctx.fillStyle = 'rgba(220,50,50,0.3)';
    ctx.strokeStyle = 'rgba(220,50,50,0.9)';
  } else {
    ctx.fillStyle = 'rgba(102,126,234,0.25)';
    ctx.strokeStyle = 'rgba(102,126,234,0.9)';
  }
  ctx.fillRect(x, y, cellW, cellH);
  ctx.strokeRect(x, y, cellW, cellH);
}
```

## 优势特点

### 1. 即时删除
- 无需点击，鼠标悬浮即删除
- 连续擦除，效率极高
- 实时反馈，所见即所得

### 2. 模式切换
- 按住 D 进入橡皮擦
- 释放 D 返回绘制
- 无缝切换，操作流畅

### 3. 视觉明确
- 红色高亮表示删除区域
- 侧边栏显示当前模式
- 多重反馈，不会误操作

## 使用场景

### 场景 1：修正错误
- 绘制时不小心放错瓦片
- 按住 D 键快速擦除
- 继续绘制正确的瓦片

### 场景 2：大面积清除
- 需要清空一大片区域
- 按住 D 键快速滑过
- 比逐个删除快得多

### 场景 3：精细调整
- 调整瓦片地图细节
- 擦除不满意的部分
- 重新绘制更好的布局

## 快捷键总览

| 操作 | 快捷键 | 说明 |
|------|--------|------|
| 绘制瓦片 | 左键拖拽 | 正常绘制模式 |
| 删除瓦片 | **按住 D** | 橡皮擦模式 |
| 平移画布 | Space + 拖拽 | 移动视图 |
| 缩放画布 | 滚轮 | 放大/缩小 |

## 与其他功能的兼容性

### ✅ 兼容功能
- 平移和缩放（Space 键优先级更高）
- 视图重置（双击 J）
- 瓦片选择（不影响选中状态）

### ⚠️ 互斥功能
- 绘制模式：D 键时不能绘制
- 多选模式：D 键时建议先完成多选

## 注意事项

1. **不可撤销**：删除后无法撤销，请谨慎操作
2. **单个删除**：一次只删除一个网格的瓦片
3. **键盘焦点**：确保页面有键盘焦点，D 键才生效

## 后续优化建议

- [ ] 添加撤销/重做功能
- [ ] 支持框选批量删除
- [ ] 添加删除确认选项
- [ ] 记录删除历史
- [ ] 支持橡皮擦大小调整

## 颜色方案

| 元素 | 颜色 | 说明 |
|------|------|------|
| 普通悬浮 | `rgba(102,126,234,0.25)` | 蓝色半透明 |
| 橡皮擦悬浮 | `rgba(220,50,50,0.3)` | 红色半透明 |
| 普通边框 | `rgba(102,126,234,0.9)` | 蓝色实线 |
| 橡皮擦边框 | `rgba(220,50,50,0.9)` | 红色实线 |
| 模式提示 | `rgba(220,50,50,1)` | 红色文字 |

## 实现文件

- `src/tilemap/InfiniteCanvas.tsx` - 主要实现文件
  - 新增状态：`dKeyDown`, `isErasing`
  - 新增函数：`eraseTile()`
  - 修改函数：`onMouseMove()`, `onKeyDown()`, `onKeyUp()`, `draw()`
  - 更新 UI：快捷键说明，视图信息提示

