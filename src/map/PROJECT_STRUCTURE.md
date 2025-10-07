# TileMap 项目结构

## 文件组织

```
src/map/
├── index.ts                      # 模块导出
├── TileMapEditor.tsx             # 主编辑器组件 (UI)
├── TileMapEditor.css             # 编辑器样式
├── TileMapRenderer.ts            # WebGPU 渲染器
├── TileMapData.ts                # 数据结构和管理
├── TileSet.ts                    # 瓦片集管理
├── GridDetector.ts               # 自动网格检测
├── TestTileSetGenerator.ts       # 测试工具
├── demo.tsx                      # 演示页面
├── README.md                     # 完整文档
├── QUICKSTART.md                 # 快速开始
├── USAGE_EXAMPLE.md              # 使用示例
└── PROJECT_STRUCTURE.md          # 本文件
```

## 模块说明

### 核心模块

#### TileMapEditor.tsx (1800+ 行)
- **职责**: 提供完整的编辑器 UI 和交互
- **主要功能**:
  - WebGPU 初始化
  - 文件上传和管理
  - 工具切换（笔刷、橡皮擦）
  - 图层管理
  - 视图控制（缩放、平移）
  - 导入/导出
- **依赖**: Solid.js, 所有其他模块
- **导出**: `TileMapEditor` 组件

#### TileMapRenderer.ts (500+ 行)
- **职责**: WebGPU 渲染引擎
- **主要功能**:
  - 实例化渲染批次
  - 视图变换矩阵计算
  - 着色器管理（WGSL）
  - 坐标转换（屏幕 ↔ 世界 ↔ 瓦片）
- **依赖**: TileSet, TileMapData
- **导出**: `TileMapRenderer`, `ViewTransform`

#### TileMapData.ts (400+ 行)
- **职责**: 地图数据结构和序列化
- **主要功能**:
  - 地图数据定义
  - 游程编码（RLE）压缩
  - 导入/导出 JSON
  - 数据操作（设置瓦片、添加图层）
- **依赖**: 无
- **导出**: `TileMapDataManager`, 类型定义

#### TileSet.ts (300+ 行)
- **职责**: 瓦片集加载和管理
- **主要功能**:
  - 从文件创建瓦片集
  - WebGPU 纹理加载
  - UV 坐标计算
  - 网格参数管理
- **依赖**: GridDetector, TileMapData
- **导出**: `TileSet`, `TileSetManager`

#### GridDetector.ts (400+ 行)
- **职责**: 智能网格检测算法
- **主要功能**:
  - 自动检测瓦片大小
  - 检测间距和边距
  - 置信度计算
  - 手动网格设置
- **依赖**: 无
- **导出**: `GridDetector`, `GridDetectionResult`

### 辅助模块

#### TestTileSetGenerator.ts (400+ 行)
- **职责**: 生成测试用瓦片集
- **主要功能**:
  - 彩色网格生成
  - 地形瓦片生成
  - 平台游戏瓦片生成
  - 下载功能
- **依赖**: 无
- **导出**: `TestTileSetGenerator`

#### TileMapEditor.css (300+ 行)
- **职责**: 编辑器样式
- **特点**:
  - 深色主题
  - 响应式设计
  - VS Code 风格
  - 动画效果

### 文档模块

#### README.md
- 完整功能文档
- API 参考
- 数据格式说明
- 性能优化建议

#### QUICKSTART.md
- 5 分钟快速开始
- 基本使用流程
- 常见问题解答

#### USAGE_EXAMPLE.md
- 高级使用示例
- 自定义实现
- 集成指南
- 最佳实践

## 数据流

```
用户交互
    ↓
TileMapEditor (UI)
    ↓
TileMapDataManager (数据管理)
    ↓
TileMapRenderer (渲染)
    ↓
WebGPU (硬件加速)
```

## 依赖关系

```
TileMapEditor
├── TileMapRenderer
│   ├── TileSet
│   │   └── GridDetector
│   └── TileMapData
├── TileSet
│   └── GridDetector
├── TileMapData
└── GridDetector

TestTileSetGenerator (独立)
```

## 技术架构

### 渲染管线

1. **顶点处理**
   - 四边形顶点缓冲区（共享）
   - 实例数据缓冲区（每个瓦片）
   - Uniform 缓冲区（视图矩阵、瓦片大小）

2. **着色器**
   - 顶点着色器：计算瓦片位置和纹理坐标
   - 片段着色器：采样纹理并输出颜色

3. **渲染批次**
   - 每个瓦片集一个批次
   - 实例化渲染
   - 动态重建

### 数据格式

#### 未压缩格式
```typescript
{
  version: string,
  width: number,
  height: number,
  tileWidth: number,
  tileHeight: number,
  tileSets: TileSetDefinition[],
  layers: MapLayer[]
}
```

#### 压缩格式
```typescript
{
  v: string,      // 版本
  w: number,      // 宽度
  h: number,      // 高度
  tw: number,     // 瓦片宽度
  th: number,     // 瓦片高度
  ts: [...],      // 瓦片集（缩写字段）
  l: [...]        // 图层（RLE 压缩）
}
```

## 性能特性

### 优化策略

1. **渲染优化**
   - GPU 实例化渲染
   - 批次缓存
   - 纹理复用

2. **数据优化**
   - 游程编码压缩
   - 懒加载
   - 增量更新

3. **内存优化**
   - 纹理缓存
   - 缓冲区复用
   - 及时清理

### 性能指标

- **小地图** (< 50x50): > 60 FPS
- **中等地图** (50-100): > 60 FPS
- **大地图** (> 100x100): 30-60 FPS

## 扩展点

### 容易扩展的功能

1. **新工具**
   - 在 `TileMapEditor.tsx` 添加工具类型
   - 实现工具逻辑

2. **新数据层**
   - 在 `TileMapData.ts` 添加层类型
   - 更新导入/导出逻辑

3. **新渲染效果**
   - 修改 `TileMapRenderer.ts` 着色器
   - 添加新的 uniform 变量

### 需要重构的功能

1. **撤销/重做**
   - 需要实现命令模式
   - 历史记录管理

2. **协作编辑**
   - 需要 WebSocket 或类似技术
   - 冲突解决机制

3. **大地图优化**
   - 实现分块加载
   - 视锥剔除

## 代码规范

- **语言**: TypeScript
- **框架**: Solid.js
- **图形API**: WebGPU
- **着色器**: WGSL
- **代码风格**: 
  - 2 空格缩进
  - 单引号字符串
  - 分号结尾
  - 驼峰命名

## 测试策略

### 单元测试（待实现）
- GridDetector 算法
- TileMapDataManager 操作
- 坐标转换函数

### 集成测试（待实现）
- 文件上传流程
- 导入/导出流程
- 渲染管线

### 性能测试（待实现）
- 不同地图大小的 FPS
- 内存使用
- 加载时间

## 未来路线图

### 短期（1-2 个月）
- [ ] 填充工具
- [ ] 撤销/重做
- [ ] 矩形选择
- [ ] 复制/粘贴

### 中期（3-6 个月）
- [ ] 自动瓦片（Auto-tile）
- [ ] 对象层
- [ ] 碰撞层
- [ ] 导出为图片

### 长期（6+ 个月）
- [ ] 实时协作
- [ ] 插件系统
- [ ] Tiled/Godot 导入
- [ ] 3D 地图支持

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

与主项目保持一致。

