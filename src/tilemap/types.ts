/**
 * Core types and interfaces for WebGPU-based TileMap system
 */

export interface GridConfig {
  rows: number;
  columns: number;
  borderWidth: number;
  borderColor: string;
}

export interface CanvasConfig {
  backgroundColor: 'black' | 'white' | 'transparent' | string;
  gridSize: number; // Size of each grid cell in pixels
}

export interface ViewTransform {
  x: number;
  y: number;
  zoom: number; // 0.1 to 5.0 (10% to 500%)
}

export interface GridCell {
  x: number;
  y: number;
  row: number;
  column: number;
}

export interface GridHighlight {
  cell: GridCell | null;
  visible: boolean;
}

export interface MouseState {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  tileX: number;
  tileY: number;
  isOverCanvas: boolean;
}

export interface InteractionState {
  isPanning: boolean;
  panStartX: number;
  panStartY: number;
  viewStartX: number;
  viewStartY: number;
  isAltPressed: boolean;
  isMiddleButtonPressed: boolean;
}

export interface TileMapViewport {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RenderBounds {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

// WebGPU specific types
export interface TilemapUniforms {
  viewMatrix: Float32Array; // mat3x3
  gridSize: Float32Array;   // vec2
  gridConfig: Float32Array; // vec4 (rows, cols, borderWidth, padding)
  gridColor: Float32Array;  // vec4 (rgba)
  backgroundColor: Float32Array; // vec4 (rgba)
}

export interface RenderStats {
  visibleGrids: number;
  totalGrids: number;
  fps: number;
  frameTime: number;
}

// Event types
export interface TileMapEventHandlers {
  onGridHover?: (cell: GridCell | null) => void;
  onGridClick?: (cell: GridCell) => void;
  onViewChange?: (transform: ViewTransform) => void;
  onZoomChange?: (zoom: number) => void;
}

// Color utility types
export interface ColorRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Configuration interface
export interface TileMapConfig {
  canvas: HTMLCanvasElement;
  grid: GridConfig;
  canvasConfig: CanvasConfig;
  initialView?: Partial<ViewTransform>;
  eventHandlers?: TileMapEventHandlers;
  enableStats?: boolean;
}
