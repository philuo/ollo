# Godot TileMap 实现详解

## 概述

Godot 引擎的 TileMap 系统是一个高度优化的 2D 瓦片地图渲染系统，专门设计用于高效处理大量重复的瓦片元素。本文档深入分析其核心实现原理和优化技术。

## 核心架构

### 1. TileSet（瓦片集）

TileSet 是 TileMap 系统的基础，它管理所有可用的瓦片资源。

#### 关键特性：

**纹理图集（Texture Atlas）**
- 将多个小纹理合并到一张大纹理中
- 减少 GPU 状态切换和 Draw Call
- 使用纹理坐标（UV）映射到具体瓦片
- 支持自动和手动图集生成

```cpp
// 伪代码示例：Godot TileSet 结构
struct TileSetAtlasSource {
    Ref<Texture2D> texture;              // 图集纹理
    Vector2i texture_region_size;        // 每个瓦片的大小
    HashMap<Vector2i, TileData> tiles;   // 瓦片数据映射
}

struct TileData {
    Rect2i texture_rect;      // 纹理区域
    Vector2i offset;          // 渲染偏移
    bool flip_h, flip_v;      // 翻转标志
    int z_index;              // 层级
    Color modulate;           // 颜色调制
}
```

**瓦片属性系统**
- Physics layers（物理层）
- Navigation layers（导航层）
- Custom data layers（自定义数据层）
- Terrain sets（地形集）
- Occlusion shapes（遮挡形状）

### 2. TileMap（瓦片地图）

TileMap 是实际的地图实例，使用 TileSet 中定义的瓦片。

#### 核心数据结构：

**分层系统（Layer System）**
```cpp
struct TileMapLayer {
    int layer_index;
    bool enabled;
    Color modulate;
    int z_index;
    HashMap<Vector2i, TileMapCell> cells;  // 稀疏存储
}

struct TileMapCell {
    int source_id;        // TileSet source ID
    Vector2i atlas_coords; // 图集坐标
    int alternative_tile;  // 变体索引
}
```

**稀疏存储（Sparse Storage）**
- 使用 HashMap 而非二维数组
- 仅存储非空瓦片
- 内存效率高，适合大地图
- O(1) 查找时间复杂度

## 渲染优化技术

### 1. 批处理（Batching）

Godot 使用多种批处理技术来减少 Draw Call：

**按纹理分组**
```cpp
// 渲染伪代码
void render_tilemap() {
    // 1. 按图集纹理分组
    HashMap<Texture*, Vector<TileInstance>> batches;
    
    for (auto& cell : visible_cells) {
        Texture* texture = get_texture(cell);
        batches[texture].push_back(create_instance(cell));
    }
    
    // 2. 批量提交
    for (auto& [texture, instances] : batches) {
        bind_texture(texture);
        draw_instances(instances);  // 一次 Draw Call
    }
}
```

**实例化渲染（Instanced Rendering）**
- 使用 GPU 实例化绘制相同瓦片的多个副本
- 通过 Uniform Buffer 或 Texture Buffer 传递变换矩阵
- 极大减少 CPU-GPU 通信开销

### 2. 视锥剔除（Frustum Culling）

**分块剔除（Chunk-based Culling）**
```cpp
struct TileMapChunk {
    Rect2i bounds;           // 块边界
    AABB aabb;               // 3D 包围盒
    Vector<TileMapCell> cells;
    bool is_dirty;
}

// 剔除逻辑
void update_visible_chunks(Camera* camera) {
    Rect2 visible_rect = camera->get_viewport_rect();
    
    for (auto& chunk : chunks) {
        bool visible = visible_rect.intersects(chunk.bounds);
        chunk.set_visible(visible);
    }
}
```

**动态细节层次（LOD）**
- 远距离时使用简化版本或降低更新频率
- 近距离时显示完整细节

### 3. 脏矩形优化（Dirty Rectangle Optimization）

```cpp
class TileMap {
private:
    Rect2i dirty_region;
    bool needs_rebuild;
    
public:
    void set_cell(Vector2i pos, TileMapCell cell) {
        cells[pos] = cell;
        dirty_region = dirty_region.merge(Rect2i(pos, Vector2i(1, 1)));
        needs_rebuild = true;
    }
    
    void update() {
        if (needs_rebuild) {
            rebuild_mesh(dirty_region);  // 只重建变化区域
            dirty_region = Rect2i();
            needs_rebuild = false;
        }
    }
}
```

### 4. 网格缓存（Mesh Caching）

Godot 将瓦片数据预处理为 GPU 友好的网格：

```cpp
struct TileMesh {
    Vector<Vertex> vertices;
    Vector<int> indices;
    Ref<Material> material;
}

struct Vertex {
    Vector3 position;
    Vector2 uv;
    Color color;
}

// 生成网格
TileMesh build_tile_mesh(Vector<TileMapCell>& cells) {
    TileMesh mesh;
    
    for (auto& cell : cells) {
        Rect2 texture_rect = get_texture_rect(cell);
        Vector2 position = cell_to_world(cell.position);
        
        // 添加四个顶点（Quad）
        mesh.vertices.push_back({position + Vector2(0, 0), texture_rect.position});
        mesh.vertices.push_back({position + Vector2(1, 0), texture_rect.position + Vector2(texture_rect.size.x, 0)});
        mesh.vertices.push_back({position + Vector2(1, 1), texture_rect.position + texture_rect.size});
        mesh.vertices.push_back({position + Vector2(0, 1), texture_rect.position + Vector2(0, texture_rect.size.y)});
        
        // 添加索引（两个三角形）
        int base = mesh.vertices.size() - 4;
        mesh.indices.append_array({base, base+1, base+2, base, base+2, base+3});
    }
    
    return mesh;
}
```

## 高级特性

### 1. Autotiling（自动瓦片）

使用位掩码（Bitmask）自动选择合适的瓦片变体：

```cpp
int calculate_autotile_bitmask(Vector2i pos) {
    int mask = 0;
    
    // 检查 8 个邻居
    if (has_tile(pos + Vector2i(-1, -1))) mask |= 1 << 0;  // 左上
    if (has_tile(pos + Vector2i(0, -1)))  mask |= 1 << 1;  // 上
    if (has_tile(pos + Vector2i(1, -1)))  mask |= 1 << 2;  // 右上
    if (has_tile(pos + Vector2i(-1, 0)))  mask |= 1 << 3;  // 左
    if (has_tile(pos + Vector2i(1, 0)))   mask |= 1 << 4;  // 右
    if (has_tile(pos + Vector2i(-1, 1)))  mask |= 1 << 5;  // 左下
    if (has_tile(pos + Vector2i(0, 1)))   mask |= 1 << 6;  // 下
    if (has_tile(pos + Vector2i(1, 1)))   mask |= 1 << 7;  // 右下
    
    return mask;
}
```

### 2. Terrain System（地形系统）

Godot 4 引入的高级地形绘制系统：

- **Terrain Sets**：定义地形类型（草地、泥土、水等）
- **Terrain Peering Bits**：定义瓦片边缘如何连接
- **自动匹配**：根据相邻瓦片自动选择过渡瓦片

### 3. Alternative Tiles（变体瓦片）

同一瓦片的多个变体（旋转、翻转、颜色变化等）：

```cpp
struct TileAlternative {
    int id;
    bool flip_h;
    bool flip_v;
    bool transpose;  // 对角翻转
    Vector2 texture_origin;
}
```

## 物理和碰撞

### 碰撞优化

```cpp
// 合并相邻瓦片的碰撞体
Vector<Rect2> merge_collision_shapes(Vector<Vector2i> tiles) {
    // 使用扫描线算法合并矩形
    Vector<Rect2> merged_rects;
    
    // 按行扫描
    for (int y = min_y; y <= max_y; y++) {
        int start_x = -1;
        for (int x = min_x; x <= max_x + 1; x++) {
            bool has_tile = tiles.has(Vector2i(x, y));
            
            if (has_tile && start_x == -1) {
                start_x = x;
            } else if (!has_tile && start_x != -1) {
                merged_rects.push_back(Rect2(start_x, y, x - start_x, 1));
                start_x = -1;
            }
        }
    }
    
    // 垂直合并相同宽度的矩形
    merge_vertical_rects(merged_rects);
    
    return merged_rects;
}
```

## 性能指标

Godot TileMap 的典型性能表现：

- **Draw Calls**：通常 1-10 个（取决于使用的纹理数量）
- **渲染瓦片数**：可渲染 100,000+ 瓦片，60+ FPS
- **内存占用**：稀疏存储，每个瓦片约 12-16 字节
- **更新速度**：脏矩形优化，局部更新 < 1ms

## 与 WebGPU 实现的对比

### 可借鉴的设计：

1. **纹理图集**：减少纹理切换
2. **实例化渲染**：利用 GPU 并行处理
3. **分块剔除**：减少不必要的渲染
4. **稀疏存储**：内存高效
5. **网格缓存**：预处理数据

### WebGPU 特有优势：

1. **Compute Shader**：可用于动态更新大量瓦片
2. **更灵活的 Buffer 管理**：SSBO、Uniform Buffer
3. **异步资源加载**：更好的流式加载支持
4. **现代 GPU 特性**：间接绘制、多重绘制

## 实现建议

基于 Godot 的经验，WebGPU + TypeScript 实现应考虑：

1. **使用 Texture Atlas**：将所有瓦片合并到少数纹理中
2. **实例化 API**：使用 `drawIndexedIndirect` 或 `drawIndexed` 配合实例数
3. **GPU Buffer 存储瓦片数据**：使用 Storage Buffer 存储瓦片位置和属性
4. **Compute Shader 更新**：对于大量瓦片变化，使用 Compute Shader
5. **分层渲染**：支持多个渲染层，每层独立 z-index
6. **视锥剔除**：CPU 端快速剔除不可见分块

## 参考资源

- Godot 源码：`scene/2d/tile_map.cpp`
- Godot 文档：https://docs.godotengine.org/en/stable/classes/class_tilemap.html
- GDC 演讲：2D Rendering Optimization Techniques

## 总结

Godot TileMap 系统的核心优化策略：
- **批处理**：减少 Draw Call
- **图集化**：减少纹理切换
- **实例化**：利用 GPU 并行
- **稀疏存储**：节省内存
- **智能剔除**：只渲染可见部分
- **增量更新**：只更新变化区域

这些原则同样适用于任何 2D 瓦片地图渲染引擎的实现。

