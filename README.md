# OllO渲染引擎

## 背景

使用AssemblyScript实现基于SharedArrayBuffer的多线程ECS架构参照Bevy支持无限组件并做WASM中特定优化。

## 技术基础

- AssemblyScript -> WebAssembly + SIMD
- WebGPU
- WebWorker + Atomics
- SharedArrayBuffer(SAB)
- requestAnimationFrame(rAF)

## 摘要

- 参照Bevy引擎的ECS架构设计：支持无限组件、高性能O(1)复杂度操作实体、组件、使用SoA紧密存储。
- 一个主线程：获取画布转移至渲染线程、初始化、监听用户输入、rAF同步(Atomics.notify + postMessage)
- 一个渲染进程：负责与WebGPU API交互、剔除(Culling)、提交指令; Atomics.wait (响应心跳)
- 多个逻辑线程：物理(碰撞、移动等)、AI(寻路、决策等)、动画、游戏玩法; Atomics.wait (响应心跳)
- 多个资产线程：加载、解压、解析资源; postMessage (任务驱动)

## 实体组件架构（ECS）基础

### 实体（Entity）
- **定义**：游戏中独立的对象标识符
- **特点**：仅包含唯一ID，不包含数据或行为
- **管理**：通过EntityManager统一管理

### 组件（Component）
- **定义**：纯数据容器，描述实体的某一属性
- **特点**：无逻辑，可序列化，支持热插拔
- **分类**：渲染、物理、AI、音频、UI等

### 系统（System）
- **定义**：处理具有特定组件的实体的逻辑
- **特点**：纯逻辑，可并行执行，按优先级排序

### 资源 (Resource)
- **定义**：全局状态、模型、纹理、音频


## 面向大规模并行调度的ECS架构设计


传统的 ECS 在每一帧的 `update` 中，通常是这样做的：

```typescript
// 传统方式 (低效且串行)
for (const system of systems) {
  system.update(world);
}
```

这种方式的致命弱点是**完全串行**。`PhysicsSystem` 必须等待 `AISystem` 完成，即使它们可能操作的是完全不相干的数据。

我们的新架构将颠覆这一模式。核心思想是：

1.  **系统自我声明 (System Self-Declaration)**: 每个系统在创建时，必须明确**声明**它将要**读取**哪些组件和**写入**哪些组件。
2.  **调度器构建依赖图 (Scheduler Builds Dependency Graph)**: 调度器在每一帧开始前（或在初始化时一次性），根据所有系统的声明，自动构建一个任务依赖图。它能精确地知道哪些系统可以并行，哪些必须串行。
3.  **数据并行 (Data Parallelism)**: 对于可以并行的系统（如 `MovementSystem`），调度器能将其工作**分解**成更小的块，分发给多个 Worker 核心同时处理。


## 数据结构

```ts
type Entity = u32;  // 每个实体是一个数字
type ComponentId = u32; // 每个组件的唯一标识是一个数字

```