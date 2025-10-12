## 背景介绍

我需要认真学习Godot游戏引擎中的Tilemap实现，打造一个基于WebGPU、TypeScript的高性能的2d游戏渲染引擎。
我已经熟WebGPU的基础使用；已经熟悉TypeScript。

## 你的任务

### 任务一

详细介绍Godot中TileMap的具体实现，并将其记录在docs/render。

### 任务二

讨论以下话题，分别记录文档在docs/render：

1. 详细介绍纹理图片加载、处理、缓存、绘制到canvas的最佳方式。
2. 2d游戏场景下如何高效地使用WebGPU实现Tilemap。
3. 当前话题中什么场景适合使用AssemblyScript编译出WASM发挥性能优势（请注意JS<->WASM存在调用开销;大多数场景下并不如引擎优化后的JS）。
