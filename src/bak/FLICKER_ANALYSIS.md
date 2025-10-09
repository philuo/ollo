# 网格移动闪烁问题分析

## 问题现象
移动网格时出现闪烁，网格线不稳定。

## 闪烁的根本原因

### 1. 边界判断的不稳定性 ⭐⭐⭐⭐⭐

**当前代码的问题**：
```wgsl
let onRightEdge = inCellXPixels >= (cellWidthPixels - lineWidthPixels);
```

**问题场景**：
```
移动视图时：
- worldX 连续变化（如：100.0 → 100.1 → 100.2 ...）
- cellX 通过 floor(worldX / cellWidth) 计算
- 在单元格边界，cellX 会突变（如：1.0 → 2.0）
- inCellX = worldX - cellX * cellWidth 会跳变

示例：
cellWidth = 64, worldX 从 127.9 移动到 128.1

worldX = 127.9:
  cellX = floor(127.9 / 64) = 1
  inCellX = 127.9 - 64 = 63.9
  inCellXPixels = 63.9 * zoom
  判断: 63.9 * zoom >= (64 * zoom - 1) → 可能为 true

worldX = 128.0:
  cellX = floor(128.0 / 64) = 2
  inCellX = 128.0 - 128 = 0
  inCellXPixels = 0
  判断: 0 >= (64 * zoom - 1) → false

结果：线条在边界附近消失然后重新出现 → 闪烁！
```

### 2. 使用完整 lineWidthPixels 的问题

```wgsl
// 当前：使用完整线宽
let onRightEdge = inCellXPixels >= (cellWidthPixels - lineWidthPixels);

问题：
- 线条占据 [cellWidth - lineWidth, cellWidth] 范围
- 在相邻单元格，线条占据 [0, lineWidth] 范围
- 这两个范围在边界处可能重叠或产生间隙
- 移动时，像素可能在两个单元格的判断之间跳变
```

### 3. 不对称判断导致的闪烁

```wgsl
// 左边线
let onLeftEdge = cellX == 0.0 && inCellXPixels < lineWidthPixels;

// 右边线  
let onRightEdge = inCellXPixels >= (cellWidthPixels - lineWidthPixels);

问题：
- 左边用 <（小于）
- 右边用 >=（大于等于）
- 在浮点数边界值时，行为不一致
- 移动时可能产生不同的边界响应
```

## 闪烁的触发条件

1. **平移视图**：viewTransform.x 或 y 连续变化
2. **跨越单元格边界**：worldX 跨越 cellWidth 的整数倍
3. **边界像素**：恰好在线宽范围内的像素
4. **浮点数精度**：判断条件接近临界值

## 解决方案

### 核心思路：使用稳定的距离判断 + halfLineWidth

```wgsl
// 1. 计算到网格线的精确距离
let gridRightX = (cellX + 1.0) * uniforms.gridSize.x;
let distToRight = gridRightX - worldX;
let distToRightPx = distToRight * zoom;

// 2. 使用 halfLineWidth 使线条对称分布
let halfLineWidth = lineWidthPixels * 0.5;

// 3. 稳定的判断条件
if (distToRightPx < halfLineWidth) {
  // 绘制线条
}
```

**为什么更稳定**：

1. **连续性**：
   - distToRight 是连续变化的，不会突变
   - 即使 cellX 突变，distToRight 仍然平滑过渡

2. **对称性**：
   - 线条在网格线两侧各占 halfLineWidth
   - 左右单元格的判断自然衔接

3. **精确边界**：
   - 使用 `<` 而不是 `>=`
   - 边界更清晰，不会出现模糊判断

## 数学证明稳定性

```
设网格线在 X = L 的位置

单元格 A (左侧)：
  cellX = n
  gridRightX = (n+1) * cellWidth = L
  distToRight = L - worldX
  当 worldX → L-: distToRight → 0+
  判断: distToRight < halfLineWidth → true

单元格 B (右侧)：
  cellX = n+1  
  gridLeftX = (n+1) * cellWidth = L
  distToLeft = worldX - L
  当 worldX → L+: distToLeft → 0+
  判断: distToLeft < halfLineWidth → true

关键：在 worldX = L 的边界处，两个判断都接近临界，但由于使用同样的距离计算，保证了连续性。
```

## 优化后的特点

✅ **无跳变**：距离连续变化，没有突变
✅ **对称稳定**：左右判断完全对称
✅ **边界清晰**：使用 < 比较，边界明确
✅ **无重叠**：halfLineWidth 确保无缝衔接
✅ **平滑过渡**：移动时线条平滑显示

## 对比

| 方面 | 当前实现 | 优化后 |
|------|---------|--------|
| 边界连续性 | ❌ 跳变 | ✅ 连续 |
| 判断对称性 | ❌ 不对称 | ✅ 对称 |
| 移动稳定性 | ❌ 闪烁 | ✅ 稳定 |
| 线条衔接 | ❌ 可能重叠/间隙 | ✅ 完美衔接 |
| 视觉体验 | ❌ 不流畅 | ✅ 流畅 |

