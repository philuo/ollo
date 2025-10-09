/**
 * Main WebGPU Tilemap Component with Infinite Canvas
 * Manages WebGPU initialization, rendering loop, and user interactions
 */

import { createEffect, createSignal, onMount, onCleanup } from 'solid-js';
import {
  GridConfig,
  CanvasConfig,
  ViewTransform,
  TileMapConfig,
  GridHighlight,
  RenderStats,
  GridCell
} from '../types';
import { TilemapRenderer } from '../TilemapRenderer';
import { InteractionHandler } from '../InteractionHandler';

interface TilemapCanvasProps {
  config: TileMapConfig;
  class?: string;
  style?: string;
  onStatsUpdate?: (stats: RenderStats) => void;
}

export function TilemapCanvas(props: TilemapCanvasProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let renderer: TilemapRenderer | null = null;
  let interactionHandler: InteractionHandler | null = null;
  let animationFrameId: number | null = null;
  let device: GPUDevice | null = null;
  let context: GPUCanvasContext | null = null;

  // State management
  const [isInitialized, setIsInitialized] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [highlight, setHighlight] = createSignal<GridHighlight>({ cell: null, visible: false });
  const [stats, setStats] = createSignal<RenderStats>({
    visibleGrids: 0,
    totalGrids: 0,
    fps: 0,
    frameTime: 0
  });

  // Initialize WebGPU
  const initializeWebGPU = async (): Promise<boolean> => {
    if (!canvasRef) return false;

    try {
      // Check WebGPU support
      if (!navigator.gpu) {
        throw new Error('WebGPU is not supported in this browser');
      }

      // Get GPU adapter
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error('Failed to get GPU adapter');
      }

      // Get GPU device
      device = await adapter.requestDevice();
      if (!device) {
        throw new Error('Failed to get GPU device');
      }

      // Get canvas context
      context = canvasRef.getContext('webgpu');
      if (!context) {
        throw new Error('Failed to get WebGPU context');
      }

      // Configure context
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: 'premultiplied',
      });

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize WebGPU');
      return false;
    }
  };

  // Initialize renderer and interaction handler
  const initializeComponents = async () => {
    if (!device || !context || !canvasRef) return;

    try {
      // Create renderer
      renderer = new TilemapRenderer(
        canvasRef,
        device,
        context,
        navigator.gpu.getPreferredCanvasFormat(),
        props.config.grid,
        props.config.canvasConfig
      );

      await renderer.init();

      // Create interaction handler
      interactionHandler = new InteractionHandler(
        canvasRef,
        props.config.initialView,
        {
          onGridHover: (cell) => {
            setHighlight({ cell, visible: cell !== null });
          },
          onGridClick: (cell) => {
            console.log('Grid clicked:', cell);
          },
          onViewChange: (transform) => {
            renderer?.setViewTransform(transform);
          },
          onZoomChange: (zoom) => {
            console.log('Zoom changed:', zoom);
          }
        }
      );

      // Set initial view
      if (props.config.initialView) {
        renderer.setViewTransform(props.config.initialView);
        interactionHandler.setViewTransform(props.config.initialView);
      }

      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize components');
    }
  };

  // Animation loop
  const render = () => {
    if (!renderer || !isInitialized()) return;

    try {
      // Update highlight
      const currentHighlight = highlight();
      if (currentHighlight.visible && currentHighlight.cell) {
        renderer.setHighlight(currentHighlight.cell);
      } else {
        renderer.setHighlight(null);
      }

      // Render frame
      renderer.render();

      // Update stats
      const newStats = renderer.getStats();
      setStats(newStats);
      props.onStatsUpdate?.(newStats);

      // Schedule next frame
      animationFrameId = requestAnimationFrame(render);
    } catch (err) {
      console.error('Render error:', err);
      setError(err instanceof Error ? err.message : 'Render error');
    }
  };

  // Handle canvas resize
  const handleResize = () => {
    if (!canvasRef || !context || !device) return;

    const displayWidth = canvasRef.clientWidth;
    const displayHeight = canvasRef.clientHeight;

    // Set canvas size
    canvasRef.width = displayWidth;
    canvasRef.height = displayHeight;

    // Reconfigure context
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });
  };

  // Initialize on mount
  onMount(async () => {
    const success = await initializeWebGPU();
    if (success) {
      await initializeComponents();
      handleResize();
      render();
    }
  });

  // Handle resize events
  createEffect(() => {
    if (!isInitialized()) return;

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (canvasRef) {
      resizeObserver.observe(canvasRef);
    }

    onCleanup(() => {
      resizeObserver.disconnect();
    });
  });

  // Handle config updates
  createEffect(() => {
    if (!renderer || !isInitialized()) return;

    // Update grid config
    renderer.updateGridConfig(props.config.grid);

    // Update canvas config
    renderer.updateCanvasConfig(props.config.canvasConfig);
  });

  // Cleanup on unmount
  onCleanup(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }

    if (interactionHandler) {
      interactionHandler.destroy();
    }

    if (renderer) {
      renderer.destroy();
    }
  });

  return (
    <div class={`tilemap-canvas-container ${props.class || ''}`} style={props.style}>
      <canvas
        ref={canvasRef}
        class="tilemap-canvas"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          'background-color': props.config.canvasConfig.backgroundColor === 'transparent'
            ? 'transparent'
            : props.config.canvasConfig.backgroundColor,
        }}
      />

      {/* Error display */}
      {error() && (
        <div class="tilemap-error" style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          'background-color': 'rgba(255, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          'border-radius': '4px',
          'font-family': 'monospace',
          'font-size': '12px',
        }}>
          <div>WebGPU Error:</div>
          <div>{error()}</div>
        </div>
      )}

      {/* Stats display */}
      {props.config.enableStats && (
        <div class="tilemap-stats" style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          'background-color': 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px',
          'border-radius': '4px',
          'font-family': 'monospace',
          'font-size': '11px',
          'line-height': '1.4',
        }}>
          <div>FPS: {stats().fps}</div>
          <div>Frame Time: {stats().frameTime.toFixed(2)}ms</div>
          <div>Visible Grids: {stats().visibleGrids}</div>
          <div>Zoom: {interactionHandler?.getViewTransform().zoom.toFixed(2)}x</div>
        </div>
      )}

      {/* Controls help */}
      <div class="tilemap-help" style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        'background-color': 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '8px',
        'border-radius': '4px',
        'font-family': 'sans-serif',
        'font-size': '11px',
        'line-height': '1.4',
      }}>
        <div style={{ 'font-weight': 'bold', 'margin-bottom': '4px' }}>Controls:</div>
        <div>🖱️ Scroll: Zoom (10%-500%)</div>
        <div>⌨️ Alt + Drag: Pan</div>
        <div>🖱️ Middle Mouse: Pan</div>
        <div>🖱️ Hover: Highlight grid</div>
      </div>

      {/* Highlight indicator */}
      {highlight().visible && highlight().cell && (
        <div class="tilemap-highlight-info" style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          'background-color': 'rgba(0, 100, 200, 0.8)',
          color: 'white',
          padding: '6px 10px',
          'border-radius': '4px',
          'font-family': 'monospace',
          'font-size': '12px',
        }}>
          Grid: [{highlight().cell!.row}, {highlight().cell!.column}]
        </div>
      )}
    </div>
  );
}
