import { createSignal, onCleanup, onMount, createEffect } from 'solid-js';

type GridConfig = {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  lineWidth: number;
  lineColor: string;
};

type BgPreset = '#1a1a1a' | '#fff' | 'custom';

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
    canvasRef.width = Math.floor(rect.width);
    canvasRef.height = Math.floor(rect.height);
    draw();
  };

  const draw = () => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const w = canvasRef.width;
    const h = canvasRef.height;
    
    // 清空画布
    ctx.clearRect(0, 0, w, h);

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
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = lineColor;

    // 绘制网格线
    for (let c = 0; c <= cols; c++) {
      const x = offsetX + c * cellW;
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + rows * cellH);
      ctx.stroke();
    }

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
    if (!canvasRef) return null;
    const rect = canvasRef.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { cols, rows, cellWidth, cellHeight } = grid();
    const w = canvasRef.width;
    const h = canvasRef.height;
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
    draw();
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
    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const vt = view();
    const prevZoom = vt.zoom;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(4.0, prevZoom * factor));

    const w = canvasRef.width;
    const h = canvasRef.height;
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
    };
    
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceDown(false);
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
        right: drawerOpen() ? 0 : '-360px',
        width: '360px',
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
