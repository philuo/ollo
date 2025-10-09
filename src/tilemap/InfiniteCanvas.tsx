/**
 * 基于 WebGPU 的无限画布 TileMap 工具
 * 支持无限网格、缩放、平移和网格高亮
 */

import { createSignal, onMount, onCleanup } from 'solid-js';
import { InfiniteCanvasRenderer } from './InfiniteCanvasRenderer';
import './InfiniteCanvas.css';

export function InfiniteCanvas() {
  // Canvas refs
  let canvasRef: HTMLCanvasElement | undefined;

  // Renderer
  let renderer: InfiniteCanvasRenderer | undefined;

  // 网格范围设置（有限网格）
  const GRID_COLS = 64;
  const GRID_ROWS = 64;
  
  // 视图变换状态 - 默认50%缩放，居中显示网格
  const [viewTransform, setViewTransform] = createSignal({ 
    x: (GRID_COLS * 64) / 2,  // 网格中心X
    y: (GRID_ROWS * 64) / 2,  // 网格中心Y
    zoom: 0.5  // 默认50%缩放
  });
  const [isPanning, setIsPanning] = createSignal(false);
  const [lastMousePos, setLastMousePos] = createSignal({ x: 0, y: 0 });
  const [hoveredCell, setHoveredCell] = createSignal<{ x: number; y: number } | null>(null);

  // 网格设置 - 默认64x64大小
  const [gridSettings, setGridSettings] = createSignal({
    cellWidth: 64,
    cellHeight: 64,
    gridLineWidth: 1,
    gridLineColor: '#ffffff80',
    showGrid: true,
    gridCols: GRID_COLS,
    gridRows: GRID_ROWS,
  });

  // 计算网格中心位置
  const getGridCenter = () => ({
    x: (gridSettings().gridCols * gridSettings().cellWidth) / 2,
    y: (gridSettings().gridRows * gridSettings().cellHeight) / 2,
  });

  // 背景设置
  const [backgroundColor, setBackgroundColor] = createSignal('#000000'); // 默认纯黑
  const [showColorPicker, setShowColorPicker] = createSignal(false);

  // 双击j键检测
  let lastJKeyTime = 0;
  const J_KEY_DOUBLE_CLICK_THRESHOLD = 300; // 300ms内双击

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

      const device = await adapter.requestDevice();
      const ctx = canvasRef.getContext('webgpu');
      if (!ctx) {
        alert('无法获取 WebGPU 上下文');
        return false;
      }

      const format = navigator.gpu.getPreferredCanvasFormat();
      ctx.configure({
        device,
        format,
        alphaMode: 'premultiplied',
      });

      // 初始化渲染器
      renderer = new InfiniteCanvasRenderer(canvasRef, device, ctx, format);
      await renderer.init();
      renderer.setViewTransform(viewTransform());
      renderer.setGridSettings(gridSettings());
      renderer.setBackgroundColor(backgroundColor());

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

    renderer.render();
    requestAnimationFrame(renderLoop);
  };

  /**
   * 处理画布鼠标事件
   */
  const handleCanvasMouseDown = (event: MouseEvent) => {
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      // 中键或 Alt+左键：平移
      setIsPanning(true);
      setLastMousePos({ x: event.clientX, y: event.clientY });
      event.preventDefault();
    }
  };

  const handleCanvasMouseMove = (event: MouseEvent) => {
    if (!canvasRef || !renderer) return;

    if (isPanning()) {
      // 平移视图
      const dx = event.clientX - lastMousePos().x;
      const dy = event.clientY - lastMousePos().y;
      const vt = viewTransform();
      setViewTransform({ ...vt, x: vt.x - dx / vt.zoom, y: vt.y - dy / vt.zoom });
      setLastMousePos({ x: event.clientX, y: event.clientY });

      renderer.setViewTransform(viewTransform());
    } else {
      // 更新悬浮的网格单元
      const rect = canvasRef.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const cell = renderer.screenToGrid(x, y);
      setHoveredCell(cell);
      renderer.setHoveredCell(cell);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  const handleCanvasWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (!canvasRef || !renderer) return;

    const rect = canvasRef.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // 获取鼠标在世界坐标中的位置（缩放前）
    const worldPosBefore = renderer.screenToWorld(mouseX, mouseY);

    const vt = viewTransform();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(4.0, vt.zoom * zoomFactor)); // 20%-400%

    // 更新缩放
    setViewTransform({ ...vt, zoom: newZoom });
    if (renderer) {
      renderer.setViewTransform(viewTransform());
    }

    // 获取鼠标在世界坐标中的位置（缩放后）
    const worldPosAfter = renderer.screenToWorld(mouseX, mouseY);

    // 调整视图位置，使鼠标指向的世界坐标保持不变
    const dx = worldPosAfter.x - worldPosBefore.x;
    const dy = worldPosAfter.y - worldPosBefore.y;
    
    const finalTransform = {
      x: vt.x - dx,
      y: vt.y - dy,
      zoom: newZoom,
    };
    
    setViewTransform(finalTransform);
    if (renderer) {
      renderer.setViewTransform(finalTransform);
    }
  };

  /**
   * 设置预设背景色
   */
  const setPresetBackground = (color: string) => {
    setBackgroundColor(color);
    if (renderer) {
      renderer.setBackgroundColor(color);
    }
  };

  /**
   * 更新网格设置
   */
  const updateGridSettings = (settings: Partial<typeof gridSettings>) => {
    const newSettings = { ...gridSettings(), ...settings };
    setGridSettings(newSettings);
    if (renderer) {
      renderer.setGridSettings(newSettings);
    }
  };

  /**
   * 重置视图到网格居中
   */
  const resetViewToCenter = () => {
    const center = getGridCenter();
    const newTransform = {
      x: center.x,
      y: center.y,
      zoom: 0.5, // 重置到默认50%缩放
    };
    setViewTransform(newTransform);
    if (renderer) {
      renderer.setViewTransform(newTransform);
    }
  };

  /**
   * 键盘事件处理
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'j' || event.key === 'J') {
      const now = Date.now();
      if (now - lastJKeyTime < J_KEY_DOUBLE_CLICK_THRESHOLD) {
        // 双击j键，回到居中
        resetViewToCenter();
        lastJKeyTime = 0; // 重置
      } else {
        lastJKeyTime = now;
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
    // 移除键盘事件监听
    window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div class="infinite-canvas-container">
      {/* 工具栏 */}
      <div class="canvas-toolbar">
        <div class="toolbar-section">
          <h3>背景颜色</h3>
          <div class="color-presets">
            <button
              class="color-btn black"
              title="纯黑"
              onClick={() => setPresetBackground('#000000')}
            />
            <button
              class="color-btn white"
              title="纯白"
              onClick={() => setPresetBackground('#ffffff')}
            />
            <div class="custom-color-wrapper">
              <button
                class="color-btn custom"
                title="自定义颜色"
                style={{ 'background-color': backgroundColor() }}
                onClick={() => setShowColorPicker(!showColorPicker())}
              />
              {showColorPicker() && (
                <input
                  type="color"
                  value={backgroundColor()}
                  onChange={(e) => {
                    setBackgroundColor(e.currentTarget.value);
                    if (renderer) {
                      renderer.setBackgroundColor(e.currentTarget.value);
                    }
                  }}
                  class="color-picker"
                />
              )}
            </div>
          </div>
        </div>

        <div class="toolbar-section">
          <h3>网格设置</h3>
          <div class="grid-controls">
            <label>
              <input
                type="checkbox"
                checked={gridSettings().showGrid}
                onChange={(e) => updateGridSettings({ showGrid: e.currentTarget.checked })}
              />
              显示网格
            </label>
            <label>
              网格列数:
              <input
                type="number"
                value={gridSettings().gridCols}
                onChange={(e) => updateGridSettings({ gridCols: parseInt(e.currentTarget.value) || 512 })}
                min="16"
                max="1024"
              />
            </label>
            <label>
              网格行数:
              <input
                type="number"
                value={gridSettings().gridRows}
                onChange={(e) => updateGridSettings({ gridRows: parseInt(e.currentTarget.value) || 512 })}
                min="16"
                max="1024"
              />
            </label>
            <label>
              单元宽度:
              <input
                type="number"
                value={gridSettings().cellWidth}
                onChange={(e) => updateGridSettings({ cellWidth: parseInt(e.currentTarget.value) || 64 })}
                min="16"
                max="128"
              />
            </label>
            <label>
              单元高度:
              <input
                type="number"
                value={gridSettings().cellHeight}
                onChange={(e) => updateGridSettings({ cellHeight: parseInt(e.currentTarget.value) || 64 })}
                min="16"
                max="128"
              />
            </label>
            <label>
              边框宽度:
              <input
                type="number"
                value={gridSettings().gridLineWidth}
                onChange={(e) => updateGridSettings({ gridLineWidth: parseFloat(e.currentTarget.value) || 1 })}
                min="0.5"
                max="5"
                step="0.5"
              />
            </label>
            <label>
              边框颜色:
              <input
                type="color"
                value={gridSettings().gridLineColor.substring(0, 7)}
                onChange={(e) => updateGridSettings({ gridLineColor: e.currentTarget.value + '80' })}
              />
            </label>
          </div>
        </div>

        <div class="toolbar-section">
          <h3>信息</h3>
          <div class="info-display">
            <div>网格: {gridSettings().gridCols} × {gridSettings().gridRows}</div>
            <div>单元: {gridSettings().cellWidth} × {gridSettings().cellHeight}px</div>
            <div>缩放: {(viewTransform().zoom * 100).toFixed(0)}%</div>
            {hoveredCell() && hoveredCell()!.x >= 0 && hoveredCell()!.x < gridSettings().gridCols &&
             hoveredCell()!.y >= 0 && hoveredCell()!.y < gridSettings().gridRows && (
              <div>网格: ({hoveredCell()!.x}, {hoveredCell()!.y})</div>
            )}
          </div>
        </div>
      </div>

      {/* 画布 */}
      <div class="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleCanvasWheel}
          style={{
            cursor: isPanning() ? 'grabbing' : 'default',
          }}
        />
      </div>

      {/* 操作提示 */}
      <div class="controls-hint">
        <h4>操作说明</h4>
        <ul>
          <li>滚轮: 以鼠标为中心缩放 (20% ~ 400%)</li>
          <li>Alt + 左键拖动: 平移视图</li>
          <li>中键拖动: 平移视图</li>
          <li>鼠标悬停: 高亮网格</li>
          <li>双击 J 键: 回到网格居中</li>
        </ul>
      </div>
    </div>
  );
}

