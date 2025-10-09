/**
 * Demo component for testing the WebGPU Tilemap implementation
 * This can be used to test the tilemap independently
 */

import { TilemapApp } from './index';

export function TilemapDemo() {
  return <TilemapApp />;
}

// For standalone testing
if (typeof window !== 'undefined') {
  // This allows the demo to be run directly in a browser
  console.log('WebGPU Tilemap Demo loaded');
}
