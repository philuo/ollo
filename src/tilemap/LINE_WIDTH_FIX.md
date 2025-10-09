# 线宽显示问题修复

## 🐛 问题现象

1. **缩放后看不到网格线**：缩小视图时网格线消失
2. **必须放大才能看到**：只有放大才勉强看到线条
3. **线宽必须设为 2**：设置为 1 时几乎不可见

---

## 🔍 问题原因

### 错误的 halfLineWidth 使用

**之前的错误代码**：
```wgsl
let lineWidthPixels = max(uniforms.gridLineWidth, 1.0);
let halfLineWidth = lineWidthPixels * 0.5;  // ❌ 错误：使用一半

// 判断条件
if (distToRightPx < halfLineWidth) {  // ❌ 只有 0.5 像素宽
  onGridLine = true;
}
```

**问题分析**：
```
设置线宽 = 1.0
halfLineWidth = 0.5

判断条件：distToRightPx < 0.5
意思是：只有距离网格线 0.5 像素内才绘制

结果：线条实际宽度只有 0.5 像素！

缩放到 50% 时：
- 网格单元在屏幕上只有 32 像素
- 线条只有 0.5 像素宽
- 占比仅 1.5%，几乎看不见！

缩放到 20% 时：
- 网格单元在屏幕上只有 12.8 像素  
- 线条 0.5 像素几乎完全看不见
```

### 为什么之前要用 halfLineWidth？

**原本的错误理解**：
- 以为 halfLineWidth 能让线条在网格线两侧对称分布
- 以为这样能避免重叠

**实际情况**：
- 我们的设计是每个单元格只绘制右边线和下边线
- 第一行/列特殊处理上边线和左边线
- 这种设计本身就不会重叠
- 根本不需要 halfLineWidth！

---

## ✅ 修复方案

### 使用完整的 lineWidthPixels

**正确的代码**：
```wgsl
let lineWidthPixels = max(uniforms.gridLineWidth, 1.0);
// 不需要 halfLineWidth

// 判断条件：使用完整线宽
if (distToRightPx < lineWidthPixels) {  // ✅ 完整的 1.0 像素
  onGridLine = true;
}
```

**效果**：
```
设置线宽 = 1.0
lineWidthPixels = 1.0

判断条件：distToRightPx < 1.0
意思是：距离网格线 1.0 像素内绘制

结果：线条实际宽度 = 1.0 像素 ✅

缩放到 50% 时：
- 网格单元 32 像素
- 线条 1 像素
- 占比 3.1%，清晰可见！

缩放到 20% 时：
- 网格单元 12.8 像素
- 线条 1 像素  
- 占比 7.8%，完全可见！
```

---

## 🔬 为什么不会重叠？

### 绘制策略

```
每个单元格只绘制：
- 右边线（distToRightPx < lineWidthPixels）
- 下边线（distToBottomPx < lineWidthPixels）

第一行/列额外绘制：
- 左边线（cellX == 0 && distToLeftPx < lineWidthPixels）
- 上边线（cellY == 0 && distToTopPx < lineWidthPixels）
```

### 不重叠的证明

```
考虑两个相邻的单元格：

单元格 A (左侧，cellX = 0):
  右边线位置：X = 64
  绘制范围：distToRight < 1
  实际像素：[63, 64) 的像素

单元格 B (右侧，cellX = 1):
  左边线：不绘制（因为 cellX != 0）
  右边线位置：X = 128  
  绘制范围：distToRight < 1
  实际像素：[127, 128) 的像素

结论：
- A 绘制 [63, 64)
- B 绘制 [127, 128)
- 完全不重叠！✅
```

### 为什么 distToRight < 1 不会重叠到下一个单元格？

**关键理解**：
```
在单元格 A 中：
  gridRightX = 64.0
  当 worldX = 63.5 时：
    distToRight = 64.0 - 63.5 = 0.5 < 1.0 → 绘制 ✅

  当 worldX = 64.0 时（边界）：
    distToRight = 64.0 - 64.0 = 0.0 < 1.0 → 绘制 ✅

在单元格 B 中：
  worldX = 64.0 时：
    cellX = floor(64.0 / 64) = 1（已经是下一个单元格了）
    gridLeftX = 1 * 64 = 64.0
    distToLeft = 64.0 - 64.0 = 0.0 < 1.0
    但 cellX = 1 != 0，所以不绘制左边线
    
  只有 gridRightX = 128.0 的右边线会被绘制
```

**结论**：单元格边界处，只有一个单元格会绘制该位置的线条，不会重叠。

---

## 📊 修复效果对比

| 场景 | 修复前 (halfLineWidth) | 修复后 (lineWidthPixels) |
|------|----------------------|-------------------------|
| **线宽 = 1, 100% 缩放** | 0.5px（很细） | 1.0px（正常）✅ |
| **线宽 = 1, 50% 缩放** | 0.5px（几乎看不见）❌ | 1.0px（清晰可见）✅ |
| **线宽 = 1, 20% 缩放** | 0.5px（完全看不见）❌ | 1.0px（可见）✅ |
| **线宽 = 2** | 1.0px（勉强可见） | 2.0px（非常清晰）✅ |
| **移动闪烁** | 无闪烁 ✅ | 无闪烁 ✅ |
| **重叠问题** | 无重叠 ✅ | 无重叠 ✅ |

---

## 🎯 关键要点

### 1. 线宽的含义

```
lineWidthPixels = 1.0

不是说线条占 0.5 像素左右各 0.5
而是说：距离网格线 1 像素内的所有像素都绘制

这样才能得到 1 像素宽的线条！
```

### 2. 距离判断的正确性

```
distToRightPx < lineWidthPixels

含义：当前像素到右边线的距离 < 线宽
效果：右边线附近 lineWidthPixels 像素都会被绘制
结果：完整的线宽显示
```

### 3. 不需要 halfLineWidth

```
❌ 错误认知：需要 halfLineWidth 避免重叠
✅ 正确认知：我们的单元格绘制策略天然避免重叠

每个单元格只绘制右边和下边
→ 不会和相邻单元格重叠
→ 直接用完整 lineWidthPixels
```

---

## 🧪 测试验证

### 测试 1：最小线宽
```
设置：线宽 = 1.0
缩放：20%, 50%, 100%, 200%, 400%

期望：所有缩放下都清晰可见
结果：✅ 全部通过
```

### 测试 2：不同线宽
```
设置：0.5, 1.0, 2.0, 3.0
缩放：50%

期望：
- 0.5 → 显示为 1px（因为 max(0.5, 1.0) = 1.0）
- 1.0 → 显示为 1px
- 2.0 → 显示为 2px  
- 3.0 → 显示为 3px

结果：✅ 完全符合预期
```

### 测试 3：移动稳定性
```
操作：平移视图
线宽：1.0

期望：无闪烁，稳定显示
结果：✅ 完全稳定
```

### 测试 4：无重叠验证
```
设置：线宽 = 3.0（较粗）
缩放：200%（放大观察）

期望：线条清晰，无重叠，无间隙
结果：✅ 完美渲染
```

---

## 📝 代码变更

### 修复前
```wgsl
let lineWidthPixels = max(uniforms.gridLineWidth, 1.0);
let halfLineWidth = lineWidthPixels * 0.5;  // ❌ 错误

if (distToRightPx < halfLineWidth) {  // ❌ 只有一半
  onGridLine = true;
}
```

### 修复后
```wgsl
let lineWidthPixels = max(uniforms.gridLineWidth, 1.0);
// 不需要 halfLineWidth

if (distToRightPx < lineWidthPixels) {  // ✅ 完整线宽
  onGridLine = true;
}
```

---

## 🏆 总结

### 问题根源
❌ 使用 halfLineWidth 导致线条实际宽度只有设置值的一半
❌ 缩小视图时线条太细，无法看到

### 解决方案  
✅ 使用完整的 lineWidthPixels
✅ 确保线条显示为设置的完整宽度

### 验证结果
✅ 线宽 = 1 时清晰可见
✅ 任何缩放级别都稳定显示
✅ 无闪烁
✅ 无重叠
✅ 完美渲染

---

**修复完成！现在线宽 1 像素即可清晰显示，缩放到任何级别都稳定可见。** 🎉

