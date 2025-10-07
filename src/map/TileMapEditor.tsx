/**
 * TileMap 编辑器主组件
 * 提供完整的瓦片地图编辑功能
 */

import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';
import { TileMapData, TileMapDataManager, Tile } from './TileMapData';
import { TileSet, TileSetManager } from './TileSet';
import { TileMapRenderer } from './TileMapRenderer';
import { GridDetector } from './GridDetector';
import './TileMapEditor.css';

// 合并瓦片定义
interface MetaTile {
  id: number;
  tiles: number[]; // 瓦片索引数组
  width: number; // 列数
  height: number; // 行数
}

export function TileMapEditor() {
  // Canvas refs
  let canvasRef: HTMLCanvasElement | undefined;
  let gridCanvasRef: HTMLCanvasElement | undefined;
  let tilesetPreviewRef: HTMLCanvasElement | undefined;

  // Signals
  const [mapData, setMapData] = createSignal<TileMapData>(
    TileMapDataManager.createEmptyMap(50, 50, 32, 32)
  );
  const [currentLayer, setCurrentLayer] = createSignal(0);
  const [selectedTiles, setSelectedTiles] = createSignal<number[]>([]); // 支持多选
  const [selectedTileSet, setSelectedTileSet] = createSignal<number | null>(null);
  const [tool, setTool] = createSignal<'brush' | 'eraser' | 'fill'>('brush');
  const [isDrawing, setIsDrawing] = createSignal(false);
  const [gridVisible, setGridVisible] = createSignal(true);
  
  // 网格设置
  const [showGridSettings, setShowGridSettings] = createSignal(false);
  const [gridSettings, setGridSettings] = createSignal({
    tileWidth: 32,
    tileHeight: 32,
    spacing: 0,
    margin: 0,
    columns: 0,
    rows: 0,
  });

  // 合并瓦片
  const [metaTiles, setMetaTiles] = createSignal<Map<number, MetaTile>>(new Map());
  const [isSelecting, setIsSelecting] = createSignal(false);
  const [selectionStart, setSelectionStart] = createSignal<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = createSignal<{ x: number; y: number } | null>(null);

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
      alert('WebGPU 不支持\n请使用支持 WebGPU 的浏览器（Chrome 113+, Safari 17.4+）');
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
      renderer.setViewTransform(viewTransform());

      return true;
    } catch (error) {
      console.error('WebGPU 初始化失败:', error);
      alert('WebGPU 初始化失败：' + (error as Error).message);
      return false;
    }
  };

  /**
   * 渲染循环
   */
  const renderLoop = () => {
    if (!renderer || !canvasRef) return;

    // 渲染 WebGPU 内容
    renderer.render();
    
    // 在 2D context 上绘制网格叠加层（如果需要）
    if (gridVisible()) {
      drawGridOverlay();
    }
    
    requestAnimationFrame(renderLoop);
  };

  /**
   * 绘制网格叠加层（在独立的2D canvas上）
   */
  const drawGridOverlay = () => {
    if (!gridCanvasRef) return;

    const ctx = gridCanvasRef.getContext('2d');
    if (!ctx) return;

    // 清除之前的内容
    ctx.clearRect(0, 0, gridCanvasRef.width, gridCanvasRef.height);

    const data = mapData();
    const vt = viewTransform();
    const tileWidth = data.tileWidth * vt.zoom;
    const tileHeight = data.tileHeight * vt.zoom;
    const offsetX = -vt.x * vt.zoom + gridCanvasRef.width / 2;
    const offsetY = -vt.y * vt.zoom + gridCanvasRef.height / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;

    // 计算可见区域
    const startX = Math.max(0, Math.floor(-offsetX / tileWidth));
    const endX = Math.min(data.width, Math.ceil((gridCanvasRef.width - offsetX) / tileWidth));
    const startY = Math.max(0, Math.floor(-offsetY / tileHeight));
    const endY = Math.min(data.height, Math.ceil((gridCanvasRef.height - offsetY) / tileHeight));

    // 绘制垂直线
    for (let x = startX; x <= endX; x++) {
      const screenX = offsetX + x * tileWidth;
      ctx.beginPath();
      ctx.moveTo(screenX, Math.max(0, offsetY));
      ctx.lineTo(screenX, Math.min(gridCanvasRef.height, offsetY + data.height * tileHeight));
      ctx.stroke();
    }

    // 绘制水平线
    for (let y = startY; y <= endY; y++) {
      const screenY = offsetY + y * tileHeight;
      ctx.beginPath();
      ctx.moveTo(Math.max(0, offsetX), screenY);
      ctx.lineTo(Math.min(gridCanvasRef.width, offsetX + data.width * tileWidth), screenY);
      ctx.stroke();
    }
  };

  /**
   * 处理文件上传
   */
  const handleFileUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !device || !tileSetManager) return;

    const file = input.files[0];
    
    try {
      const tileSet = await TileSet.createFromFile(file, tileSetManager.getAllTileSets().length, device);
      
      if (tileSet) {
        const id = tileSetManager.addTileSet(tileSet);
        setSelectedTileSet(id);
        
        // 设置网格参数
        const def = tileSet.getDefinition();
        setGridSettings({
          tileWidth: def.tileWidth,
          tileHeight: def.tileHeight,
          spacing: def.spacing,
          margin: def.margin,
          columns: def.columns,
          rows: def.rows,
        });
        
        // 显示网格设置面板
        setShowGridSettings(true);
        
        // 更新预览
        updateTileSetPreview(tileSet);
        
        // 重建渲染批次
        if (renderer) {
          renderer.setMapData(mapData());
        }

        console.log('瓦片集加载成功:', def);
      }
    } catch (error) {
      console.error('加载瓦片集失败:', error);
      alert('加载瓦片集失败：' + (error as Error).message);
    }

    // 清空 input
    input.value = '';
  };

  /**
   * 更新网格设置
   */
  const updateGridSettings = () => {
    if (!tileSetManager || selectedTileSet() === null) return;

    const tileSet = tileSetManager.getTileSet(selectedTileSet()!);
    if (!tileSet) return;

    const settings = gridSettings();
    tileSet.updateGrid(
      settings.tileWidth,
      settings.tileHeight,
      settings.spacing,
      settings.margin
    );

    // 更新网格设置中的计算值
    const def = tileSet.getDefinition();
    setGridSettings({
      ...settings,
      columns: def.columns,
      rows: def.rows,
    });

    // 重新绘制预览
    updateTileSetPreview(tileSet);
    
    // 清空选择
    setSelectedTiles([]);
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

    // 绘制选中的瓦片高亮
    const selected = selectedTiles();
    ctx.fillStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.8)';
    ctx.lineWidth = 2;
    
    for (const tileIndex of selected) {
      const col = tileIndex % def.columns;
      const row = Math.floor(tileIndex / def.columns);
      const x = def.margin + col * (def.tileWidth + def.spacing);
      const y = def.margin + row * (def.tileHeight + def.spacing);
      
      ctx.fillRect(x, y, def.tileWidth, def.tileHeight);
      ctx.strokeRect(x, y, def.tileWidth, def.tileHeight);
    }
  };

  /**
   * 处理瓦片集预览点击
   */
  const handleTileSetMouseDown = (event: MouseEvent) => {
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
      
      // 开始框选
      setIsSelecting(true);
      setSelectionStart({ x: col, y: row });
      setSelectionEnd({ x: col, y: row });
      
      // 如果按住 Cmd/Ctrl，添加到选择；否则替换选择
      if (event.metaKey || event.ctrlKey) {
        const current = selectedTiles();
        if (current.includes(tileIndex)) {
          setSelectedTiles(current.filter(t => t !== tileIndex));
        } else {
          setSelectedTiles([...current, tileIndex]);
        }
      } else {
        setSelectedTiles([tileIndex]);
      }
      
      updateTileSetPreview(tileSet);
    }
  };

  const handleTileSetMouseMove = (event: MouseEvent) => {
    if (!isSelecting() || !tilesetPreviewRef || !tileSetManager || selectedTileSet() === null) return;

    const tileSet = tileSetManager.getTileSet(selectedTileSet()!);
    if (!tileSet) return;

    const rect = tilesetPreviewRef.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const def = tileSet.getDefinition();
    const col = Math.floor((x - def.margin) / (def.tileWidth + def.spacing));
    const row = Math.floor((y - def.margin) / (def.tileHeight + def.spacing));

    if (col >= 0 && col < def.columns && row >= 0 && row < def.rows) {
      setSelectionEnd({ x: col, y: row });
      
      // 计算选择区域
      const start = selectionStart();
      if (start) {
        const minCol = Math.min(start.x, col);
        const maxCol = Math.max(start.x, col);
        const minRow = Math.min(start.y, row);
        const maxRow = Math.max(start.y, row);
        
        const tiles: number[] = [];
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            tiles.push(r * def.columns + c);
          }
        }
        
        setSelectedTiles(tiles);
        updateTileSetPreview(tileSet);
      }
    }
  };

  const handleTileSetMouseUp = () => {
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  /**
   * 合并选中的瓦片
   */
  const mergeSelectedTiles = () => {
    const selected = selectedTiles();
    if (selected.length < 2 || !tileSetManager || selectedTileSet() === null) {
      alert('请至少选择 2 个瓦片进行合并');
      return;
    }

    const tileSet = tileSetManager.getTileSet(selectedTileSet()!);
    if (!tileSet) return;

    const def = tileSet.getDefinition();
    
    // 计算选择区域的边界
    const cols = selected.map(t => t % def.columns);
    const rows = selected.map(t => Math.floor(t / def.columns));
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    
    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;
    
    // 验证是否是矩形选择
    if (selected.length !== width * height) {
      alert('只能合并矩形区域的瓦片');
      return;
    }

    // 创建合并瓦片
    const metaTile: MetaTile = {
      id: Date.now(),
      tiles: selected.sort((a, b) => a - b),
      width,
      height,
    };

    const current = metaTiles();
    current.set(metaTile.id, metaTile);
    setMetaTiles(new Map(current));

    console.log('瓦片已合并:', metaTile);
    alert(`已合并 ${width}x${height} 瓦片`);
  };

  /**
   * 取消合并
   */
  const ungroupTiles = () => {
    const selected = selectedTiles();
    if (selected.length === 0) {
      alert('请选择要取消合并的瓦片');
      return;
    }

    // 查找包含选中瓦片的合并组
    const current = metaTiles();
    let found = false;

    for (const [id, metaTile] of current) {
      if (metaTile.tiles.some(t => selected.includes(t))) {
        current.delete(id);
        found = true;
        console.log('已取消合并:', metaTile);
      }
    }

    if (found) {
      setMetaTiles(new Map(current));
      alert('已取消合并');
    } else {
      alert('选中的瓦片没有合并组');
    }
  };

  /**
   * 键盘快捷键处理
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

    // Cmd/Ctrl + G: 合并瓦片
    if (cmdOrCtrl && event.key === 'g' && !event.shiftKey) {
      event.preventDefault();
      mergeSelectedTiles();
    }
    
    // Cmd/Ctrl + Shift + G: 取消合并
    if (cmdOrCtrl && event.shiftKey && event.key === 'G') {
      event.preventDefault();
      ungroupTiles();
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
    let data = mapData();
    
    // 移除边界检查，允许无限画布
    const currentTool = tool();
    const layer = currentLayer();

    if (currentTool === 'brush' && selectedTiles().length > 0 && selectedTileSet() !== null) {
      const tiles = selectedTiles();
      const tilesetId = selectedTileSet()!;
      
      // 如果是合并瓦片，绘制整个组
      const metaTilesMap = metaTiles();
      let isMetaTile = false;
      let metaTile: MetaTile | undefined;
      
      // 检查是否是合并瓦片
      for (const mt of metaTilesMap.values()) {
        if (mt.tiles.includes(tiles[0])) {
          isMetaTile = true;
          metaTile = mt;
          break;
        }
      }
      
      if (isMetaTile && metaTile) {
        // 绘制合并瓦片组
        const tileSet = tileSetManager?.getTileSet(tilesetId);
        if (tileSet) {
          const def = tileSet.getDefinition();
          
          // 计算起始瓦片的位置
          const firstTileIndex = metaTile.tiles[0];
          const startCol = firstTileIndex % def.columns;
          const startRow = Math.floor(firstTileIndex / def.columns);
          
          // 绘制整个合并组
          for (let dy = 0; dy < metaTile.height; dy++) {
            for (let dx = 0; dx < metaTile.width; dx++) {
              const tileIndex = (startRow + dy) * def.columns + (startCol + dx);
              const tile: Tile = { tilesetId, tileIndex };
              
              // 自动扩展地图大小如果需要
              const targetX = tilePos.x + dx;
              const targetY = tilePos.y + dy;
              
              if (targetX >= 0 && targetY >= 0) {
                // 确保地图足够大
                if (targetX >= data.width || targetY >= data.height) {
                  const newWidth = Math.max(data.width, targetX + 1);
                  const newHeight = Math.max(data.height, targetY + 1);
                  data = expandMap(data, newWidth, newHeight);
                }
                
                data = TileMapDataManager.setTile(data, layer, targetX, targetY, tile);
              }
            }
          }
        }
      } else {
        // 绘制单个瓦片
        const tileIndex = tiles[0];
        const tile: Tile = { tilesetId, tileIndex };
        
        if (tilePos.x >= 0 && tilePos.y >= 0) {
          // 自动扩展地图
          if (tilePos.x >= data.width || tilePos.y >= data.height) {
            const newWidth = Math.max(data.width, tilePos.x + 1);
            const newHeight = Math.max(data.height, tilePos.y + 1);
            data = expandMap(data, newWidth, newHeight);
          }
          
          data = TileMapDataManager.setTile(data, layer, tilePos.x, tilePos.y, tile);
        }
      }
      
      setMapData(data);
    } else if (currentTool === 'eraser') {
      if (tilePos.x >= 0 && tilePos.x < data.width && tilePos.y >= 0 && tilePos.y < data.height) {
        data = TileMapDataManager.setTile(data, layer, tilePos.x, tilePos.y, null);
        setMapData(data);
      }
    }

    // 更新渲染器
    if (renderer) {
      renderer.setMapData(mapData());
    }
  };

  /**
   * 扩展地图大小
   */
  const expandMap = (data: TileMapData, newWidth: number, newHeight: number): TileMapData => {
    const newLayers = data.layers.map(layer => {
      const newTiles: (Tile | null)[][] = [];
      
      for (let y = 0; y < newHeight; y++) {
        const newRow: (Tile | null)[] = [];
        for (let x = 0; x < newWidth; x++) {
          if (y < data.height && x < data.width && layer.tiles[y]) {
            newRow.push(layer.tiles[y][x] || null);
          } else {
            newRow.push(null);
          }
        }
        newTiles.push(newRow);
      }
      
      return {
        ...layer,
        tiles: newTiles,
      };
    });
    
    return {
      ...data,
      width: newWidth,
      height: newHeight,
      layers: newLayers,
    };
  };

  /**
   * 导出地图
   */
  const exportMap = async () => {
    try {
      const json = await TileMapDataManager.exportMap(mapData(), true);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tilemap.json';
      a.click();
      URL.revokeObjectURL(url);
      console.log('地图导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败：' + (error as Error).message);
    }
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
      console.log('地图导入成功');
    } catch (error) {
      console.error('导入失败:', error);
      alert('地图导入失败：' + (error as Error).message);
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

    // 添加键盘事件监听
    window.addEventListener('keydown', handleKeyDown);
  });

  // 清理
  onCleanup(() => {
    if (renderer) {
      renderer.destroy();
    }
    if (tileSetManager) {
      tileSetManager.clear();
    }
    window.removeEventListener('keydown', handleKeyDown);
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
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
          <canvas
            ref={gridCanvasRef}
            width={1280}
            height={720}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              'pointer-events': 'none',
              display: gridVisible() ? 'block' : 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              cursor: isPanning() ? 'grabbing' : 'crosshair',
            }}
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
                      const def = ts.getDefinition();
                      setGridSettings({
                        tileWidth: def.tileWidth,
                        tileHeight: def.tileHeight,
                        spacing: def.spacing,
                        margin: def.margin,
                        columns: def.columns,
                        rows: def.rows,
                      });
                      setShowGridSettings(true);
                    }}
                  >
                    {ts.getDefinition().name}
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* 网格设置面板 */}
          <Show when={showGridSettings() && selectedTileSet() !== null}>
            <div class="panel">
              <h3>网格设置</h3>
              <div class="grid-settings">
                <label>
                  瓦片宽度:
                  <input
                    type="number"
                    value={gridSettings().tileWidth}
                    onInput={(e) => setGridSettings({ ...gridSettings(), tileWidth: parseInt(e.currentTarget.value) })}
                    min="1"
                  />
                </label>
                <label>
                  瓦片高度:
                  <input
                    type="number"
                    value={gridSettings().tileHeight}
                    onInput={(e) => setGridSettings({ ...gridSettings(), tileHeight: parseInt(e.currentTarget.value) })}
                    min="1"
                  />
                </label>
                <label>
                  间距:
                  <input
                    type="number"
                    value={gridSettings().spacing}
                    onInput={(e) => setGridSettings({ ...gridSettings(), spacing: parseInt(e.currentTarget.value) })}
                    min="0"
                  />
                </label>
                <label>
                  边距:
                  <input
                    type="number"
                    value={gridSettings().margin}
                    onInput={(e) => setGridSettings({ ...gridSettings(), margin: parseInt(e.currentTarget.value) })}
                    min="0"
                  />
                </label>
                <div class="grid-info">
                  <strong>列数: {gridSettings().columns}</strong>
                  <strong>行数: {gridSettings().rows}</strong>
                </div>
                <button onClick={updateGridSettings}>应用设置</button>
              </div>
            </div>
          </Show>

          {/* 瓦片选择器 */}
          <div class="panel">
            <h3>瓦片选择</h3>
            <div class="tileset-preview-container">
              <canvas
                ref={tilesetPreviewRef}
                onMouseDown={handleTileSetMouseDown}
                onMouseMove={handleTileSetMouseMove}
                onMouseUp={handleTileSetMouseUp}
                onMouseLeave={handleTileSetMouseUp}
              />
            </div>
            <Show when={selectedTiles().length > 0}>
              <div class="selection-info">
                <p>已选择 {selectedTiles().length} 个瓦片</p>
                <div class="selection-actions">
                  <button onClick={mergeSelectedTiles} title="Cmd/Ctrl + G">
                    合并瓦片
                  </button>
                  <button onClick={ungroupTiles} title="Cmd/Ctrl + Shift + G">
                    取消合并
                  </button>
                </div>
              </div>
            </Show>
          </div>

          {/* 信息面板 */}
          <div class="panel">
            <h3>信息</h3>
            <div class="info-content">
              <div>地图大小: {mapData().width} x {mapData().height}</div>
              <div>瓦片大小: {mapData().tileWidth} x {mapData().tileHeight}</div>
              <div>缩放: {(viewTransform().zoom * 100).toFixed(0)}%</div>
              <div>合并组: {metaTiles().size}</div>
            </div>
            <div class="keyboard-hints">
              <h4>快捷键</h4>
              <div>Cmd/Ctrl + G: 合并瓦片</div>
              <div>Cmd/Ctrl + Shift + G: 取消合并</div>
              <div>中键/Alt+左键: 平移视图</div>
              <div>滚轮: 缩放</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
