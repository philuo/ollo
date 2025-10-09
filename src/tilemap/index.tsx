/**
 * Main entry point for the WebGPU Tilemap module
 * Exports the main TilemapApp component and related utilities
 */

import { TilemapApp } from './TilemapApp';

// Export main component
export { TilemapApp };

// Export types for external use
export type {
  GridConfig,
  CanvasConfig,
  ViewTransform,
  GridCell,
  GridHighlight,
  MouseState,
  InteractionState,
  TileMapViewport,
  RenderBounds,
  TilemapUniforms,
  RenderStats,
  TileMapEventHandlers,
  ColorRGBA,
  TileMapConfig
} from './types';

// Export renderer and interaction handlers for advanced usage
export { TilemapRenderer } from './TilemapRenderer';
export { InteractionHandler } from './InteractionHandler';

// Export utility functions
export * from './utils/color';
export * from './utils/math';

// Export components
export { TilemapCanvas } from './components/TilemapCanvas';
export { ConfigPanel } from './components/ConfigPanel';

// Default export
export default TilemapApp;
