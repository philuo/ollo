import { onCleanup, onMount, createSignal } from 'solid-js';
import { InfiniteCanvasRenderer, type GridSettings, type ViewTransform } from '@/tilemap/InfiniteCanvasRenderer';

export default function InfiniteCanvasBetter() {
  let canvasRef: HTMLCanvasElement | undefined;
  let renderer: InfiniteCanvasRenderer | undefined;

  const [background, setBackground] = createSignal<string>('#000000');
  const [gridCols, setGridCols] = createSignal<number>(64);
  const [gridRows, setGridRows] = createSignal<number>(64);
  const [gridLineWidth, setGridLineWidth] = createSignal<number>(1);
  const [gridLineColor, setGridLineColor] = createSignal<string>('#ffffff80');
  const [zoom, setZoom] = createSignal<number>(100);

  const clampZoom = (z: number) => Math.min(500, Math.max(10, z));

  let device: GPUDevice | undefined;
  let context: GPUCanvasContext | undefined;
  let format: GPUTextureFormat | undefined;

  let view: ViewTransform = { x: 0, y: 0, zoom: 1 };
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let viewStart = { x: 0, y: 0 };

  const resizeCanvas = () => {
    const canvas = canvasRef!;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const needResize = canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr);
    if (needResize) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }
  };

  const render = () => {
    if (!renderer) return;
    renderer.render();
  };

  const updateGrid = () => {
    if (!renderer) return;
    const settings: GridSettings = {
      cellWidth: 64,
      cellHeight: 64,
      gridLineWidth: gridLineWidth(),
      gridLineColor: gridLineColor(),
      showGrid: true,
      gridCols: gridCols(),
      gridRows: gridRows(),
    };
    renderer.setGridSettings(settings);
    renderer.setBackgroundColor(background());
    render();
  };

  const updateView = () => {
    if (!renderer) return;
    renderer.setViewTransform(view);
    render();
  };

  onMount(async () => {
    const canvas = canvasRef!;
    if (!('gpu' in navigator)) {
      console.error('WebGPU not supported');
      return;
    }

    const adapter = await (navigator as any).gpu.requestAdapter();
    device = await adapter.requestDevice();
    context = canvas.getContext('webgpu') as unknown as GPUCanvasContext;
    format = (navigator as any).gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });

    renderer = new InfiniteCanvasRenderer(canvas, device, context, format);
    await renderer.init();

    resizeCanvas();
    updateGrid();
    view.zoom = clampZoom(zoom()) / 100;
    updateView();
    render();

    const onResize = () => {
      resizeCanvas();
      updateView();
      render();
    };
    window.addEventListener('resize', onResize);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const sign = e.deltaY > 0 ? -1 : 1;
      const step = Math.max(1, Math.round(zoom() * 0.1));
      const next = clampZoom(zoom() + sign * step);

      if (!renderer) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const before = renderer.screenToWorld(px, py);

      setZoom(next);
      view.zoom = next / 100;
      updateView();

      const after = renderer.screenToWorld(px, py);
      view.x += before.x - after.x;
      view.y += before.y - after.y;
      updateView();
    };

    const onPointerDown = (e: PointerEvent) => {
      const isMiddle = e.button === 1;
      const isAltLeft = e.button === 0 && e.altKey;
      if (isMiddle || isAltLeft) {
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        viewStart = { x: view.x, y: view.y };
        (e.target as Element).setPointerCapture(e.pointerId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!renderer) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const grid = renderer.screenToGrid(px, py);
      renderer.setHoveredCell({ x: grid.x, y: grid.y });

      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const worldDx = dx * dpr / view.zoom;
        const worldDy = dy * dpr / view.zoom;
        view.x = viewStart.x - worldDx;
        view.y = viewStart.y - worldDy;
        updateView();
      } else {
        render();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isPanning) {
        isPanning = false;
        (e.target as Element).releasePointerCapture(e.pointerId);
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    onCleanup(() => {
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('wheel', onWheel as EventListener);
      canvas.removeEventListener('pointerdown', onPointerDown as EventListener);
      window.removeEventListener('pointermove', onPointerMove as EventListener);
      window.removeEventListener('pointerup', onPointerUp as EventListener);
      renderer?.destroy();
    });
  });

  const Controls = () => (
    <div style={{
      position: 'absolute', left: '12px', top: '12px', padding: '12px',
      background: 'rgba(0,0,0,0.5)', color: '#fff', 'border-radius': '8px',
      display: 'flex', 'flex-direction': 'column', gap: '8px', 'backdrop-filter': 'blur(6px)'
    }}>
      <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
        <label>缩放</label>
        <input type="range" min={10} max={500} value={zoom()}
          onInput={(e) => { const v = clampZoom(Number((e.target as HTMLInputElement).value)); setZoom(v); view.zoom = v/100; updateView(); }} />
        <span>{zoom()}%</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
        <label>背景</label>
        <select value={background()} onChange={(e) => { setBackground((e.target as HTMLSelectElement).value); updateGrid(); }}>
          <option value="#000000">纯黑</option>
          <option value="#ffffff">纯白</option>
          <option value="#00000000">透明</option>
        </select>
        <input type="color" value={background()} onInput={(e) => { setBackground((e.target as HTMLInputElement).value); updateGrid(); }} />
      </div>
      <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
        <label>网格 行×列</label>
        <input type="number" min={1} max={1024} value={gridRows()} style={{ width: '80px' }}
          onInput={(e) => { setGridRows(Number((e.target as HTMLInputElement).value || '1')); updateGrid(); }} />
        ×
        <input type="number" min={1} max={1024} value={gridCols()} style={{ width: '80px' }}
          onInput={(e) => { setGridCols(Number((e.target as HTMLInputElement).value || '1')); updateGrid(); }} />
      </div>
      <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
        <label>线宽</label>
        <input type="number" min={1} max={10} value={gridLineWidth()} style={{ width: '80px' }}
          onInput={(e) => { setGridLineWidth(Number((e.target as HTMLInputElement).value || '1')); updateGrid(); }} />
        <label>颜色</label>
        <input type="color" value={gridLineColor()} onInput={(e) => { setGridLineColor((e.target as HTMLInputElement).value); updateGrid(); }} />
      </div>
      <div style={{ 'font-size': '12px', opacity: 0.8 }}>
        Alt + 左键 或 中键拖动 平移
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas ref={(el) => (canvasRef = el)} style={{ width: '100%', height: '100%', display: 'block' }} />
      <Controls />
    </div>
  );
}


