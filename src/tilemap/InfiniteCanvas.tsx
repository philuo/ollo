import { createSignal, onCleanup, onMount, createEffect, For } from 'solid-js';

type GridConfig = {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  lineWidth: number;
  lineColor: string;
};

type BgPreset = '#1a1a1a' | '#fff' | 'custom';

type SpriteSheet = {
  id: string;
  name: string;
  url: string;
  image: HTMLImageElement;
  rows: number;
  cols: number;
  tileWidth: number;
  tileHeight: number;
};

type SelectedTile = {
  sheetId: string;
  row: number;
  col: number;
  spanRows?: number;
  spanCols?: number;
} | null;

type TileData = {
  // 保存实际的图像数据（独立于雪碧图）
  imageData: string; // base64 URL
  width: number;
  height: number;
  spanRows?: number;
  spanCols?: number;
};

type MergedTile = {
  id: string;
  sheetId: string;
  startRow: number;
  startCol: number;
  spanRows: number;
  spanCols: number;
  name?: string;
};

type BrushMode = 'pixel' | 'interpolated';

export function InfiniteCanvas() {
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const [bgPreset, setBgPreset] = createSignal<BgPreset>('#1a1a1a');
  const [customBg, setCustomBg] = createSignal<string>('#1e1e2e');
  const [grid, setGrid] = createSignal<GridConfig>({
    cols: 32,
    rows: 18,
    cellWidth: 32,
    cellHeight: 32,
    lineWidth: 1,
    lineColor: 'rgba(255,255,255,0.5)'
  });
  const [view, setView] = createSignal({ x: 0, y: 0, zoom: 0.5 });
  const [hoverCell, setHoverCell] = createSignal<{ c: number; r: number } | null>(null);
  const [isPanning, setIsPanning] = createSignal(false);
  const [lastMouse, setLastMouse] = createSignal({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = createSignal(false);
  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const [lastJPress, setLastJPress] = createSignal(0);
  
  // 雪碧图相关
  const [spriteSheets, setSpriteSheets] = createSignal<SpriteSheet[]>([]);
  const [selectedTile, setSelectedTile] = createSignal<SelectedTile>(null);
  const [tileMap, setTileMap] = createSignal<Map<string, TileData>>(new Map());
  const [isDrawing, setIsDrawing] = createSignal(false);
  
  // 橡皮擦模式
  const [dKeyDown, setDKeyDown] = createSignal(false);
  const [isErasing, setIsErasing] = createSignal(false);
  
  // 多选和合并瓦片
  const [selectedTiles, setSelectedTiles] = createSignal<Set<string>>(new Set());
  const [mergedTiles, setMergedTiles] = createSignal<MergedTile[]>([]);
  const [isSelecting, setIsSelecting] = createSignal(false);
  const [selectionStart, setSelectionStart] = createSignal<{row: number, col: number} | null>(null);
  
  // 画笔模式
  const [brushMode, setBrushMode] = createSignal<BrushMode>('pixel');
  
  // 悬浮瓦片状态
  const [hoveredTile, setHoveredTile] = createSignal<string | null>(null);
  
  // 网格线显示/隐藏
  const [showGrid, setShowGrid] = createSignal(true);

  // 计算背景颜色
  const getBackgroundColor = () => {
    const preset = bgPreset();
    if (preset === '#1a1a1a') return '#1a1a1a';
    if (preset === '#fff') return '#ffffff';
    return customBg();
  };

  const resize = () => {
    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // 设置canvas的实际像素尺寸（考虑设备像素比）
    canvasRef.width = Math.floor(rect.width * dpr);
    canvasRef.height = Math.floor(rect.height * dpr);
    
    draw();
  };

  const draw = () => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // 使用CSS像素尺寸进行布局计算
    const rect = canvasRef.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    
    // 重置变换矩阵并清空画布（使用物理像素尺寸）
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
    
    // 设置DPR缩放，使绘制坐标与CSS像素对应
    ctx.scale(dpr, dpr);

    const { cols, rows, cellWidth, cellHeight, lineWidth, lineColor } = grid();
    const vt = view();

    // 缩放后的网格单元尺寸
    const cellW = cellWidth * vt.zoom;
    const cellH = cellHeight * vt.zoom;

    // 网格总尺寸
    const gridTotalW = cols * cellW;
    const gridTotalH = rows * cellH;

    // 网格左上角位置（居中显示 + 视图偏移）
    const offsetX = w / 2 - gridTotalW / 2 - vt.x * cellW;
    const offsetY = h / 2 - gridTotalH / 2 - vt.y * cellH;

    ctx.save();

    // 绘制瓦片（从独立的图像数据渲染，不依赖雪碧图）
    const tiles = tileMap();
    const mode = brushMode();
    
    // 设置图像渲染模式
    if (mode === 'pixel') {
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    
    // 创建图像缓存以提高性能
    const imageCache = new Map<string, HTMLImageElement>();
    
    tiles.forEach((tile, key) => {
      const [c, r] = key.split(',').map(Number);
      if (c >= 0 && c < cols && r >= 0 && r < rows) {
        // 计算显示尺寸（支持合并瓦片）
        const spanRows = tile.spanRows || 1;
        const spanCols = tile.spanCols || 1;
        
        // 关键：基于网格边界计算，而不是累积位置
        // 这样可以确保相邻瓦片完美对齐，没有缝隙或重叠
        const x1 = offsetX + c * cellW;
        const y1 = offsetY + r * cellH;
        const x2 = offsetX + (c + spanCols) * cellW;
        const y2 = offsetY + (r + spanRows) * cellH;
        
        let x, y, dw, dh;
        
        // 在像素模式下，对齐到整数像素边界，避免亚像素渲染导致的模糊和缝隙
        if (mode === 'pixel') {
          // 使用 Math.floor 和边界差值确保无缝对齐
          const px1 = Math.floor(x1);
          const py1 = Math.floor(y1);
          const px2 = Math.floor(x2);
          const py2 = Math.floor(y2);
          
          x = px1;
          y = py1;
          dw = px2 - px1; // 宽度 = 右边界 - 左边界
          dh = py2 - py1; // 高度 = 下边界 - 上边界
        } else {
          // 插值模式允许亚像素渲染
          x = x1;
          y = y1;
          dw = x2 - x1;
          dh = y2 - y1;
        }
        
        // 从缓存或创建新的图像
        let img = imageCache.get(tile.imageData);
        if (!img) {
          img = new Image();
          img.src = tile.imageData;
          imageCache.set(tile.imageData, img);
        }
        
        if (img.complete) {
          ctx.drawImage(img, x, y, dw, dh);
        } else {
          img.onload = () => {
            draw(); // 图像加载完成后重绘
          };
        }
      }
    });

    // 绘制网格线（可切换显示/隐藏）
    if (showGrid()) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = lineColor;

      // 垂直线 - 对齐到像素边界以避免模糊
      for (let c = 0; c <= cols; c++) {
        const x = offsetX + c * cellW;
        const px = Math.floor(x) + 0.5; // +0.5 让线条更清晰（位于像素中心）
        ctx.beginPath();
        ctx.moveTo(px, offsetY);
        ctx.lineTo(px, offsetY + rows * cellH);
        ctx.stroke();
      }

      // 水平线 - 对齐到像素边界以避免模糊
      for (let r = 0; r <= rows; r++) {
        const y = offsetY + r * cellH;
        const py = Math.floor(y) + 0.5; // +0.5 让线条更清晰（位于像素中心）
        ctx.beginPath();
        ctx.moveTo(offsetX, py);
        ctx.lineTo(offsetX + cols * cellW, py);
        ctx.stroke();
      }
    }

    // 悬浮高亮
    if (hoverCell()) {
      const { c, r } = hoverCell()!;
      if (c >= 0 && c < cols && r >= 0 && r < rows) {
        // 使用与瓦片相同的边界计算方法，确保完美对齐
        const x1 = offsetX + c * cellW;
        const y1 = offsetY + r * cellH;
        const x2 = offsetX + (c + 1) * cellW;
        const y2 = offsetY + (r + 1) * cellH;
        
        const px1 = Math.floor(x1);
        const py1 = Math.floor(y1);
        const px2 = Math.floor(x2);
        const py2 = Math.floor(y2);
        
        const x = px1;
        const y = py1;
        const dw = px2 - px1;
        const dh = py2 - py1;
        
        // 橡皮擦模式显示红色
        if (dKeyDown()) {
          ctx.fillStyle = 'rgba(220,50,50,0.3)';
          ctx.strokeStyle = 'rgba(220,50,50,0.9)';
        } else {
          ctx.fillStyle = 'rgba(102,126,234,0.25)';
          ctx.strokeStyle = 'rgba(102,126,234,0.9)';
        }
        
        ctx.lineWidth = Math.max(1, lineWidth);
        ctx.fillRect(x, y, dw, dh);
        ctx.strokeRect(x, y, dw, dh);
      }
    }

    ctx.restore();
  };

  const toCell = (clientX: number, clientY: number) => {
    if (!canvasRef) return null;
    const rect = canvasRef.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { cols, rows, cellWidth, cellHeight } = grid();
    // 使用CSS像素尺寸，而不是物理像素
    const w = rect.width;
    const h = rect.height;
    const vt = view();

    const cellW = cellWidth * vt.zoom;
    const cellH = cellHeight * vt.zoom;
    const gridTotalW = cols * cellW;
    const gridTotalH = rows * cellH;
    const offsetX = w / 2 - gridTotalW / 2 - vt.x * cellW;
    const offsetY = h / 2 - gridTotalH / 2 - vt.y * cellH;

    const c = Math.floor((x - offsetX) / cellW);
    const r = Math.floor((y - offsetY) / cellH);
    return { c, r };
  };

  const uploadSpriteSheet = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const id = Date.now().toString();
        const sheet: SpriteSheet = {
          id,
          name: file.name,
          url: e.target?.result as string,
          image: img,
          rows: 1,
          cols: 1,
          tileWidth: img.width,
          tileHeight: img.height
        };
        setSpriteSheets([...spriteSheets(), sheet]);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const updateSpriteSheet = (id: string, rows: number, cols: number) => {
    setSpriteSheets(sheets => sheets.map(sheet => {
      if (sheet.id === id) {
        return {
          ...sheet,
          rows,
          cols,
          tileWidth: sheet.image.width / cols,
          tileHeight: sheet.image.height / rows
        };
      }
      return sheet;
    }));
  };

  const deleteSpriteSheet = (id: string) => {
    setSpriteSheets(sheets => sheets.filter(s => s.id !== id));
    
    // 画布上的瓦片已经是独立的图像数据，不再清除它们
    // 只清除选中的瓦片引用
    if (selectedTile()?.sheetId === id) {
      setSelectedTile(null);
    }
    
    // 清除该雪碧图相关的合并瓦片
    setMergedTiles(mergedTiles().filter(m => m.sheetId !== id));
    
    draw();
  };

  const toggleTileSelection = (sheetId: string, row: number, col: number) => {
    const key = `${sheetId}::${row}::${col}`;
    setSelectedTiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const mergeTiles = () => {
    const selected = selectedTiles();
    if (selected.size < 2) {
      alert('请至少选择2个瓦片进行合并');
      return;
    }

    // 解析选中的瓦片
    const tiles = Array.from(selected).map(key => {
      const parts = key.split('::');
      const row = parseInt(parts[parts.length - 2]);
      const col = parseInt(parts[parts.length - 1]);
      const sheetId = parts.slice(0, -2).join('::');
      return { sheetId, row, col };
    });

    // 检查是否来自同一个雪碧图
    const sheetId = tiles[0].sheetId;
    if (!tiles.every(t => t.sheetId === sheetId)) {
      alert('只能合并来自同一个雪碧图的瓦片');
      return;
    }

    // 计算边界
    const minRow = Math.min(...tiles.map(t => t.row));
    const maxRow = Math.max(...tiles.map(t => t.row));
    const minCol = Math.min(...tiles.map(t => t.col));
    const maxCol = Math.max(...tiles.map(t => t.col));

    // 检查是否为矩形区域
    const spanRows = maxRow - minRow + 1;
    const spanCols = maxCol - minCol + 1;
    if (tiles.length !== spanRows * spanCols) {
      alert('选中的瓦片必须组成一个完整的矩形区域');
      return;
    }

    // 创建合并瓦片
    const merged: MergedTile = {
      id: Date.now().toString(),
      sheetId,
      startRow: minRow,
      startCol: minCol,
      spanRows,
      spanCols,
      name: `合并瓦片 ${spanRows}x${spanCols}`
    };

    setMergedTiles([...mergedTiles(), merged]);
    setSelectedTiles(new Set<string>());
    alert(`成功合并为 ${spanRows}x${spanCols} 瓦片`);
  };

  const placeTile = (c: number, r: number) => {
    const tile = selectedTile();
    if (!tile) return;
    const { cols, rows } = grid();
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    
    // 找到对应的雪碧图
    const sheet = spriteSheets().find(s => s.id === tile.sheetId);
    if (!sheet || !sheet.image.complete) return;
    
    // 计算瓦片尺寸
    const spanRows = tile.spanRows || 1;
    const spanCols = tile.spanCols || 1;
    
    // 精确计算源图像的起始和结束位置，避免累积误差
    const imgWidth = sheet.image.width;
    const imgHeight = sheet.image.height;
    const sx = (imgWidth / sheet.cols) * tile.col;
    const sy = (imgHeight / sheet.rows) * tile.row;
    const sw = (imgWidth / sheet.cols) * spanCols;
    const sh = (imgHeight / sheet.rows) * spanRows;
    
    // 创建临时canvas，将瓦片图像转换为独立的base64数据
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.round(sw);
    tempCanvas.height = Math.round(sh);
    const tempCtx = tempCanvas.getContext('2d', { alpha: true });
    
    if (tempCtx) {
      // 关闭图像平滑，保持像素完美
      tempCtx.imageSmoothingEnabled = false;
      
      // 绘制瓦片区域到临时canvas，使用精确的源坐标
      tempCtx.drawImage(
        sheet.image,
        sx, sy, sw, sh,
        0, 0,
        tempCanvas.width, tempCanvas.height
      );
      
      // 转换为base64，保存为独立数据（使用PNG格式，无损压缩）
      const imageData = tempCanvas.toDataURL('image/png');
      
      setTileMap(tiles => {
        const newTiles = new Map(tiles);
        const tileData: TileData = {
          imageData,
          width: tempCanvas.width,
          height: tempCanvas.height,
          spanRows: tile.spanRows,
          spanCols: tile.spanCols
        };
        
        newTiles.set(`${c},${r}`, tileData);
        return newTiles;
      });
      draw();
    }
  };

  const eraseTile = (c: number, r: number) => {
    const { cols, rows } = grid();
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    
    setTileMap(tiles => {
      const newTiles = new Map(tiles);
      newTiles.delete(`${c},${r}`);
      return newTiles;
    });
    draw();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (isPanning()) {
      const dx = e.clientX - lastMouse().x;
      const dy = e.clientY - lastMouse().y;
      const vt = view();
      const { cellWidth, cellHeight } = grid();
      const cellW = cellWidth * vt.zoom;
      const cellH = cellHeight * vt.zoom;
      setView({ x: vt.x - dx / cellW, y: vt.y - dy / cellH, zoom: vt.zoom });
      setLastMouse({ x: e.clientX, y: e.clientY });
      draw();
      return;
    }
    
    const cell = toCell(e.clientX, e.clientY);
    setHoverCell(cell);
    
    // 橡皮擦模式：按住 D 键时删除瓦片
    if (dKeyDown() && cell) {
      eraseTile(cell.c, cell.r);
      return;
    }
    
    // 绘制瓦片
    if (isDrawing() && cell) {
      placeTile(cell.c, cell.r);
    } else {
      draw();
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceDown())) {
      setIsPanning(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    } else if (e.button === 0 && !spaceDown() && selectedTile()) {
      setIsDrawing(true);
      const cell = toCell(e.clientX, e.clientY);
      if (cell) {
        placeTile(cell.c, cell.r);
      }
    }
  };

  const onMouseUp = () => {
    setIsPanning(false);
    setIsDrawing(false);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const vt = view();
    const prevZoom = vt.zoom;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(4.0, prevZoom * factor));

    // 使用CSS像素尺寸，而不是物理像素
    const w = rect.width;
    const h = rect.height;
    const { cols, rows, cellWidth, cellHeight } = grid();

    const cellWPrev = cellWidth * prevZoom;
    const cellHPrev = cellHeight * prevZoom;
    const cellWNew = cellWidth * newZoom;
    const cellHNew = cellHeight * newZoom;

    const gridTotalWPrev = cols * cellWPrev;
    const gridTotalHPrev = rows * cellHPrev;
    const gridTotalWNew = cols * cellWNew;
    const gridTotalHNew = rows * cellHNew;

    const offsetXPrev = w / 2 - gridTotalWPrev / 2 - vt.x * cellWPrev;
    const offsetYPrev = h / 2 - gridTotalHPrev / 2 - vt.y * cellHPrev;

    const gridX = (mouseX - offsetXPrev) / cellWPrev;
    const gridY = (mouseY - offsetYPrev) / cellHPrev;

    const newVx = (w / 2 - gridTotalWNew / 2 - mouseX + gridX * cellWNew) / cellWNew;
    const newVy = (h / 2 - gridTotalHNew / 2 - mouseY + gridY * cellHNew) / cellHNew;

    setView({ x: newVx, y: newVy, zoom: newZoom });
    draw();
  };

  const resetView = () => {
    setView({ x: 0, y: 0, zoom: 0.5 });
    draw();
  };

  onMount(() => {
    resize();
    window.addEventListener('resize', resize);
    
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceDown(true);
      }
      if (e.code === 'KeyJ') {
        const now = Date.now();
        if (now - lastJPress() < 300) {
          resetView();
        }
        setLastJPress(now);
      }
      // Cmd/Ctrl + G 合并瓦片
      if (e.code === 'KeyG' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        mergeTiles();
      }
      // D 键橡皮擦模式
      if (e.code === 'KeyD' && !dKeyDown()) {
        e.preventDefault();
        setDKeyDown(true);
      }
      // L 键切换网格线显示/隐藏
      if (e.code === 'KeyL') {
        e.preventDefault();
        setShowGrid(!showGrid());
      }
    };
    
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceDown(false);
      }
      // D 键释放
      if (e.code === 'KeyD') {
        e.preventDefault();
        setDKeyDown(false);
      }
    };
    
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    (window as any).__ic_onKeyDown = onKeyDown;
    (window as any).__ic_onKeyUp = onKeyUp;
  });

  onCleanup(() => {
    window.removeEventListener('resize', resize);
    const kd = (window as any).__ic_onKeyDown;
    const ku = (window as any).__ic_onKeyUp;
    if (kd) window.removeEventListener('keydown', kd);
    if (ku) window.removeEventListener('keyup', ku);
  });

  // 监听背景色变化，更新容器背景
  createEffect(() => {
    if (containerRef) {
      containerRef.style.backgroundColor = getBackgroundColor();
    }
  });

  // 监听雪碧图变化，重绘画布
  createEffect(() => {
    spriteSheets();
    draw();
  });

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative', 
        'background-color': getBackgroundColor(),
        transition: 'background-color 0.2s'
      }}
    >
      {/* 右上角drawer开关 */}
      <button
        onClick={() => setDrawerOpen(!drawerOpen())}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          'z-index': 20,
          padding: '10px 16px',
          'background-color': 'rgba(30,30,46,0.95)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          'border-radius': '8px',
          cursor: 'pointer',
          'font-size': '14px',
          'font-weight': '600',
          transition: 'all 0.2s',
          'backdrop-filter': 'blur(10px)',
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(50,50,66,0.95)'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(30,30,46,0.95)'}
      >
        {drawerOpen() ? '✕ 关闭' : '☰ 设置'}
      </button>

      {/* Drawer 面板 */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: drawerOpen() ? 0 : '-480px',
        width: '480px',
        height: '100%',
        'background-color': 'rgba(30,30,46,0.98)',
        'backdrop-filter': 'blur(20px)',
        'box-shadow': '-4px 0 20px rgba(0,0,0,0.3)',
        'z-index': 15,
        transition: 'right 0.3s ease',
        'overflow-y': 'auto',
        padding: '80px 24px 24px 24px',
        color: 'white',
      }}>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '24px' }}>
          {/* 画笔设置 */}
          <div>
            <h3 style={{ 'margin-bottom': '12px', 'font-size': '16px', 'font-weight': '600' }}>画笔设置</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setBrushMode('pixel')}
                style={{
                  flex: 1,
                  padding: '10px',
                  'border-radius': '6px',
                  border: brushMode() === 'pixel' ? '2px solid rgba(72,187,120,1)' : '1px solid rgba(255,255,255,0.2)',
                  'background-color': brushMode() === 'pixel' ? 'rgba(72,187,120,0.2)' : 'rgba(50,50,66,0.5)',
                  color: 'white',
                  cursor: 'pointer',
                  'font-weight': '600',
                  transition: 'all 0.2s'
                }}
              >
                🎨 像素画
              </button>
              <button
                onClick={() => setBrushMode('interpolated')}
                style={{
                  flex: 1,
                  padding: '10px',
                  'border-radius': '6px',
                  border: brushMode() === 'interpolated' ? '2px solid rgba(72,187,120,1)' : '1px solid rgba(255,255,255,0.2)',
                  'background-color': brushMode() === 'interpolated' ? 'rgba(72,187,120,0.2)' : 'rgba(50,50,66,0.5)',
                  color: 'white',
                  cursor: 'pointer',
                  'font-weight': '600',
                  transition: 'all 0.2s'
                }}
              >
                ✨ 插值
              </button>
            </div>
            <div style={{ 'margin-top': '8px', 'font-size': '12px', opacity: 0.7 }}>
              {brushMode() === 'pixel' ? '像素完美渲染，适合像素艺术' : '平滑插值渲染，适合高清图片'}
            </div>
          </div>

          {/* 合并瓦片库 */}
          <Show when={mergedTiles().length > 0}>
            <div>
              <h3 style={{ 'margin-bottom': '12px', 'font-size': '16px', 'font-weight': '600' }}>合并瓦片库</h3>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
                <For each={mergedTiles()}>
                  {(merged) => {
                    const sheet = spriteSheets().find(s => s.id === merged.sheetId);
                    const isMergedBrushSelected = selectedTile()?.sheetId === merged.sheetId &&
                      selectedTile()?.row === merged.startRow &&
                      selectedTile()?.col === merged.startCol &&
                      selectedTile()?.spanRows === merged.spanRows &&
                      selectedTile()?.spanCols === merged.spanCols;
                    
                    return (
                      <div 
                        onClick={() => {
                          setSelectedTile({
                            sheetId: merged.sheetId,
                            row: merged.startRow,
                            col: merged.startCol,
                            spanRows: merged.spanRows,
                            spanCols: merged.spanCols
                          });
                        }}
                        style={{
                          padding: '8px',
                          'background-color': isMergedBrushSelected ? 'rgba(72,187,120,0.2)' : 'rgba(50,50,66,0.5)',
                          border: isMergedBrushSelected ? '2px solid rgba(72,187,120,1)' : '1px solid rgba(255,255,255,0.1)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          if (!isMergedBrushSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(70,70,86,0.5)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isMergedBrushSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(50,50,66,0.5)';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'flex-start', 'margin-bottom': '8px' }}>
                          <span style={{ 'font-size': '14px', 'font-weight': '600' }}>{merged.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMergedTiles(mergedTiles().filter(m => m.id !== merged.id));
                            }}
                            style={{
                              padding: '4px 8px',
                              'background-color': 'rgba(220,50,50,0.8)',
                              color: 'white',
                              border: 'none',
                              'border-radius': '4px',
                              cursor: 'pointer',
                              'font-size': '12px'
                            }}
                          >
                            删除
                          </button>
                        </div>
                        
                        {/* 合并瓦片预览（作为一个整体显示，无内部网格线） */}
                        <Show when={sheet && sheet.image.complete}>
                          <div style={{
                            position: 'relative',
                            width: `${sheet!.tileWidth * merged.spanCols}px`,
                            height: `${sheet!.tileHeight * merged.spanRows}px`,
                            overflow: 'hidden',
                            // 作为整体，只有外边框网格线
                            'box-shadow': 'inset 0 0 0 1px rgba(255,255,255,0.2)'
                          }}>
                            <img 
                              src={sheet!.url}
                              alt={`merged-${merged.id}`}
                              style={{
                                position: 'absolute',
                                width: `${sheet!.image.width}px`,
                                height: `${sheet!.image.height}px`,
                                left: `${-merged.startCol * sheet!.tileWidth}px`,
                                top: `${-merged.startRow * sheet!.tileHeight}px`,
                                'object-fit': 'none',
                                'image-rendering': 'pixelated',
                                display: 'block'
                              }}
                            />
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>

          {/* 雪碧图管理 */}
          <div>
            <h3 style={{ 'margin-bottom': '12px', 'font-size': '16px', 'font-weight': '600' }}>雪碧图管理</h3>
            <input 
              type="file" 
              accept="image/*" 
              multiple
              onChange={(e) => {
                const files = e.currentTarget.files;
                if (files) {
                  Array.from(files).forEach(file => uploadSpriteSheet(file));
                }
              }}
              style={{ 
                width: '100%', 
                padding: '10px', 
                'border-radius': '6px', 
                border: '1px solid rgba(255,255,255,0.2)', 
                'background-color': 'rgba(50,50,66,0.5)', 
                color: 'white',
                cursor: 'pointer',
                'margin-bottom': '12px'
              }} 
            />
            
            {/* 多选提示 */}
            <Show when={selectedTiles().size > 0}>
              <div style={{
                padding: '8px 12px',
                'background-color': 'rgba(72,187,120,0.2)',
                'border-radius': '6px',
                border: '1px solid rgba(72,187,120,0.5)',
                'margin-bottom': '12px'
              }}>
                <div style={{ 'font-size': '14px', 'margin-bottom': '4px' }}>
                  已选择 {selectedTiles().size} 个瓦片
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => mergeTiles()}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      'background-color': 'rgba(72,187,120,0.8)',
                      color: 'white',
                      border: 'none',
                      'border-radius': '4px',
                      cursor: 'pointer',
                      'font-size': '12px',
                      'font-weight': '600'
                    }}
                  >
                    合并 (Cmd/Ctrl+G)
                  </button>
                  <button
                    onClick={() => setSelectedTiles(new Set<string>())}
                    style={{
                      padding: '6px 12px',
                      'background-color': 'rgba(220,50,50,0.8)',
                      color: 'white',
                      border: 'none',
                      'border-radius': '4px',
                      cursor: 'pointer',
                      'font-size': '12px'
                    }}
                  >
                    清除
                  </button>
                </div>
              </div>
            </Show>

            {/* 雪碧图列表 */}
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
              <For each={spriteSheets()}>
                {(sheet) => (
                  <div style={{ 
                    padding: '12px', 
                    'background-color': 'rgba(50,50,66,0.5)', 
                    'border-radius': '8px',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '8px' }}>
                      <span style={{ 'font-size': '14px', 'font-weight': '500', 'flex': 1, 'overflow': 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>{sheet.name}</span>
                      <button 
                        onClick={() => deleteSpriteSheet(sheet.id)}
                        style={{ 
                          padding: '4px 8px', 
                          'background-color': 'rgba(220,50,50,0.8)', 
                          color: 'white', 
                          border: 'none', 
                          'border-radius': '4px', 
                          cursor: 'pointer',
                          'font-size': '12px'
                        }}
                      >删除</button>
                    </div>
                    
                    {/* 网格设置 */}
                    <div style={{ display: 'flex', gap: '8px', 'margin-bottom': '12px' }}>
                      <label style={{ flex: 1 }}>
                        <div style={{ 'font-size': '12px', opacity: 0.8, 'margin-bottom': '4px' }}>行数</div>
                        <input 
                          type="number" 
                          min="1" 
                          value={sheet.rows}
                          onInput={(e) => updateSpriteSheet(sheet.id, parseInt(e.currentTarget.value) || 1, sheet.cols)}
                          style={{ width: '100%', padding: '6px', 'border-radius': '4px', border: '1px solid rgba(255,255,255,0.2)', 'background-color': 'rgba(30,30,46,0.5)', color: 'white' }} 
                        />
                      </label>
                      <label style={{ flex: 1 }}>
                        <div style={{ 'font-size': '12px', opacity: 0.8, 'margin-bottom': '4px' }}>列数</div>
                        <input 
                          type="number" 
                          min="1" 
                          value={sheet.cols}
                          onInput={(e) => updateSpriteSheet(sheet.id, sheet.rows, parseInt(e.currentTarget.value) || 1)}
                          style={{ width: '100%', padding: '6px', 'border-radius': '4px', border: '1px solid rgba(255,255,255,0.2)', 'background-color': 'rgba(30,30,46,0.5)', color: 'white' }} 
                        />
                      </label>
                    </div>

                    {/* 瓦片预览和选择 */}
                    <div style={{ 
                      'max-height': '200px', 
                      'overflow': 'auto'
                    }}>
                      <div style={{ 
                        display: 'grid', 
                        'grid-template-columns': `repeat(${sheet.cols}, ${sheet.tileWidth}px)`,
                        'grid-auto-rows': `${sheet.tileHeight}px`,
                        gap: '0'
                      }}>
                        <For each={Array.from({ length: sheet.rows * sheet.cols })}>
                          {(_, idx) => {
                            const row = Math.floor(idx() / sheet.cols);
                            const col = idx() % sheet.cols;
                            const tileKey = `${sheet.id}::${row}::${col}`;
                            const isBrushSelected = () => selectedTile()?.sheetId === sheet.id && 
                                             selectedTile()?.row === row && 
                                             selectedTile()?.col === col;
                            const isMultiSelected = () => selectedTiles().has(tileKey);
                            const isHovered = () => hoveredTile() === tileKey && !isBrushSelected() && !isMultiSelected();
                            
                            return (
                              <div 
                                onClick={(e) => {
                                  if (e.shiftKey) {
                                    // Shift + 点击多选
                                    toggleTileSelection(sheet.id, row, col);
                                  } else {
                                    // 普通点击选择画笔
                                    setSelectedTile({ sheetId: sheet.id, row, col });
                                  }
                                }}
                                onMouseEnter={() => setHoveredTile(tileKey)}
                                onMouseLeave={() => setHoveredTile(null)}
                                style={{ 
                                  position: 'relative',
                                  width: `${sheet.tileWidth}px`,
                                  height: `${sheet.tileHeight}px`,
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  // 使用box-shadow模拟网格线（不占空间）
                                  // 多选瓦片无网格线，看起来像一个整体
                                  'box-shadow': isMultiSelected() 
                                    ? 'none' 
                                    : 'inset 0 0 0 1px rgba(255,255,255,0.1)'
                                }}
                              >
                                {/* 使用img精确裁剪瓦片 */}
                                <img 
                                  src={sheet.url}
                                  alt={`tile-${row}-${col}`}
                                  style={{ 
                                    position: 'absolute',
                                    width: `${sheet.image.width}px`,
                                    height: `${sheet.image.height}px`,
                                    left: `${-col * sheet.tileWidth}px`,
                                    top: `${-row * sheet.tileHeight}px`,
                                    'object-fit': 'none',
                                    'image-rendering': 'pixelated',
                                    display: 'block'
                                  }}
                                />
                                
                                {/* 悬浮效果 */}
                                <Show when={isHovered()}>
                                  <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    'background-color': 'rgba(72,187,120,0.1)',
                                    'box-shadow': 'inset 0 0 0 2px rgba(72,187,120,0.6)',
                                    'pointer-events': 'none'
                                  }}></div>
                                </Show>
                                
                                {/* 画笔选中效果 */}
                                <Show when={isBrushSelected()}>
                                  <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    'background-color': 'rgba(72,187,120,0.15)',
                                    'box-shadow': 'inset 0 0 0 2px rgba(72,187,120,1)',
                                    'pointer-events': 'none'
                                  }}></div>
                                </Show>
                                
                                {/* 多选遮罩和标记 */}
                                <Show when={isMultiSelected()}>
                                  <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    'background-color': 'rgba(255,215,0,0.15)',
                                    'pointer-events': 'none'
                                  }}></div>
                                  <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    'box-shadow': 'inset 0 0 0 2px rgba(255,215,0,0.8)',
                                    'pointer-events': 'none'
                                  }}></div>
                                  <div style={{
                                    position: 'absolute',
                                    top: '2px',
                                    right: '2px',
                                    width: '12px',
                                    height: '12px',
                                    'background-color': 'rgba(255,215,0,0.95)',
                                    display: 'flex',
                                    'align-items': 'center',
                                    'justify-content': 'center',
                                    'font-size': '8px',
                                    'font-weight': 'bold',
                                    color: 'black',
                                    'pointer-events': 'none'
                                  }}>
                                    ✓
                                  </div>
                                </Show>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* 背景设置 */}
          <div>
            <h3 style={{ 'margin-bottom': '12px', 'font-size': '16px', 'font-weight': '600' }}>背景设置</h3>
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
              <select value={bgPreset()} onChange={(e) => setBgPreset(e.currentTarget.value as BgPreset)}
                      style={{ padding: '8px', 'border-radius': '6px', border: '1px solid rgba(255,255,255,0.2)', 'background-color': 'rgba(50,50,66,0.5)', color: 'white' }}>
                <option value="#1a1a1a">黑色</option>
                <option value="#FFF">白色</option>
                <option value="custom">自定义</option>
              </select>
              {bgPreset() === 'custom' && (
                <input type="color" value={customBg()} onInput={(e) => setCustomBg(e.currentTarget.value)}
                       style={{ width: '100%', height: '40px', 'border-radius': '6px', border: '1px solid rgba(255,255,255,0.2)' }} />
              )}
            </div>
          </div>

          {/* 网格设置 */}
          <div>
            <h3 style={{ 'margin-bottom': '12px', 'font-size': '16px', 'font-weight': '600' }}>网格设置</h3>
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
              <label style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                <span>列数</span>
                <input type="number" min="1" value={grid().cols}
                       onInput={(e) => { const cols = parseInt(e.currentTarget.value) || 1; setGrid({ ...grid(), cols }); draw(); }}
                       style={{ width: '120px', padding: '6px', 'border-radius': '6px', border: '1px solid rgba(255,255,255,0.2)', 'background-color': 'rgba(50,50,66,0.5)', color: 'white' }} />
              </label>
              <label style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                <span>行数</span>
                <input type="number" min="1" value={grid().rows}
                       onInput={(e) => { const rows = parseInt(e.currentTarget.value) || 1; setGrid({ ...grid(), rows }); draw(); }}
                       style={{ width: '120px', padding: '6px', 'border-radius': '6px', border: '1px solid rgba(255,255,255,0.2)', 'background-color': 'rgba(50,50,66,0.5)', color: 'white' }} />
              </label>
              <label style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                <span>格宽 (px)</span>
                <input type="number" min="1" value={grid().cellWidth}
                       onInput={(e) => { const cellWidth = parseInt(e.currentTarget.value) || 1; setGrid({ ...grid(), cellWidth }); draw(); }}
                       style={{ width: '120px', padding: '6px', 'border-radius': '6px', border: '1px solid rgba(255,255,255,0.2)', 'background-color': 'rgba(50,50,66,0.5)', color: 'white' }} />
              </label>
              <label style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                <span>格高 (px)</span>
                <input type="number" min="1" value={grid().cellHeight}
                       onInput={(e) => { const cellHeight = parseInt(e.currentTarget.value) || 1; setGrid({ ...grid(), cellHeight }); draw(); }}
                       style={{ width: '120px', padding: '6px', 'border-radius': '6px', border: '1px solid rgba(255,255,255,0.2)', 'background-color': 'rgba(50,50,66,0.5)', color: 'white' }} />
              </label>
              <label style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                <span>线宽 (px)</span>
                <input type="number" min="1" value={grid().lineWidth}
                       onInput={(e) => { const lineWidth = parseInt(e.currentTarget.value) || 1; setGrid({ ...grid(), lineWidth }); draw(); }}
                       style={{ width: '120px', padding: '6px', 'border-radius': '6px', border: '1px solid rgba(255,255,255,0.2)', 'background-color': 'rgba(50,50,66,0.5)', color: 'white' }} />
              </label>
              <label style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                <span>线色</span>
                <input type="text" value={grid().lineColor}
                       onInput={(e) => { const lineColor = e.currentTarget.value; setGrid({ ...grid(), lineColor }); draw(); }}
                       style={{ width: '180px', padding: '6px', 'border-radius': '6px', border: '1px solid rgba(255,255,255,0.2)', 'background-color': 'rgba(50,50,66,0.5)', color: 'white' }} />
              </label>
            </div>
          </div>

          {/* 视图信息 */}
          <div>
            <h3 style={{ 'margin-bottom': '12px', 'font-size': '16px', 'font-weight': '600' }}>视图信息</h3>
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px', 'font-size': '14px', opacity: 0.8 }}>
              <div>缩放: {(view().zoom * 100).toFixed(0)}%</div>
              <div>偏移: ({view().x.toFixed(1)}, {view().y.toFixed(1)})</div>
              {hoverCell() && (
                <div>悬浮: 列{hoverCell()!.c} 行{hoverCell()!.r}</div>
              )}
              {selectedTile() && !dKeyDown() && (
                <div style={{ color: 'rgba(72,187,120,1)' }}>
                  已选瓦片: 行{selectedTile()!.row} 列{selectedTile()!.col}
                  {selectedTile()!.spanRows && selectedTile()!.spanCols && (
                    <span> ({selectedTile()!.spanRows}×{selectedTile()!.spanCols})</span>
                  )}
                </div>
              )}
              {dKeyDown() && (
                <div style={{ color: 'rgba(220,50,50,1)', 'font-weight': '600' }}>
                  🗑️ 橡皮擦模式
                </div>
              )}
              <div style={{ color: showGrid() ? 'rgba(102,126,234,1)' : 'rgba(150,150,150,1)', 'font-size': '13px' }}>
                网格线: {showGrid() ? '显示 ✓' : '隐藏'}
              </div>
            </div>
            <button
              onClick={resetView}
              style={{
                'margin-top': '12px',
                width: '100%',
                padding: '10px',
                'background-color': 'rgba(102,126,234,0.8)',
                color: 'white',
                border: 'none',
                'border-radius': '6px',
                cursor: 'pointer',
                'font-weight': '600',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(102,126,234,1)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(102,126,234,0.8)'}
            >
              重置视图 (双击 J)
            </button>
          </div>

          {/* 快捷键说明 */}
          <div>
            <h3 style={{ 'margin-bottom': '12px', 'font-size': '16px', 'font-weight': '600' }}>快捷键</h3>
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px', 'font-size': '13px', opacity: 0.7 }}>
              <div>• Space + 左键拖拽 / 中键拖拽: 平移</div>
              <div>• 滚轮: 缩放 (20%~400%)</div>
              <div>• 双击 J: 重置居中 (50%)</div>
              <div>• 左键点击瓦片: 选择画笔</div>
              <div>• Shift + 左键点击: 多选瓦片</div>
              <div>• Cmd/Ctrl + G: 合并选中瓦片</div>
              <div>• 左键拖拽画布: 绘制瓦片</div>
              <div>• 按住 D 键: 橡皮擦模式（删除瓦片）</div>
              <div>• 按 L 键: 切换网格线显示/隐藏</div>
            </div>
          </div>
        </div>
      </div>

      <canvas 
        ref={canvasRef}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      />
    </div>
  );
}

export default InfiniteCanvas;
