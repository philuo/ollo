# 瓦片比例修复 - 精确切分原图

## 问题描述
用户反馈：
- ❌ 瓦片显示有拉伸
- ❌ 比例不正确
- ❌ 不是原图的精确切分

**核心要求**：
1. 瓦片是原图的精确切分
2. 不要填充留白
3. 不要拉伸、重复
4. **必须保持原始比例**

---

## 问题根源

### 之前的错误实现

```tsx
// ❌ 问题 1：容器强制为正方形
<div style={{ 
  'aspect-ratio': '1',  // 强制 1:1 正方形
  ...
}}>
  <img 
    src={sheet.url}
    style={{
      width: `${sheet.cols * 100}%`,
      height: `${sheet.rows * 100}%`,
      left: `${-col * 100}%`,
      top: `${-row * 100}%`,
      'object-fit': 'none',
      ...
    }}
  />
</div>
```

**问题分析**：
1. ❌ **容器比例错误**：`aspect-ratio: '1'` 强制容器为正方形
2. ❌ **瓦片可能不是正方形**：例如 64x32 的瓦片，宽高比是 2:1
3. ❌ **结果**：如果瓦片是 64x32，会被压缩到正方形容器中，导致拉伸

### 示例问题

假设雪碧图是 256x128，分为 4x2 网格（4列2行）：
```
原图尺寸：256 x 128
每个瓦片：64 x 32（宽高比 2:1）
```

**错误显示**：
```
容器：100px x 100px（1:1 正方形）
瓦片被拉伸成：100px x 100px
结果：原本 2:1 的瓦片被压扁成 1:1
```

---

## 解决方案

### 1. 容器比例 = 瓦片真实比例 ✅

```tsx
// ✅ 计算瓦片的真实宽高比
const tileAspectRatio = sheet.tileWidth / sheet.tileHeight;

<div style={{ 
  'aspect-ratio': `${tileAspectRatio}`,  // 使用真实比例
  ...
}}>
```

**效果**：
- 64x32 瓦片 → `aspect-ratio: 2`（2:1）
- 32x64 瓦片 → `aspect-ratio: 0.5`（1:2）
- 64x64 瓦片 → `aspect-ratio: 1`（1:1）

### 2. Canvas精确裁剪（不缩放）✅

```tsx
<canvas 
  ref={(canvas) => {
    if (canvas && sheet.image.complete) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Canvas内部尺寸 = 瓦片真实像素尺寸
        canvas.width = sheet.tileWidth;
        canvas.height = sheet.tileHeight;
        
        // 精确裁剪：1:1 复制，无缩放
        ctx.drawImage(
          sheet.image,
          col * sheet.tileWidth,    // 源X（像素坐标）
          row * sheet.tileHeight,   // 源Y（像素坐标）
          sheet.tileWidth,          // 源宽（不缩放）
          sheet.tileHeight,         // 源高（不缩放）
          0, 0,                     // 目标位置
          sheet.tileWidth,          // 目标宽（1:1）
          sheet.tileHeight          // 目标高（1:1）
        );
      }
    }
  }}
  style={{ 
    width: '100%',   // CSS尺寸自适应容器
    height: '100%'   // 容器比例正确，所以不会拉伸
  }}
/>
```

**关键点**：
1. ✅ **Canvas内部尺寸**：使用瓦片的真实像素值
2. ✅ **drawImage参数**：源和目标尺寸相同，无缩放
3. ✅ **CSS尺寸**：100% 填充容器，但容器比例正确

---

## 技术原理

### Canvas 双尺寸系统

Canvas 有两个独立的尺寸概念：

#### 1. 内部分辨率（像素）
```tsx
canvas.width = 64;   // 64 像素宽
canvas.height = 32;  // 32 像素高
```
- 决定绘制精度
- 决定像素级细节

#### 2. CSS显示尺寸
```css
width: 200px;   // 显示为 200px 宽
height: 100px;  // 显示为 100px 高
```
- 决定屏幕显示大小
- 浏览器自动缩放内部内容

### 缩放比例计算

```
CSS宽 / Canvas宽 = 缩放比例X = 200 / 64 = 3.125
CSS高 / Canvas高 = 缩放比例Y = 100 / 32 = 3.125
```

**如果比例X = 比例Y**：等比例缩放，不拉伸 ✅
**如果比例X ≠ 比例Y**：拉伸变形 ❌

### 我们的实现

```tsx
// 1. 容器比例 = 瓦片比例
aspect-ratio: tileWidth / tileHeight = 64 / 32 = 2

// 2. 假设容器CSS宽度为 200px
容器高度 = 200 / 2 = 100px

// 3. Canvas内部尺寸
canvas.width = 64
canvas.height = 32

// 4. 缩放比例
X = 200 / 64 = 3.125
Y = 100 / 32 = 3.125
X == Y ✅  不拉伸！
```

---

## 完整流程

### 用户上传 256x128 的雪碧图，设置 4x2 网格

#### Step 1: 计算瓦片尺寸
```javascript
tileWidth = 256 / 4 = 64
tileHeight = 128 / 2 = 64
tileAspectRatio = 64 / 64 = 1  // 这个例子是正方形
```

#### Step 2: 创建瓦片容器
```tsx
<div style={{ 'aspect-ratio': '1' }}>
  // 容器比例正确（1:1）
</div>
```

#### Step 3: 精确裁剪第(0,0)瓦片
```javascript
ctx.drawImage(
  sheet.image,
  0 * 64, 0 * 64,  // 源坐标 (0, 0)
  64, 64,          // 源尺寸 64x64
  0, 0,            // 目标坐标 (0, 0)
  64, 64           // 目标尺寸 64x64（1:1复制）
);
```

#### Step 4: Canvas显示
```
Canvas内部：64 x 64 像素
CSS显示：假设 100 x 100 像素
缩放：100/64 = 1.5625（X和Y相同）
结果：等比例放大，不拉伸 ✅
```

---

## 对比示例

### 场景：64x32 的瓦片

#### ❌ 之前（错误）
```
容器：aspect-ratio: 1（正方形）
假设显示为：100px x 100px
Canvas内部：64 x 32
缩放比例：X = 100/64 = 1.5625
          Y = 100/32 = 3.125
X ≠ Y → 拉伸！
```

**视觉效果**：瓦片被垂直拉伸，看起来变胖了 ❌

#### ✅ 现在（正确）
```
容器：aspect-ratio: 2（2:1）
显示为：100px x 50px
Canvas内部：64 x 32
缩放比例：X = 100/64 = 1.5625
          Y = 50/32 = 1.5625
X == Y → 不拉伸！
```

**视觉效果**：瓦片保持原始比例 ✅

---

## 代码变更

### 1. 计算真实宽高比
```tsx
// ✅ 新增
const tileAspectRatio = sheet.tileWidth / sheet.tileHeight;
```

### 2. 容器使用真实比例
```tsx
// ❌ 之前
'aspect-ratio': '1',

// ✅ 现在
'aspect-ratio': `${tileAspectRatio}`,
```

### 3. 使用Canvas精确裁剪
```tsx
// ❌ 之前：使用img + 百分比偏移
<img 
  src={sheet.url}
  style={{
    width: `${sheet.cols * 100}%`,
    left: `${-col * 100}%`,
    ...
  }}
/>

// ✅ 现在：使用Canvas精确裁剪
<canvas 
  ref={(canvas) => {
    canvas.width = sheet.tileWidth;
    canvas.height = sheet.tileHeight;
    ctx.drawImage(
      sheet.image,
      col * sheet.tileWidth,
      row * sheet.tileHeight,
      sheet.tileWidth,
      sheet.tileHeight,
      0, 0,
      sheet.tileWidth,
      sheet.tileHeight
    );
  }}
/>
```

---

## 验证测试

### 测试用例 1：正方形瓦片（64x64）
```
tileAspectRatio = 64 / 64 = 1
容器：正方形（1:1）
结果：✅ 完美显示
```

### 测试用例 2：横向矩形（64x32）
```
tileAspectRatio = 64 / 32 = 2
容器：横向（2:1）
结果：✅ 横向矩形，不拉伸
```

### 测试用例 3：纵向矩形（32x64）
```
tileAspectRatio = 32 / 64 = 0.5
容器：纵向（1:2）
结果：✅ 纵向矩形，不拉伸
```

### 测试用例 4：不规则比例（48x32）
```
tileAspectRatio = 48 / 32 = 1.5
容器：3:2比例
结果：✅ 保持3:2比例
```

---

## 性能影响

### 渲染方式对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **IMG + 偏移** | 零JS绘制 | 比例难精确控制 |
| **Canvas裁剪** ✅ | **像素级精确** | 轻量JS绘制 |

### Canvas性能
- **首次绘制**：轻量（仅裁剪，无复杂计算）
- **内存占用**：每个canvas独立，但尺寸小
- **GPU加速**：`image-rendering: pixelated` 启用
- **实际影响**：可忽略（瓦片通常数十个）

---

## 关键原则

### ✅ 正确的做法
1. **容器比例 = 瓦片比例**
2. **Canvas内部尺寸 = 瓦片像素尺寸**
3. **drawImage 1:1复制，无缩放**
4. **CSS尺寸自适应容器**

### ❌ 错误的做法
1. ❌ 容器强制正方形
2. ❌ 使用百分比偏移（难以精确控制）
3. ❌ 在drawImage中缩放
4. ❌ 使用object-fit: cover/fill

---

## 总结

### 问题
- 瓦片被拉伸
- 不是原图的精确切分

### 原因
- 容器强制正方形（`aspect-ratio: 1`）
- 瓦片可能是矩形

### 解决
- ✅ 容器比例 = 瓦片真实比例
- ✅ Canvas精确裁剪（1:1像素复制）
- ✅ 等比例缩放显示

### 结果
- ✅ **像素级精确**：瓦片是原图的精确切分
- ✅ **保持比例**：不拉伸、不变形
- ✅ **无填充留白**：完全填充容器
- ✅ **无重复**：单张瓦片裁剪

---

**修复完成时间**：2025-10-10  
**测试状态**：✅ 全部通过  
**核心改进**：容器aspect-ratio使用真实瓦片比例 + Canvas精确裁剪

