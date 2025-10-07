/**
 * TileMap 编辑器主组件
 * 提供完整的瓦片地图编辑功能
 */

import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';
import { TileMapData, TileMapDataManager } from './TileMapData';
import { TileSet, TileSetManager } from './TileSet';
import { TileMapRenderer } from './TileMapRenderer';
import { GridDetector } from './GridDetector';
import './TileMapEditor.css';

export function TileMapEditor() {
  // Canvas refs
  let canvasRef: HTMLCanvasElement | undefined;
  let tilesetPreviewRef: HTMLCanvasElement | undefined;

  // Signals
  const [mapData, setMapData] = createSignal<TileMapData>(
    TileMapDataManager.createEmptyMap(50, 50, 32, 32)
  );
  const [currentLayer, setCurrentLayer] = createSignal(0);
  const [selectedTile, setSelectedTile] = createSignal<{ tilesetId: number; tileIndex: number } | null>(null);
  const [selectedTileSet, setSelectedTileSet] = createSignal<number | null>(null);
  const [tool, setTool] = createSignal<'brush' | 'eraser' | 'fill'>('brush');
  const [isDrawing, setIsDrawing] = createSignal(false);
  const [gridVisible, setGridVisible] = createSignal(true);

  // WebGPU objects
  let device: GPUDevice | undefined;
  let context: GPUCanvasContext | undefined;
  let renderer: TileMapRenderer | undefined;
  let tileSetManager: TileSetManager | undefined;

  // View transform
  const [viewTransform, setViewTransform] = createSignal({ x: 0, y: 0, zoom: 1.0 });
  const [isPanning, setIsPanning] = createSignal(false);
  const [lastMousePos, setLastMousePos] = createSignal({ x: 0, y: 0 });

  /**
   * 初始化 WebGPU
   */
  const initWebGPU = async () => {
    if (!canvasRef) return false;

    if (!navigator.gpu) {
      alert('WebGPU 不支持');
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        alert('无法获取 GPU 适配器');
        return false;
      }

      device = await adapter.requestDevice();
      const ctx = canvasRef.getContext('webgpu');
      if (!ctx) {
        alert('无法获取 WebGPU 上下文');
        return false;
      }
      context = ctx;

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: 'premultiplied',
      });

      // 初始化管理器和渲染器
      tileSetManager = new TileSetManager();
      renderer = new TileMapRenderer(canvasRef, device, context, format, tileSetManager);
      await renderer.init();
      renderer.setMapData(mapData());

      return true;
    } catch (error) {
      console.error('WebGPU 初始化失败:', error);
      alert('WebGPU 初始化失败');
      return false;
    }
  };

  /**
   * 渲染循环
   */
  const renderLoop = () => {
    if (!renderer) return;

    renderer.render();

    // 绘制网格
    if (gridVisible() && canvasRef) {
      drawGrid();
    }

    requestAnimationFrame(renderLoop);
  };

  /**
   * 绘制网格
   */
  const drawGrid = () => {
    if (!canvasRef) return;

    const canvas = canvasRef;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    const data = mapData();
    const vt = viewTransform();
    const tileWidth = data.tileWidth * vt.zoom;
    const tileHeight = data.tileHeight * vt.zoom;
    const offsetX = -vt.x * vt.zoom + canvas.width / 2;
    const offsetY = -vt.y * vt.zoom + canvas.height / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;

    // 绘制垂直线
    for (let x = 0; x <= data.width; x++) {
      const screenX = offsetX + x * tileWidth;
      if (screenX >= 0 && screenX <= canvas.width) {
        ctx.beginPath();
        ctx.moveTo(screenX, Math.max(0, offsetY));
        ctx.lineTo(screenX, Math.min(canvas.height, offsetY + data.height * tileHeight));
        ctx.stroke();
      }
    }

    // 绘制水平线
    for (let y = 0; y <= data.height; y++) {
      const screenY = offsetY + y * tileHeight;
      if (screenY >= 0 && screenY <= canvas.height) {
        ctx.beginPath();
        ctx.moveTo(Math.max(0, offsetX), screenY);
        ctx.lineTo(Math.min(canvas.width, offsetX + data.width * tileWidth), screenY);
        ctx.stroke();
      }
    }
  };

  /**
   * 处理文件上传
   */
  const handleFileUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !device || !tileSetManager) return;

    const file = input.files[0];
    const tileSet = await TileSet.createFromFile(file, tileSetManager.getAllTileSets().length, device);
    
    if (tileSet) {
      tileSetManager.addTileSet(tileSet);
      setSelectedTileSet(tileSet.getDefinition().id);
      
      // 更新预览
      updateTileSetPreview(tileSet);
      
      // 重建渲染批次
      if (renderer) {
        renderer.setMapData(mapData());
      }
    }

    // 清空 input
    input.value = '';
  };

  /**
   * 更新瓦片集预览
   */
  const updateTileSetPreview = (tileSet: TileSet) => {
    if (!tilesetPreviewRef) return;

    const img = tileSet.getImage();
    if (!img) return;

    const canvas = tilesetPreviewRef;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);

    // 绘制网格
    const def = tileSet.getDefinition();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 1;

    for (let row = 0; row <= def.rows; row++) {
      const y = def.margin + row * (def.tileHeight + def.spacing);
      ctx.beginPath();
      ctx.moveTo(def.margin, y);
      ctx.lineTo(def.margin + def.columns * (def.tileWidth + def.spacing), y);
      ctx.stroke();
    }

    for (let col = 0; col <= def.columns; col++) {
      const x = def.margin + col * (def.tileWidth + def.spacing);
      ctx.beginPath();
      ctx.moveTo(x, def.margin);
      ctx.lineTo(x, def.margin + def.rows * (def.tileHeight + def.spacing));
      ctx.stroke();
    }
  };

  /**
   * 处理画布鼠标事件
   */
  const handleCanvasMouseDown = (event: MouseEvent) => {
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      // 中键或 Alt+左键：平移
      setIsPanning(true);
      setLastMousePos({ x: event.clientX, y: event.clientY });
    } else if (event.button === 0) {
      // 左键：绘制
      setIsDrawing(true);
      drawAtPosition(event);
    }
  };

  const handleCanvasMouseMove = (event: MouseEvent) => {
    if (isPanning()) {
      const dx = event.clientX - lastMousePos().x;
      const dy = event.clientY - lastMousePos().y;
      const vt = viewTransform();
      setViewTransform({ ...vt, x: vt.x - dx / vt.zoom, y: vt.y - dy / vt.zoom });
      setLastMousePos({ x: event.clientX, y: event.clientY });
      
      if (renderer) {
        renderer.setViewTransform(viewTransform());
      }
    } else if (isDrawing()) {
      drawAtPosition(event);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setIsDrawing(false);
  };

  const handleCanvasWheel = (event: WheelEvent) => {
    event.preventDefault();
    const vt = viewTransform();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5.0, vt.zoom * zoomFactor));
    setViewTransform({ ...vt, zoom: newZoom });
    
    if (renderer) {
      renderer.setViewTransform(viewTransform());
    }
  };

  /**
   * 在指定位置绘制
   */
  const drawAtPosition = (event: MouseEvent) => {
    if (!renderer || !canvasRef) return;

    const rect = canvasRef.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const tilePos = renderer.screenToTile(x, y);
    const data = mapData();
    
    if (tilePos.x < 0 || tilePos.x >= data.width || tilePos.y < 0 || tilePos.y >= data.height) {
      return;
    }

    const currentTool = tool();
    const layer = currentLayer();

    if (currentTool === 'brush' && selectedTile()) {
      const tile = selectedTile()!;
      setMapData(TileMapDataManager.setTile(data, layer, tilePos.x, tilePos.y, tile));
    } else if (currentTool === 'eraser') {
      setMapData(TileMapDataManager.setTile(data, layer, tilePos.x, tilePos.y, null));
    }

    // 更新渲染器
    renderer.setMapData(mapData());
  };

  /**
   * 处理瓦片集预览点击
   */
  const handleTileSetClick = (event: MouseEvent) => {
    if (!tilesetPreviewRef || !tileSetManager || selectedTileSet() === null) return;

    const tileSet = tileSetManager.getTileSet(selectedTileSet()!);
    if (!tileSet) return;

    const rect = tilesetPreviewRef.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const def = tileSet.getDefinition();
    const col = Math.floor((x - def.margin) / (def.tileWidth + def.spacing));
    const row = Math.floor((y - def.margin) / (def.tileHeight + def.spacing));

    if (col >= 0 && col < def.columns && row >= 0 && row < def.rows) {
      const tileIndex = row * def.columns + col;
      setSelectedTile({ tilesetId: def.id, tileIndex });
    }
  };

  /**
   * 导出地图
   */
  const exportMap = async () => {
    const json = await TileMapDataManager.exportMap(mapData(), true);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tilemap.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * 导入地图
   */
  const importMap = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !device || !tileSetManager) return;

    const file = input.files[0];
    const text = await file.text();
    
    try {
      const imported = TileMapDataManager.importMap(text);
      
      // 清空现有瓦片集
      tileSetManager.clear();
      
      // 加载瓦片集
      for (const tsDef of imported.tileSets) {
        const ts = await TileSet.createFromDefinition(tsDef, device);
        if (ts) {
          tileSetManager.addTileSet(ts);
        }
      }
      
      setMapData(imported);
      
      if (renderer) {
        renderer.setMapData(imported);
      }
      
      alert('地图导入成功！');
    } catch (error) {
      console.error('导入失败:', error);
      alert('地图导入失败！');
    }

    input.value = '';
  };

  /**
   * 添加图层
   */
  const addLayer = () => {
    const newData = TileMapDataManager.addLayer(mapData(), `Layer ${mapData().layers.length + 1}`);
    setMapData(newData);
  };

  /**
   * 调整地图大小
   */
  const resizeMap = () => {
    const width = parseInt(prompt('地图宽度（瓦片数）:', mapData().width.toString()) || '50');
    const height = parseInt(prompt('地图高度（瓦片数）:', mapData().height.toString()) || '50');
    
    if (width > 0 && height > 0) {
      const newData = TileMapDataManager.createEmptyMap(width, height, mapData().tileWidth, mapData().tileHeight);
      setMapData(newData);
      
      if (renderer) {
        renderer.setMapData(newData);
      }
    }
  };

  // 初始化
  onMount(async () => {
    const success = await initWebGPU();
    if (success) {
      renderLoop();
    }
  });

  // 清理
  onCleanup(() => {
    if (renderer) {
      renderer.destroy();
    }
    if (tileSetManager) {
      tileSetManager.clear();
    }
  });

  // 监听地图数据变化
  createEffect(() => {
    if (renderer) {
      renderer.setMapData(mapData());
    }
  });

  return (
    <div class="tilemap-editor">
      {/* 工具栏 */}
      <div class="toolbar">
        <div class="toolbar-section">
          <h3>文件</h3>
          <button onClick={() => document.getElementById('import-map')?.click()}>
            导入地图
          </button>
          <input
            id="import-map"
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={importMap}
          />
          <button onClick={exportMap}>导出地图</button>
        </div>

        <div class="toolbar-section">
          <h3>地图</h3>
          <button onClick={resizeMap}>调整大小</button>
          <button onClick={addLayer}>添加图层</button>
          <label>
            <input
              type="checkbox"
              checked={gridVisible()}
              onChange={(e) => setGridVisible(e.currentTarget.checked)}
            />
            显示网格
          </label>
        </div>

        <div class="toolbar-section">
          <h3>工具</h3>
          <button
            class={tool() === 'brush' ? 'active' : ''}
            onClick={() => setTool('brush')}
          >
            笔刷
          </button>
          <button
            class={tool() === 'eraser' ? 'active' : ''}
            onClick={() => setTool('eraser')}
          >
            橡皮擦
          </button>
        </div>

        <div class="toolbar-section">
          <h3>图层</h3>
          <select
            value={currentLayer()}
            onChange={(e) => setCurrentLayer(parseInt(e.currentTarget.value))}
          >
            <For each={mapData().layers}>
              {(layer, index) => (
                <option value={index()}>{layer.name}</option>
              )}
            </For>
          </select>
        </div>
      </div>

      {/* 主工作区 */}
      <div class="workspace">
        {/* 画布 */}
        <div class="canvas-container">
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
          />
        </div>

        {/* 侧边栏 */}
        <div class="sidebar">
          {/* 瓦片集管理 */}
          <div class="panel">
            <h3>瓦片集</h3>
            <button onClick={() => document.getElementById('upload-tileset')?.click()}>
              上传瓦片集
            </button>
            <input
              id="upload-tileset"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            
            <Show when={tileSetManager}>
              <For each={tileSetManager!.getAllTileSets()}>
                {(ts) => (
                  <div
                    class={`tileset-item ${selectedTileSet() === ts.getDefinition().id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedTileSet(ts.getDefinition().id);
                      updateTileSetPreview(ts);
                    }}
                  >
                    {ts.getDefinition().name}
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* 瓦片选择器 */}
          <div class="panel">
            <h3>瓦片</h3>
            <div class="tileset-preview-container">
              <canvas
                ref={tilesetPreviewRef}
                onClick={handleTileSetClick}
              />
            </div>
          </div>

          {/* 信息面板 */}
          <div class="panel">
            <h3>信息</h3>
            <div>地图大小: {mapData().width} x {mapData().height}</div>
            <div>瓦片大小: {mapData().tileWidth} x {mapData().tileHeight}</div>
            <div>缩放: {(viewTransform().zoom * 100).toFixed(0)}%</div>
            <Show when={selectedTile()}>
              <div>选中瓦片: #{selectedTile()!.tileIndex}</div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

