# Godot 级别 2D TileMap 编辑器 Web 实现详细技术方案

## 📋 概述

本文档详细阐述了一个基于 Web 的 Godot 级别 2D TileMap 编辑器的完整技术实现方案，采用五层架构设计，包含具体的数据结构、API 设计和层间交互关系。

## 🏗️ 五层架构详细设计

### 第一层：数据持久层 (Data Persistence Layer)

#### 核心职责
- 文件 I/O 操作
- 数据序列化/反序列化
- 缓存管理
- 版本控制

#### 数据结构设计

```typescript
// 核心数据模型
interface TileMapProject {
  metadata: ProjectMetadata;
  tilesetData: TileSetData;
  mapData: MapData;
  historyData: HistoryData;
}

interface ProjectMetadata {
  id: string;
  name: string;
  version: string;
  createdAt: Date;
  modifiedAt: Date;
  settings: ProjectSettings;
}

interface ProjectSettings {
  tileSize: Vector2;
  gridWidth: number;
  gridHeight: number;
  backgroundColor: string;
  snapToGrid: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
}

// TileSet 数据结构
interface TileSetData {
  id: string;
  name: string;
  texturePath: string;
  tileSize: Vector2;
  tiles: Map<number, TileData>;
  atlases: AtlasData[];
  animations: AnimationData[];
}

interface TileData {
  id: number;
  sourceRect: Rectangle;
  collisionShapes: CollisionShape[];
  navigationShapes: NavigationShape[];
  occlusionLayer: number;
  zIndex: number;
  customProperties: Map<string, any>;
  neighbors: NeighborInfo;
}

interface AtlasData {
  id: string;
  texturePath: string;
  margin: Vector2;
  separation: Vector2;
  region: Rectangle;
  tileColumns: number;
  tileRows: number;
}

// Map 数据结构
interface MapData {
  layers: LayerData[];
  globalProperties: Map<string, any>;
}

interface LayerData {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
  tiles: Map<string, TileInstance>;
  properties: Map<string, any>;
}

interface TileInstance {
  position: Vector2Int;
  tileId: number;
  transform: TileTransform;
  modulate: Color;
  zIndex: number;
}

interface TileTransform {
  flipX: boolean;
  flipY: boolean;
  transpose: boolean;
  rotation: number; // 0, 90, 180, 270
}
```

#### API 设计

```typescript
class DataPersistenceManager {
  private cache: Map<string, TileMapProject>;
  private eventEmitter: EventEmitter;
  
  // 项目管理
  async createProject(metadata: ProjectMetadata): Promise<TileMapProject>;
  async loadProject(projectId: string): Promise<TileMapProject>;
  async saveProject(project: TileMapProject): Promise<void>;
  async deleteProject(projectId: string): Promise<void>;
  
  // 导入导出
  async exportToJSON(project: TileMapProject): Promise<string>;
  async importFromJSON(jsonData: string): Promise<TileMapProject>;
  async exportToBinary(project: TileMapProject): Promise<ArrayBuffer>;
  async importFromBinary(binaryData: ArrayBuffer): Promise<TileMapProject>;
  
  // 缓存管理
  async cacheProject(project: TileMapProject): Promise<void>;
  async getCachedProject(projectId: string): Promise<TileMapProject | null>;
  async clearCache(): Promise<void>;
  
  // 事务支持
  async beginTransaction(): Promise<Transaction>;
  async commitTransaction(transaction: Transaction): Promise<void>;
  async rollbackTransaction(transaction: Transaction): Promise<void>;
}

interface Transaction {
  id: string;
  operations: DataOperation[];
  snapshot: TileMapProject;
}

interface DataOperation {
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  timestamp: Date;
}
```

### 第二层：业务逻辑层 (Business Logic Layer)

#### 核心职责
- 编辑器状态管理
- 命令模式实现
- 验证和规则检查
- 业务计算

#### 状态管理设计

```typescript
class EditorStateManager {
  private state: EditorState;
  private history: CommandHistory;
  private eventBus: EventBus;
  
  constructor() {
    this.state = this.createInitialState();
    this.history = new CommandHistory();
    this.eventBus = new EventBus();
    this.initializeEventHandlers();
  }
  
  createInitialState(): EditorState {
    return {
      currentProject: null,
      selectedTool: 'brush',
      selectedTileId: -1,
      activeLayerId: null,
      camera: new CameraState(),
      selection: new SelectionState(),
      clipboard: new ClipboardState(),
      preferences: new PreferencesState(),
      ui: new UIState()
    };
  }
}

interface EditorState {
  currentProject: TileMapProject | null;
  selectedTool: ToolType;
  selectedTileId: number;
  activeLayerId: string | null;
  camera: CameraState;
  selection: SelectionState;
  clipboard: ClipboardState;
  preferences: PreferencesState;
  ui: UIState;
}

interface CameraState {
  position: Vector2;
  zoom: number;
  rotation: number;
  viewport: Rectangle;
}

interface SelectionState {
  selectedTiles: Set<string>;
  selectedLayer: string | null;
  selectionMode: SelectionMode;
  selectionRect: Rectangle | null;
}
```

#### 命令系统实现

```typescript
abstract class Command {
  abstract execute(): Promise<void>;
  abstract undo(): Promise<void>;
  abstract getDescription(): string;
  
  // 支持批量操作
  abstract getAffectedEntities(): string[];
}

class SetTileCommand extends Command {
  constructor(
    private layerId: string,
    private position: Vector2Int,
    private tileId: number,
    private oldTileId: number,
    private history: CommandHistory
  ) {
    super();
  }
  
  async execute(): Promise<void> {
    const state = this.history.getState();
    const layer = state.mapData.layers.find(l => l.id === this.layerId);
    if (!layer) throw new Error(`Layer ${this.layerId} not found`);
    
    const key = `${this.position.x},${this.position.y}`;
    layer.tiles.set(key, {
      position: this.position,
      tileId: this.tileId,
      transform: { flipX: false, flipY: false, transpose: false, rotation: 0 },
      modulate: { r: 1, g: 1, b: 1, a: 1 },
      zIndex: 0
    });
    
    this.history.emitEvent('tileChanged', {
      layerId: this.layerId,
      position: this.position,
      tileId: this.tileId
    });
  }
  
  async undo(): Promise<void> {
    const state = this.history.getState();
    const layer = state.mapData.layers.find(l => l.id === this.layerId);
    if (!layer) return;
    
    const key = `${this.position.x},${this.position.y}`;
    if (this.oldTileId === -1) {
      layer.tiles.delete(key);
    } else {
      const existingTile = layer.tiles.get(key);
      if (existingTile) {
        existingTile.tileId = this.oldTileId;
      }
    }
    
    this.history.emitEvent('tileChanged', {
      layerId: this.layerId,
      position: this.position,
      tileId: this.oldTileId
    });
  }
  
  getDescription(): string {
    return `Set tile ${this.tileId} at (${this.position.x}, ${this.position.y})`;
  }
  
  getAffectedEntities(): string[] {
    return [`${this.layerId}:${this.position.x},${this.position.y}`];
  }
}

class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private state: EditorState;
  private maxHistorySize: number = 100;
  
  async executeCommand(command: Command): Promise<void> {
    await command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
    
    this.emitEvent('historyChanged', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }
  
  async undo(): Promise<void> {
    if (!this.canUndo()) return;
    
    const command = this.undoStack.pop()!;
    await command.undo();
    this.redoStack.push(command);
    
    this.emitEvent('historyChanged', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }
  
  async redo(): Promise<void> {
    if (!this.canRedo()) return;
    
    const command = this.redoStack.pop()!;
    await command.execute();
    this.undoStack.push(command);
    
    this.emitEvent('historyChanged', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }
  
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
```

#### 工具系统实现

```typescript
abstract class Tool {
  protected state: EditorState;
  protected eventBus: EventBus;
  
  constructor(state: EditorState, eventBus: EventBus) {
    this.state = state;
    this.eventBus = eventBus;
  }
  
  abstract onMouseDown(event: MouseEvent): Promise<void>;
  abstract onMouseMove(event: MouseEvent): Promise<void>;
  abstract onMouseUp(event: MouseEvent): Promise<void>;
  abstract onKeyDown(event: KeyboardEvent): Promise<void>;
  abstract onKeyUp(event: KeyboardEvent): Promise<void>;
  abstract getCursor(): string;
  abstract getToolName(): string;
}

class BrushTool extends Tool {
  private isDrawing: boolean = false;
  private lastDrawPosition: Vector2Int | null = null;
  
  async onMouseDown(event: MouseEvent): Promise<void> {
    if (event.button !== 0) return; // 只响应左键
    
    this.isDrawing = true;
    const worldPos = this.screenToWorld(event.clientX, event.clientY);
    const tilePos = this.worldToTile(worldPos);
    
    await this.paintTile(tilePos);
    this.lastDrawPosition = tilePos;
  }
  
  async onMouseMove(event: MouseEvent): Promise<void> {
    if (!this.isDrawing) return;
    
    const worldPos = this.screenToWorld(event.clientX, event.clientY);
    const tilePos = this.worldToTile(worldPos);
    
    if (!this.lastDrawPosition || 
        !this.lastDrawPosition.equals(tilePos)) {
      await this.drawLine(this.lastDrawPosition || tilePos, tilePos);
      this.lastDrawPosition = tilePos;
    }
  }
  
  async onMouseUp(event: MouseEvent): Promise<void> {
    if (event.button !== 0) return;
    
    this.isDrawing = false;
    this.lastDrawPosition = null;
  }
  
  private async paintTile(tilePos: Vector2Int): Promise<void> {
    if (!this.state.activeLayerId || this.state.selectedTileId === -1) return;
    
    const command = new SetTileCommand(
      this.state.activeLayerId,
      tilePos,
      this.state.selectedTileId,
      this.getExistingTileId(tilePos),
      this.history
    );
    
    await this.history.executeCommand(command);
  }
  
  private async drawLine(start: Vector2Int, end: Vector2Int): Promise<void> {
    const points = this.getLinePoints(start, end);
    
    for (const point of points) {
      await this.paintTile(point);
    }
  }
  
  private getLinePoints(start: Vector2Int, end: Vector2Int): Vector2Int[] {
    const points: Vector2Int[] = [];
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const sx = start.x < end.x ? 1 : -1;
    const sy = start.y < end.y ? 1 : -1;
    let err = dx - dy;
    let current = start.clone();
    
    while (true) {
      points.push(current.clone());
      
      if (current.equals(end)) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        current.x += sx;
      }
      if (e2 < dx) {
        err += dx;
        current.y += sy;
      }
    }
    
    return points;
  }
}
```

### 第三层：渲染引擎层 (Rendering Engine Layer)

#### 核心职责
- WebGPU 渲染管线管理
- 实例化渲染
- 视锥剔除
- 批处理优化

#### WebGPU 渲染实现

```typescript
class WebGPURenderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private pipeline: GPURenderPipeline;
  private instanceBuffer: GPUBuffer;
  private uniformBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private textureManager: TextureManager;
  private chunkManager: ChunkManager;
  
  constructor(canvas: HTMLCanvasElement) {
    this.initializeWebGPU(canvas);
    this.createRenderPipeline();
    this.setupBuffers();
  }
  
  private async initializeWebGPU(canvas: HTMLCanvasElement): Promise<void> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('WebGPU not supported');
    
    this.device = await adapter.requestDevice();
    this.context = canvas.getContext('webgpu')!;
    
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: presentationFormat,
      alphaMode: 'premultiplied',
    });
  }
  
  private createRenderPipeline(): void {
    const vertexShaderCode = `
      struct InstanceData {
        position: vec2<f32>,
        uv_offset: vec2<f32>,
        uv_size: vec2<f32>,
        color: vec4<f32>,
        transform: vec4<f32>, // flipX, flipY, transpose, rotation
      };
      
      struct Uniforms {
        view_matrix: mat3x3<f32>,
        projection_matrix: mat3x3<f32>,
        tile_size: vec2<f32>,
        time: f32,
      };
      
      @binding(0) @group(0) var<uniform> uniforms: Uniforms;
      @binding(1) @group(0) var<storage, read> instances: array<InstanceData>;
      @binding(2) @group(0) var texture_sampler: sampler;
      @binding(3) @group(0) var texture: texture_2d<f32>;
      
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
        @location(1) color: vec4<f32>,
      };
      
      @vertex
      fn main(@builtin(vertex_index) vertex_index: u32,
              @builtin(instance_index) instance_index: u32) -> VertexOutput {
        var output: VertexOutput;
        
        let instance = instances[instance_index];
        
        // 计算顶点位置
        let base_positions = array<vec2<f32>, 4>(
          vec2<f32>(0.0, 0.0),
          vec2<f32>(1.0, 0.0),
          vec2<f32>(0.0, 1.0),
          vec2<f32>(1.0, 1.0)
        );
        
        let base_uvs = array<vec2<f32>, 4>(
          vec2<f32>(0.0, 0.0),
          vec2<f32>(1.0, 0.0),
          vec2<f32>(0.0, 1.0),
          vec2<f32>(1.0, 1.0)
        );
        
        var position = base_positions[vertex_index];
        var uv = base_uvs[vertex_index];
        
        // 应用变换
        if (instance.transform.x > 0.5) { // flipX
          position.x = 1.0 - position.x;
          uv.x = 1.0 - uv.x;
        }
        if (instance.transform.y > 0.5) { // flipY
          position.y = 1.0 - position.y;
          uv.y = 1.0 - uv.y;
        }
        if (instance.transform.z > 0.5) { // transpose
          position = position.yx;
          uv = uv.yx;
        }
        
        // 应用旋转
        let rotation = instance.transform.w * 3.14159 / 180.0;
        let cos_r = cos(rotation);
        let sin_r = sin(rotation);
        let rotated = vec2<f32>(
          position.x * cos_r - position.y * sin_r,
          position.x * sin_r + position.y * cos_r
        );
        position = rotated;
        
        // 转换到世界坐标
        position = position * uniforms.tile_size + instance.position;
        
        // 应用视图和投影矩阵
        let world_pos = uniforms.view_matrix * vec3<f32>(position, 1.0);
        let clip_pos = uniforms.projection_matrix * world_pos;
        
        output.position = vec4<f32>(clip_pos.xy, 0.0, 1.0);
        output.uv = uv * instance.uv_size + instance.uv_offset;
        output.color = instance.color;
        
        return output;
      }
    `;
    
    const fragmentShaderCode = `
      @binding(2) @group(0) var texture_sampler: sampler;
      @binding(3) @group(0) var texture: texture_2d<f32>;
      
      @fragment
      fn main(@location(0) uv: vec2<f32>,
              @location(1) color: vec4<f32>) -> @location(0) vec4<f32> {
        let tex_color = textureSample(texture, texture_sampler, uv);
        return tex_color * color;
      }
    `;
    
    const vertexShader = this.device.createShaderModule({
      code: vertexShaderCode
    });
    
    const fragmentShader = this.device.createShaderModule({
      code: fragmentShaderCode
    });
    
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: vertexShader,
        entryPoint: 'main',
      },
      fragment: {
        module: fragmentShader,
        entryPoint: 'main',
        targets: [{
          format: navigator.gpu.getPreferredCanvasFormat(),
        }],
      },
      primitive: {
        topology: 'triangle-strip',
        stripIndexFormat: 'uint32',
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'always',
        format: 'depth24plus',
      },
    });
  }
  
  private setupBuffers(): void {
    // 实例缓冲区
    this.instanceBuffer = this.device.createBuffer({
      size: 1024 * 1024, // 1MB
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    
    // 统一缓冲区
    this.uniformBuffer = this.device.createBuffer({
      size: 256, // 足够存储所有uniform数据
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
  
  render(viewport: Viewport, layers: LayerData[]): void {
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    
    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    
    // 渲染每个可见层
    for (const layer of layers) {
      if (!layer.visible) continue;
      
      const visibleTiles = this.getVisibleTiles(layer, viewport);
      if (visibleTiles.length === 0) continue;
      
      this.updateInstanceBuffer(visibleTiles);
      renderPass.draw(4, visibleTiles.length);
    }
    
    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }
  
  private getVisibleTiles(layer: LayerData, viewport: Viewport): TileInstance[] {
    const visibleTiles: TileInstance[] = [];
    const tileSize = 32; // 从设置获取
    
    for (const tile of layer.tiles.values()) {
      const screenPos = this.worldToScreen(tile.position, viewport);
      if (this.isTileVisible(screenPos, tileSize, viewport)) {
        visibleTiles.push(tile);
      }
    }
    
    return visibleTiles;
  }
  
  private updateInstanceBuffer(tiles: TileInstance[]): void {
    const instanceData = new Float32Array(tiles.length * 12); // 12 floats per instance
    
    tiles.forEach((tile, index) => {
      const offset = index * 12;
      
      // Position (2 floats)
      instanceData[offset] = tile.position.x;
      instanceData[offset + 1] = tile.position.y;
      
      // UV offset (2 floats)
      const uvOffset = this.getUVOffset(tile.tileId);
      instanceData[offset + 2] = uvOffset.x;
      instanceData[offset + 3] = uvOffset.y;
      
      // UV size (2 floats)
      const uvSize = this.getUVSize(tile.tileId);
      instanceData[offset + 4] = uvSize.x;
      instanceData[offset + 5] = uvSize.y;
      
      // Color (4 floats)
      instanceData[offset + 6] = tile.modulate.r;
      instanceData[offset + 7] = tile.modulate.g;
      instanceData[offset + 8] = tile.modulate.b;
      instanceData[offset + 9] = tile.modulate.a;
      
      // Transform (4 floats)
      instanceData[offset + 10] = tile.transform.flipX ? 1 : 0;
      instanceData[offset + 11] = tile.transform.flipY ? 1 : 0;
      // ... 其他变换数据
    });
    
    this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
  }
}
```

#### 分块渲染管理

```typescript
class ChunkManager {
  private chunks: Map<string, MapChunk> = new Map();
  private chunkSize: number = 32;
  private loadRadius: number = 3;
  private unloadRadius: number = 5;
  private eventBus: EventBus;
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }
  
  updateVisibleChunks(viewport: Viewport, layers: LayerData[]): void {
    const visibleChunkKeys = this.getVisibleChunkKeys(viewport);
    const currentChunkKeys = new Set(this.chunks.keys());
    
    // 加载新的可见块
    for (const chunkKey of visibleChunkKeys) {
      if (!this.chunks.has(chunkKey)) {
        this.loadChunk(chunkKey, layers);
      }
    }
    
    // 卸载不可见的块
    for (const chunkKey of currentChunkKeys) {
      if (!visibleChunkKeys.includes(chunkKey)) {
        this.unloadChunk(chunkKey);
      }
    }
  }
  
  private getVisibleChunkKeys(viewport: Viewport): string[] {
    const chunkKeys: string[] = [];
    const startX = Math.floor(viewport.left / this.chunkSize);
    const endX = Math.ceil(viewport.right / this.chunkSize);
    const startY = Math.floor(viewport.top / this.chunkSize);
    const endY = Math.ceil(viewport.bottom / this.chunkSize);
    
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        chunkKeys.push(`${x},${y}`);
      }
    }
    
    return chunkKeys;
  }
  
  private loadChunk(chunkKey: string, layers: LayerData[]): void {
    const [x, y] = chunkKey.split(',').map(Number);
    const chunk = new MapChunk(x, y, this.chunkSize);
    
    // 收集块中的瓦片数据
    for (const layer of layers) {
      if (!layer.visible) continue;
      
      for (const tile of layer.tiles.values()) {
        if (this.isTileInChunk(tile, x, y)) {
          chunk.addTile(layer.id, tile);
        }
      }
    }
    
    this.chunks.set(chunkKey, chunk);
    this.eventBus.emit('chunkLoaded', { chunkKey, chunk });
  }
  
  private unloadChunk(chunkKey: string): void {
    this.chunks.delete(chunkKey);
    this.eventBus.emit('chunkUnloaded', { chunkKey });
  }
  
  private isTileInChunk(tile: TileInstance, chunkX: number, chunkY: number): boolean {
    const tileChunkX = Math.floor(tile.position.x / this.chunkSize);
    const tileChunkY = Math.floor(tile.position.y / this.chunkSize);
    return tileChunkX === chunkX && tileChunkY === chunkY;
  }
}

class MapChunk {
  public readonly x: number;
  public readonly y: number;
  public readonly size: number;
  private tiles: Map<string, TileInstance[]> = new Map();
  private instanceBuffer: GPUBuffer | null = null;
  private dirty: boolean = true;
  
  constructor(x: number, y: number, size: number) {
    this.x = x;
    this.y = y;
    this.size = size;
  }
  
  addTile(layerId: string, tile: TileInstance): void {
    if (!this.tiles.has(layerId)) {
      this.tiles.set(layerId, []);
    }
    this.tiles.get(layerId)!.push(tile);
    this.dirty = true;
  }
  
  removeTile(layerId: string, tile: TileInstance): void {
    const layerTiles = this.tiles.get(layerId);
    if (layerTiles) {
      const index = layerTiles.indexOf(tile);
      if (index !== -1) {
        layerTiles.splice(index, 1);
        this.dirty = true;
      }
    }
  }
  
  getTiles(layerId: string): TileInstance[] {
    return this.tiles.get(layerId) || [];
  }
  
  getAllTiles(): TileInstance[] {
    const allTiles: TileInstance[] = [];
    for (const layerTiles of this.tiles.values()) {
      allTiles.push(...layerTiles);
    }
    return allTiles;
  }
  
  isDirty(): boolean {
    return this.dirty;
  }
  
  markClean(): void {
    this.dirty = false;
  }
}
```

### 第四层：用户界面层 (User Interface Layer)

#### 核心职责
- UI 组件管理
- 用户交互处理
- 视图状态同步
- 输入事件分发

#### 组件架构设计

```typescript
class UIManager {
  private components: Map<string, UIComponent> = new Map();
  private eventBus: EventBus;
  private rootContainer: HTMLElement;
  private themeManager: ThemeManager;
  private layoutManager: LayoutManager;
  
  constructor(rootContainer: HTMLElement, eventBus: EventBus) {
    this.rootContainer = rootContainer;
    this.eventBus = eventBus;
    this.themeManager = new ThemeManager();
    this.layoutManager = new LayoutManager();
    this.initializeComponents();
  }
  
  private initializeComponents(): void {
    // 创建主要 UI 组件
    this.createComponent('toolbar', new ToolbarComponent(this.eventBus));
    this.createComponent('tilesetPanel', new TilesetPanelComponent(this.eventBus));
    this.createComponent('layerPanel', new LayerPanelComponent(this.eventBus));
    this.createComponent('propertyPanel', new PropertyPanelComponent(this.eventBus));
    this.createComponent('canvas', new CanvasComponent(this.eventBus));
    this.createComponent('statusBar', new StatusBarComponent(this.eventBus));
    
    // 设置布局
    this.layoutManager.setupLayout(this.components);
    
    // 绑定事件
    this.bindEvents();
  }
  
  private createComponent<T extends UIComponent>(id: string, component: T): void {
    this.components.set(id, component);
    this.rootContainer.appendChild(component.getElement());
  }
  
  private bindEvents(): void {
    // 监听状态变化并更新 UI
    this.eventBus.on('stateChanged', (event) => {
      this.updateComponents(event);
    });
    
    // 监听主题变化
    this.eventBus.on('themeChanged', (event) => {
      this.themeManager.applyTheme(event.theme);
    });
  }
  
  private updateComponents(event: StateChangedEvent): void {
    for (const [id, component] of this.components) {
      if (component.shouldUpdate(event)) {
        component.update(event);
      }
    }
  }
}

abstract class UIComponent {
  protected element: HTMLElement;
  protected eventBus: EventBus;
  protected isVisible: boolean = true;
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.element = this.createElement();
    this.initialize();
  }
  
  protected abstract createElement(): HTMLElement;
  protected abstract initialize(): void;
  
  abstract shouldUpdate(event: StateChangedEvent): boolean;
  abstract update(event: StateChangedEvent): void;
  
  getElement(): HTMLElement {
    return this.element;
  }
  
  setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.element.style.display = visible ? 'block' : 'none';
  }
  
  destroy(): void {
    this.element.remove();
  }
}

class ToolbarComponent extends UIComponent {
  private tools: Map<string, ToolButton> = new Map();
  private currentTool: string = 'brush';
  
  protected createElement(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.innerHTML = `
      <div class="tool-group">
        <button class="tool-button active" data-tool="brush" title="Brush (B)">
          <i class="icon-brush"></i>
        </button>
        <button class="tool-button" data-tool="eraser" title="Eraser (E)">
          <i class="icon-eraser"></i>
        </button>
        <button class="tool-button" data-tool="rectangle" title="Rectangle (R)">
          <i class="icon-rectangle"></i>
        </button>
        <button class="tool-button" data-tool="fill" title="Fill (F)">
          <i class="icon-fill"></i>
        </button>
        <button class="tool-button" data-tool="select" title="Select (S)">
          <i class="icon-select"></i>
        </button>
      </div>
      <div class="tool-group">
        <button class="tool-button" data-action="undo" title="Undo (Ctrl+Z)">
          <i class="icon-undo"></i>
        </button>
        <button class="tool-button" data-action="redo" title="Redo (Ctrl+Y)">
          <i class="icon-redo"></i>
        </button>
      </div>
      <div class="tool-group">
        <button class="tool-button" data-action="zoom-in" title="Zoom In">
          <i class="icon-zoom-in"></i>
        </button>
        <button class="tool-button" data-action="zoom-out" title="Zoom Out">
          <i class="icon-zoom-out"></i>
        </button>
        <button class="tool-button" data-action="zoom-reset" title="Reset Zoom">
          <i class="icon-zoom-reset"></i>
        </button>
      </div>
    `;
    return toolbar;
  }
  
  protected initialize(): void {
    this.bindToolEvents();
    this.bindActionEvents();
  }
  
  private bindToolEvents(): void {
    const toolButtons = this.element.querySelectorAll('[data-tool]');
    toolButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tool = (e.currentTarget as HTMLElement).dataset.tool!;
        this.selectTool(tool);
      });
    });
  }
  
  private bindActionEvents(): void {
    const actionButtons = this.element.querySelectorAll('[data-action]');
    actionButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action!;
        this.executeAction(action);
      });
    });
  }
  
  private selectTool(tool: string): void {
    if (this.currentTool === tool) return;
    
    // 更新 UI 状态
    const currentButton = this.element.querySelector(`[data-tool="${this.currentTool}"]`);
    const newButton = this.element.querySelector(`[data-tool="${tool}"]`);
    
    if (currentButton) currentButton.classList.remove('active');
    if (newButton) newButton.classList.add('active');
    
    this.currentTool = tool;
    
    // 发送事件
    this.eventBus.emit('toolSelected', { tool });
  }
  
  private executeAction(action: string): void {
    this.eventBus.emit('actionExecuted', { action });
  }
  
  shouldUpdate(event: StateChangedEvent): boolean {
    return event.type === 'toolChanged' || event.type === 'historyChanged';
  }
  
  update(event: StateChangedEvent): void {
    if (event.type === 'toolChanged') {
      this.selectTool(event.tool);
    } else if (event.type === 'historyChanged') {
      this.updateHistoryButtons(event.canUndo, event.canRedo);
    }
  }
  
  private updateHistoryButtons(canUndo: boolean, canRedo: boolean): void {
    const undoButton = this.element.querySelector('[data-action="undo"]') as HTMLButtonElement;
    const redoButton = this.element.querySelector('[data-action="redo"]') as HTMLButtonElement;
    
    if (undoButton) undoButton.disabled = !canUndo;
    if (redoButton) redoButton.disabled = !canRedo;
  }
}

class CanvasComponent extends UIComponent {
  private canvas: HTMLCanvasElement;
  private renderer: WebGPURenderer;
  private inputHandler: InputHandler;
  private camera: Camera;
  
  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'canvas-container';
    
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'main-canvas';
    container.appendChild(this.canvas);
    
    return container;
  }
  
  protected initialize(): void {
    this.renderer = new WebGPURenderer(this.canvas);
    this.camera = new Camera();
    this.inputHandler = new InputHandler(this.canvas, this.camera, this.eventBus);
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();
    
    // 开始渲染循环
    this.startRenderLoop();
  }
  
  private resizeCanvas(): void {
    const container = this.element.parentElement;
    if (!container) return;
    
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    
    this.camera.updateViewport(this.canvas.width, this.canvas.height);
  }
  
  private startRenderLoop(): void {
    const render = () => {
      // 获取当前状态
      const state = this.getCurrentState();
      if (state && state.currentProject) {
        const viewport = this.camera.getViewport();
        this.renderer.render(viewport, state.currentProject.mapData.layers);
      }
      
      requestAnimationFrame(render);
    };
    
    render();
  }
  
  private getCurrentState(): EditorState | null {
    // 从状态管理器获取当前状态
    return null; // 实际实现中会从状态管理器获取
  }
  
  shouldUpdate(event: StateChangedEvent): boolean {
    return event.type === 'projectChanged' || 
           event.type === 'layerChanged' || 
           event.type === 'tileChanged' ||
           event.type === 'cameraChanged';
  }
  
  update(event: StateChangedEvent): void {
    // Canvas 组件通常不需要主动更新，由渲染循环处理
  }
}
```

### 第五层：事件通信层 (Event Communication Layer)

#### 核心职责
- 事件总线管理
- 跨层通信
- 异步事件处理
- 事件过滤和路由

#### 事件系统实现

```typescript
class EventBus {
  private listeners: Map<string, EventListener[]> = new Map();
  private middlewares: EventMiddleware[] = [];
  private eventQueue: Event[] = [];
  private isProcessing: boolean = false;
  
  on(eventType: string, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    this.listeners.get(eventType)!.push(listener);
    
    // 返回取消订阅函数
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }
  
  off(eventType: string, listener: EventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  emit(eventType: string, data?: any): void {
    const event: Event = {
      type: eventType,
      data: data || {},
      timestamp: Date.now(),
      id: this.generateEventId()
    };
    
    // 添加到队列
    this.eventQueue.push(event);
    
    // 异步处理事件
    this.processEvents();
  }
  
  emitSync(eventType: string, data?: any): void {
    const event: Event = {
      type: eventType,
      data: data || {},
      timestamp: Date.now(),
      id: this.generateEventId()
    };
    
    this.processEvent(event);
  }
  
  use(middleware: EventMiddleware): void {
    this.middlewares.push(middleware);
  }
  
  private async processEvents(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      await this.processEvent(event);
    }
    
    this.isProcessing = false;
  }
  
  private async processEvent(event: Event): Promise<void> {
    // 应用中间件
    let processedEvent = event;
    for (const middleware of this.middlewares) {
      processedEvent = await middleware(processedEvent);
      if (!processedEvent) return; // 中间件可以阻止事件传播
    }
    
    // 获取监听器
    const listeners = this.listeners.get(processedEvent.type);
    if (!listeners) return;
    
    // 异步调用所有监听器
    const promises = listeners.map(listener => {
      try {
        return Promise.resolve(listener(processedEvent));
      } catch (error) {
        console.error(`Error in event listener for ${processedEvent.type}:`, error);
        return Promise.resolve();
      }
    });
    
    await Promise.all(promises);
  }
  
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface Event {
  type: string;
  data: any;
  timestamp: number;
  id: string;
}

type EventListener = (event: Event) => void | Promise<void>;

type EventMiddleware = (event: Event) => Event | null | Promise<Event | null>;

// 事件类型定义
interface TileChangedEvent {
  layerId: string;
  position: Vector2Int;
  tileId: number;
  oldTileId: number;
}

interface ToolSelectedEvent {
  tool: string;
}

interface LayerChangedEvent {
  layerId: string;
  changeType: 'created' | 'deleted' | 'modified' | 'reordered';
  data?: any;
}

interface CameraChangedEvent {
  position: Vector2;
  zoom: number;
  viewport: Rectangle;
}

interface ProjectChangedEvent {
  projectId: string;
  changeType: 'created' | 'loaded' | 'saved' | 'modified';
  data?: any;
}

// 事件中间件示例
class LoggingMiddleware implements EventMiddleware {
  async process(event: Event): Promise<Event | null> {
    console.log(`[${event.type}]`, event.data);
    return event;
  }
}

class PerformanceMiddleware implements EventMiddleware {
  private metrics: Map<string, number[]> = new Map();
  
  async process(event: Event): Promise<Event | null> {
    const startTime = performance.now();
    
    // 在事件处理完成后记录性能
    setTimeout(() => {
      const duration = performance.now() - startTime;
      
      if (!this.metrics.has(event.type)) {
        this.metrics.set(event.type, []);
      }
      
      const durations = this.metrics.get(event.type)!;
      durations.push(duration);
      
      // 只保留最近 100 次记录
      if (durations.length > 100) {
        durations.shift();
      }
      
      // 如果平均处理时间超过阈值，发出警告
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      if (avgDuration > 16) { // 16ms 是 60fps 的阈值
        console.warn(`Event ${event.type} is taking too long: ${avgDuration.toFixed(2)}ms average`);
      }
    }, 0);
    
    return event;
  }
  
  getMetrics(): Map<string, { avg: number; min: number; max: number }> {
    const result = new Map();
    
    for (const [eventType, durations] of this.metrics) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      
      result.set(eventType, { avg, min, max });
    }
    
    return result;
  }
}
```

## 🔄 层间交互与调用关系

### 数据流向图

```
用户输入 → UI层 → 事件层 → 业务逻辑层 → 数据持久层
                ↓           ↓
            渲染层 ← 业务逻辑层
```

### 具体交互示例

#### 1. 瓦片绘制流程

```typescript
// 1. 用户在 Canvas 上点击
CanvasComponent.onMouseDown()
  ↓
// 2. 输入处理器处理事件
InputHandler.handleMouseDown()
  ↓
// 3. 发送事件到事件总线
EventBus.emit('mouseDown', { position, button })
  ↓
// 4. 业务逻辑层接收事件
BrushTool.onMouseDown()
  ↓
// 5. 创建并执行命令
CommandHistory.executeCommand(new SetTileCommand(...))
  ↓
// 6. 命令执行，修改数据
SetTileCommand.execute()
  ↓
// 7. 发送数据变化事件
EventBus.emit('tileChanged', { layerId, position, tileId })
  ↓
// 8. 渲染层接收事件并更新
WebGPURenderer.updateTile()
  ↓
// 9. 数据持久层保存（如果启用自动保存）
DataPersistenceManager.saveProject()
```

#### 2. 层管理流程

```typescript
// 1. 用户在图层面板点击添加按钮
LayerPanelComponent.onAddLayer()
  ↓
// 2. 发送添加图层事件
EventBus.emit('addLayerRequested', { name, type })
  ↓
// 3. 业务逻辑层处理请求
LayerManager.addLayer()
  ↓
// 4. 创建新图层数据
const newLayer = createLayer(name, type)
  ↓
// 5. 更新项目数据
state.currentProject.mapData.layers.push(newLayer)
  ↓
// 6. 发送图层变化事件
EventBus.emit('layerChanged', { layerId: newLayer.id, changeType: 'created' })
  ↓
// 7. UI 层更新显示
LayerPanelComponent.update()
TilesetPanelComponent.update()
  ↓
// 8. 渲染层更新
WebGPURenderer.addLayer(newLayer)
```

## 📊 性能优化策略

### 1. 渲染优化

```typescript
class RenderOptimizer {
  private frustumCulling: FrustumCulling;
  private occlusionCulling: OcclusionCulling;
  private lodManager: LODManager;
  
  optimizeRender(viewport: Viewport, layers: LayerData[]): RenderBatch[] {
    const batches: RenderBatch[] = [];
    
    for (const layer of layers) {
      if (!layer.visible) continue;
      
      // 视锥剔除
      const visibleTiles = this.frustumCulling.cull(layer.tiles, viewport);
      
      // 遮挡剔除
      const unoccludedTiles = this.occlusionCulling.cull(visibleTiles, layer);
      
      // LOD 处理
      const lodTiles = this.lodManager.process(unoccludedTiles, viewport.zoom);
      
      // 批处理
      const batch = this.createBatch(layer, lodTiles);
      batches.push(batch);
    }
    
    return batches;
  }
  
  private createBatch(layer: LayerData, tiles: TileInstance[]): RenderBatch {
    // 按纹理分组以减少状态切换
    const textureGroups = this.groupByTexture(tiles);
    
    return {
      layerId: layer.id,
      opacity: layer.opacity,
      zIndex: layer.zIndex,
      textureGroups
    };
  }
}
```

### 2. 内存管理

```typescript
class MemoryManager {
  private textureCache: LRUCache<string, GPUTexture>;
  private chunkCache: LRUCache<string, MapChunk>;
  private maxMemoryUsage: number = 512 * 1024 * 1024; // 512MB
  
  constructor() {
    this.textureCache = new LRUCache(100);
    this.chunkCache = new LRUCache(1000);
    
    // 监听内存使用情况
    this.monitorMemoryUsage();
  }
  
  private monitorMemoryUsage(): void {
    setInterval(() => {
      const usage = this.getMemoryUsage();
      if (usage > this.maxMemoryUsage * 0.8) {
        this.cleanup();
      }
    }, 5000);
  }
  
  private cleanup(): void {
    // 清理最老的纹理
    this.textureCache.clear();
    
    // 清理远离视口的块
    this.chunkCache.clear();
    
    // 强制垃圾回收（如果可用）
    if (window.gc) {
      window.gc();
    }
  }
  
  private getMemoryUsage(): number {
    // 估算内存使用量
    let usage = 0;
    
    for (const texture of this.textureCache.values()) {
      usage += this.estimateTextureSize(texture);
    }
    
    for (const chunk of this.chunkCache.values()) {
      usage += this.estimateChunkSize(chunk);
    }
    
    return usage;
  }
}
```

## 🎯 实现路线图

### 阶段一：基础架构搭建（2 周）
- 实现事件系统
- 搭建基础数据结构
- 创建项目框架

### 阶段二：核心渲染（3 周）
- WebGPU 渲染管线
- 基础瓦片渲染
- 相机控制系统

### 阶段三：编辑功能（2 周）
- 工具系统实现
- 命令模式
- 基础编辑工具

### 阶段四：高级功能（2 周）
- 多层支持
- 撤销重做
- 性能优化

### 阶段五：UI 完善（1 周）
- 用户界面
- 交互优化
- 主题系统

## 💡 关键技术决策

1. **WebGPU vs WebGL**: 选择 WebGPU 以获得更好的性能和现代 API
2. **TypeScript vs JavaScript**: TypeScript 提供更好的类型安全和开发体验
3. **事件驱动架构**: 解耦各层，提高可维护性和可扩展性
4. **命令模式**: 实现撤销重做功能的关键
5. **分块渲染**: 处理大型地图的性能核心策略

这份详细的技术方案提供了完整的五层架构实现，包含了具体的数据结构、API 设计和层间交互关系，为实际开发提供了清晰的指导。