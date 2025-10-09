import { createSignal, onCleanup, onMount } from 'solid-js';
import { Renderer } from '@/scenes/webgpu/Renderer';

type GridConfig = {
  cols: number;
  rows: number;
  cellWidth: number;  // 单个网格的宽度（像素）
  cellHeight: number; // 单个网格的高度（像素）
  lineWidth: number;
  lineColor: string; // rgba()
};

type BgPreset = 'black' | 'white' | 'transparent' | 'custom';

export function InfiniteCanvasBetter() {
  let webgpuCanvasRef: HTMLCanvasElement | undefined;
  let overlayCanvasRef: HTMLCanvasElement | undefined;

  const [bgPreset, setBgPreset] = createSignal<BgPreset>('black');
  const [customBg, setCustomBg] = createSignal<string>('#1e1e2e');
  const [grid, setGrid] = createSignal<GridConfig>({ 
    cols: 32, 
    rows: 18, 
    cellWidth: 32, 
    cellHeight: 32, 
    lineWidth: 1, 
    lineColor: 'rgba(255,255,255,0.15)' 
  });
  const [view, setView] = createSignal({ x: 0, y: 0, zoom: 1 });
  const [hoverCell, setHoverCell] = createSignal<{ c: number; r: number } | null>(null);
  const [isPanning, setIsPanning] = createSignal(false);
  const [lastMouse, setLastMouse] = createSignal({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = createSignal(false);

  let renderer: Renderer | null = null;

  const resize = () => {
    if (!webgpuCanvasRef || !overlayCanvasRef) return;
    const rect = webgpuCanvasRef.getBoundingClientRect();
    webgpuCanvasRef.width = Math.floor(rect.width);
    webgpuCanvasRef.height = Math.floor(rect.height);
    overlayCanvasRef.width = webgpuCanvasRef.width;
    overlayCanvasRef.height = webgpuCanvasRef.height;
    drawOverlay();
  };

  const clearBackground = () => {
    if (!renderer) return;
    const preset = bgPreset();
    if (preset === 'black') renderer.clear(0, 0, 0, 1);
    else if (preset === 'white') renderer.clear(1, 1, 1, 1);
    else if (preset === 'transparent') renderer.clear(0, 0, 0, 0);
    else {
      const hex = customBg().replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      renderer.clear(r, g, b, 1);
    }
  };

  const drawOverlay = () => {
    if (!overlayCanvasRef) return;
    const ctx = overlayCanvasRef.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlayCanvasRef.width, overlayCanvasRef.height);

    const w = overlayCanvasRef.width;
    const h = overlayCanvasRef.height;
    const { cols, rows, cellWidth, cellHeight, lineWidth, lineColor } = grid();
    const vt = view();

    // 缩放后的网格单元尺寸
    const cellW = cellWidth * vt.zoom;
    const cellH = cellHeight * vt.zoom;
    
    // 网格偏移（画布中心为参考点）
    const offsetX = w / 2 - vt.x * cellW;
    const offsetY = h / 2 - vt.y * cellH;

    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = lineColor;

    // 绘制网格线（只绘制设定的行列数）
    // 绘制竖线 (cols + 1 条线)
    for (let c = 0; c <= cols; c++) {
      const x = offsetX + c * cellW;
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + rows * cellH);
      ctx.stroke();
    }

    // 绘制横线 (rows + 1 条线)
    for (let r = 0; r <= rows; r++) {
      const y = offsetY + r * cellH;
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + cols * cellW, y);
      ctx.stroke();
    }

    // 悬浮高亮
    if (hoverCell()) {
      const { c, r } = hoverCell()!;
      // 只高亮在网格范围内的单元格
      if (c >= 0 && c < cols && r >= 0 && r < rows) {
        const x = offsetX + c * cellW;
        const y = offsetY + r * cellH;
        ctx.fillStyle = 'rgba(102,126,234,0.25)';
        ctx.strokeStyle = 'rgba(102,126,234,0.9)';
        ctx.lineWidth = Math.max(1, lineWidth);
        ctx.fillRect(x, y, cellW, cellH);
        ctx.strokeRect(x, y, cellW, cellH);
      }
    }

    ctx.restore();
  };

  const toCell = (clientX: number, clientY: number) => {
    if (!overlayCanvasRef) return null;
    const rect = overlayCanvasRef.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { cellWidth, cellHeight } = grid();
    const w = overlayCanvasRef.width;
    const h = overlayCanvasRef.height;
    const vt = view();
    
    const cellW = cellWidth * vt.zoom;
    const cellH = cellHeight * vt.zoom;
    const offsetX = w / 2 - vt.x * cellW;
    const offsetY = h / 2 - vt.y * cellH;
    
    const c = Math.floor((x - offsetX) / cellW);
    const r = Math.floor((y - offsetY) / cellH);
    return { c, r };
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
      drawOverlay();
      return;
    }
    const cell = toCell(e.clientX, e.clientY);
    setHoverCell(cell);
    drawOverlay();
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceDown())) {
      setIsPanning(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const onMouseUp = () => {
    setIsPanning(false);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!overlayCanvasRef) return;
    const rect = overlayCanvasRef.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const vt = view();
    const prevZoom = vt.zoom;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5.0, prevZoom * factor));

    const w = overlayCanvasRef.width;
    const h = overlayCanvasRef.height;
    const { cellWidth, cellHeight } = grid();
    
    const cellWPrev = cellWidth * prevZoom;
    const cellHPrev = cellHeight * prevZoom;
    const cellWNew = cellWidth * newZoom;
    const cellHNew = cellHeight * newZoom;

    // 缩放前鼠标位置对应的偏移量
    const offsetXPrev = w / 2 - vt.x * cellWPrev;
    const offsetYPrev = h / 2 - vt.y * cellHPrev;

    // 鼠标下的网格坐标（缩放前）
    const gridX = (mouseX - offsetXPrev) / cellWPrev;
    const gridY = (mouseY - offsetYPrev) / cellHPrev;

    // 缩放后保持鼠标下的网格坐标不变
    const newVx = (w / 2 - mouseX + gridX * cellWNew) / cellWNew;
    const newVy = (h / 2 - mouseY + gridY * cellHNew) / cellHNew;

    setView({ x: newVx, y: newVy, zoom: newZoom });
    drawOverlay();
  };

  const frame = () => {
    clearBackground();
    requestAnimationFrame(frame);
  };

  onMount(async () => {
    if (!webgpuCanvasRef) return;
    renderer = new Renderer(webgpuCanvasRef);
    const ok = await renderer.init();
    if (!ok) return;
    resize();
    frame();
    window.addEventListener('resize', resize);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceDown(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    // store to cleanup
    (window as any).__icb_onKeyDown = onKeyDown;
    (window as any).__icb_onKeyUp = onKeyUp;
  });

  onCleanup(() => {
    window.removeEventListener('resize', resize);
    const kd = (window as any).__icb_onKeyDown as ((e: KeyboardEvent) => void) | undefined;
    const ku = (window as any).__icb_onKeyUp as ((e: KeyboardEvent) => void) | undefined;
    if (kd) window.removeEventListener('keydown', kd);
    if (ku) window.removeEventListener('keyup', ku);
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', 'background-color': '#0b0b11' }}>
      {/* top controls */}
      <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px', 'z-index': 10 }}>
        <select value={bgPreset()} onChange={(e) => setBgPreset(e.currentTarget.value as BgPreset)}>
          <option value="black">纯黑</option>
          <option value="white">纯白</option>
          <option value="transparent">透明</option>
          <option value="custom">自定义</option>
        </select>
        <input type="color" value={customBg()} onInput={(e) => setCustomBg(e.currentTarget.value)} disabled={bgPreset() !== 'custom'} />

        <label>
          列数
          <input type="number" min="1" value={grid().cols}
                 onInput={(e) => { const cols = parseInt(e.currentTarget.value) || 1; setGrid({ ...grid(), cols }); drawOverlay(); }}
                 style={{ width: '64px', 'margin-left': '6px' }} />
        </label>
        <label>
          行数
          <input type="number" min="1" value={grid().rows}
                 onInput={(e) => { const rows = parseInt(e.currentTarget.value) || 1; setGrid({ ...grid(), rows }); drawOverlay(); }}
                 style={{ width: '64px', 'margin-left': '6px' }} />
        </label>
        <label>
          格宽
          <input type="number" min="1" value={grid().cellWidth}
                 onInput={(e) => { const cellWidth = parseInt(e.currentTarget.value) || 1; setGrid({ ...grid(), cellWidth }); drawOverlay(); }}
                 style={{ width: '64px', 'margin-left': '6px' }} />
        </label>
        <label>
          格高
          <input type="number" min="1" value={grid().cellHeight}
                 onInput={(e) => { const cellHeight = parseInt(e.currentTarget.value) || 1; setGrid({ ...grid(), cellHeight }); drawOverlay(); }}
                 style={{ width: '64px', 'margin-left': '6px' }} />
        </label>
        <label>
          线宽
          <input type="number" min="1" value={grid().lineWidth}
                 onInput={(e) => { const lineWidth = parseInt(e.currentTarget.value) || 1; setGrid({ ...grid(), lineWidth }); drawOverlay(); }}
                 style={{ width: '64px', 'margin-left': '6px' }} />
        </label>
        <label>
          线色
          <input type="text" value={grid().lineColor}
                 onInput={(e) => { const lineColor = e.currentTarget.value; setGrid({ ...grid(), lineColor }); drawOverlay(); }}
                 style={{ width: '160px', 'margin-left': '6px' }} />
        </label>

        <div style={{ padding: '4px 8px', color: '#fff' }}>缩放 {(view().zoom * 100).toFixed(0)}%</div>
      </div>

      {/* canvases */}
      <canvas ref={webgpuCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <canvas ref={overlayCanvasRef}
              style={{ position: 'absolute', inset: 0 }}
              onMouseMove={onMouseMove}
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onWheel={onWheel} />
    </div>
  );
}

export default InfiniteCanvasBetter;


