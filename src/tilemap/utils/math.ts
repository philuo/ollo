/**
 * Coordinate transformation and math utilities
 */

import { ViewTransform, TileMapViewport, RenderBounds } from '../types';

/**
 * Creates a 3x3 transformation matrix for 2D transformations
 */
export function createViewMatrix(transform: ViewTransform): Float32Array {
  const { x, y, zoom } = transform;

  // Create 2D transformation matrix (column-major order for WebGPU)
  // [ scale_x, 0,        translate_x ]
  // [ 0,       scale_y,  translate_y ]
  // [ 0,       0,        1          ]
  return new Float32Array([
    zoom, 0, 0,
    0, zoom, 0,
    x, y, 1
  ]);
}

/**
 * Creates orthographic projection matrix for 2D rendering
 */
export function createOrthoMatrix(width: number, height: number): Float32Array {
  // Standard 2D orthographic projection
  const left = 0;
  const right = width;
  const top = 0;
  const bottom = height;
  const near = -1;
  const far = 1;

  const tx = -(right + left) / (right - left);
  const ty = -(top + bottom) / (top - bottom);

  return new Float32Array([
    2 / (right - left), 0, 0,
    0, 2 / (top - bottom), 0,
    tx, ty, 1
  ]);
}

/**
 * Transforms screen coordinates to world coordinates
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  transform: ViewTransform,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  // Convert screen coordinates to normalized device coordinates (-1 to 1)
  const ndcX = (screenX / canvasWidth) * 2 - 1;
  const ndcY = -((screenY / canvasHeight) * 2 - 1); // Flip Y axis

  // Apply inverse transformation
  const worldX = (ndcX / transform.zoom) + transform.x;
  const worldY = (ndcY / transform.zoom) + transform.y;

  return { x: worldX, y: worldY };
}

/**
 * Transforms world coordinates to screen coordinates
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  transform: ViewTransform,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  // Apply transformation
  const transformedX = (worldX - transform.x) * transform.zoom;
  const transformedY = (worldY - transform.y) * transform.zoom;

  // Convert to screen coordinates
  const screenX = ((transformedX + 1) / 2) * canvasWidth;
  const screenY = ((-transformedY + 1) / 2) * canvasHeight; // Flip Y axis back

  return { x: screenX, y: screenY };
}

/**
 * Calculates the visible viewport in world coordinates
 */
export function calculateViewport(
  transform: ViewTransform,
  canvasWidth: number,
  canvasHeight: number
): TileMapViewport {
  const topLeft = screenToWorld(0, 0, transform, canvasWidth, canvasHeight);
  const bottomRight = screenToWorld(canvasWidth, canvasHeight, transform, canvasWidth, canvasHeight);

  return {
    left: Math.min(topLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, bottomRight.y),
    right: Math.max(topLeft.x, bottomRight.x),
    bottom: Math.max(topLeft.y, bottomRight.y),
  };
}

/**
 * Calculates which grid cells are visible within the viewport
 */
export function calculateVisibleBounds(
  viewport: TileMapViewport,
  gridSize: number,
  borderWidth: number
): RenderBounds {
  const cellSize = gridSize + borderWidth * 2;

  return {
    startRow: Math.floor(viewport.top / cellSize) - 1, // Add padding for smooth scrolling
    endRow: Math.ceil(viewport.bottom / cellSize) + 1,
    startCol: Math.floor(viewport.left / cellSize) - 1,
    endCol: Math.ceil(viewport.right / cellSize) + 1,
  };
}

/**
 * Checks if a point is inside a rectangle
 */
export function pointInRect(
  x: number,
  y: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean {
  return x >= rectX && x <= rectX + rectWidth && y >= rectY && y <= rectY + rectHeight;
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * Math.max(0, Math.min(1, t));
}

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Checks if two floating point numbers are approximately equal
 */
export function approximatelyEqual(a: number, b: number, epsilon: number = 0.0001): boolean {
  return Math.abs(a - b) < epsilon;
}

/**
 * Calculates the distance between two points
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
