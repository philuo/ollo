/**
 * Mouse and Keyboard Interaction Handler for Tilemap
 * Handles zoom, pan, and grid hover interactions
 */

import {
  ViewTransform,
  MouseState,
  InteractionState,
  GridCell,
  TileMapEventHandlers
} from './types';
import { clamp, distance } from './utils/math';

export class InteractionHandler {
  private canvas: HTMLCanvasElement;
  private viewTransform: ViewTransform;
  private mouseState: MouseState;
  private interactionState: InteractionState;
  private eventHandlers: TileMapEventHandlers;

  // Zoom constraints
  private readonly MIN_ZOOM = 0.1; // 10%
  private readonly MAX_ZOOM = 5.0; // 500%
  private readonly ZOOM_SPEED = 0.001;

  // Pan constraints
  private panVelocity = { x: 0, y: 0 };
  private isPanning = false;
  private lastPanTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    initialView: Partial<ViewTransform> = {},
    eventHandlers: TileMapEventHandlers = {}
  ) {
    this.canvas = canvas;
    this.viewTransform = {
      x: 0,
      y: 0,
      zoom: 1.0,
      ...initialView
    };

    this.mouseState = {
      x: 0,
      y: 0,
      worldX: 0,
      worldY: 0,
      tileX: 0,
      tileY: 0,
      isOverCanvas: false
    };

    this.interactionState = {
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      viewStartX: 0,
      viewStartY: 0,
      isAltPressed: false,
      isMiddleButtonPressed: false
    };

    this.eventHandlers = eventHandlers;
    this.setupEventListeners();
  }

  /**
   * Set up all event listeners
   */
  private setupEventListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard events
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));

    // Touch events for mobile support
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  /**
   * Handle mouse down event
   */
  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if panning should start
    if (event.button === 1 || (event.button === 0 && this.interactionState.isAltPressed)) {
      this.startPanning(x, y);
    }

    // Handle grid click
    if (event.button === 0 && !this.interactionState.isAltPressed) {
      const gridCell = this.getGridCellAtPosition(x, y);
      if (gridCell) {
        this.eventHandlers.onGridClick?.(gridCell);
      }
    }
  }

  /**
   * Handle mouse move event
   */
  private handleMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.updateMouseState(x, y);

    // Handle panning
    if (this.interactionState.isPanning) {
      this.updatePanning(x, y);
    }

    // Handle grid hover
    const gridCell = this.getGridCellAtPosition(x, y);
    this.eventHandlers.onGridHover?.(gridCell);
  }

  /**
   * Handle mouse up event
   */
  private handleMouseUp(event: MouseEvent): void {
    if (this.interactionState.isPanning) {
      this.stopPanning();
    }
  }

  /**
   * Handle mouse wheel for zooming
   */
  private handleWheel(event: WheelEvent): void {
    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calculate zoom delta
    const zoomDelta = -event.deltaY * this.ZOOM_SPEED;
    const newZoom = clamp(this.viewTransform.zoom + zoomDelta, this.MIN_ZOOM, this.MAX_ZOOM);

    // Zoom towards mouse position
    this.zoomTowards(x, y, newZoom);
  }

  /**
   * Handle mouse enter
   */
  private handleMouseEnter(): void {
    this.mouseState.isOverCanvas = true;
    this.canvas.style.cursor = 'default';
  }

  /**
   * Handle mouse leave
   */
  private handleMouseLeave(): void {
    this.mouseState.isOverCanvas = false;
    this.stopPanning();
    this.eventHandlers.onGridHover?.(null);
  }

  /**
   * Handle key down
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Alt' && !this.interactionState.isAltPressed) {
      this.interactionState.isAltPressed = true;
      this.updateCursor();
    }
  }

  /**
   * Handle key up
   */
  private handleKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Alt') {
      this.interactionState.isAltPressed = false;
      this.updateCursor();
    }
  }

  /**
   * Handle touch start for mobile
   */
  private handleTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      this.startPanning(x, y);
    }
  }

  /**
   * Handle touch move for mobile
   */
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();

    if (event.touches.length === 1 && this.interactionState.isPanning) {
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      this.updatePanning(x, y);
    }
  }

  /**
   * Handle touch end for mobile
   */
  private handleTouchEnd(event: TouchEvent): void {
    this.stopPanning();
  }

  /**
   * Start panning
   */
  private startPanning(x: number, y: number): void {
    this.interactionState.isPanning = true;
    this.interactionState.panStartX = x;
    this.interactionState.panStartY = y;
    this.interactionState.viewStartX = this.viewTransform.x;
    this.interactionState.viewStartY = this.viewTransform.y;
    this.lastPanTime = performance.now();

    this.updateCursor();
  }

  /**
   * Update panning
   */
  private updatePanning(x: number, y: number): void {
    if (!this.interactionState.isPanning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastPanTime;
    this.lastPanTime = currentTime;

    // Calculate pan delta
    const deltaX = x - this.interactionState.panStartX;
    const deltaY = y - this.interactionState.panStartY;

    // Apply pan (inverse for natural movement)
    const panX = -deltaX / this.viewTransform.zoom;
    const panY = -deltaY / this.viewTransform.zoom;

    this.viewTransform.x = this.interactionState.viewStartX + panX;
    this.viewTransform.y = this.interactionState.viewStartY + panY;

    // Calculate velocity for smooth deceleration
    if (deltaTime > 0) {
      this.panVelocity.x = panX / deltaTime * 1000;
      this.panVelocity.y = panY / deltaTime * 1000;
    }

    this.eventHandlers.onViewChange?.(this.getViewTransform());
  }

  /**
   * Stop panning
   */
  private stopPanning(): void {
    this.interactionState.isPanning = false;
    this.updateCursor();

    // Apply smooth deceleration
    this.applyPanDeceleration();
  }

  /**
   * Apply smooth pan deceleration
   */
  private applyPanDeceleration(): void {
    const deceleration = 0.9;
    const minVelocity = 0.1;

    const animate = () => {
      if (Math.abs(this.panVelocity.x) < minVelocity && Math.abs(this.panVelocity.y) < minVelocity) {
        this.panVelocity.x = 0;
        this.panVelocity.y = 0;
        return;
      }

      this.viewTransform.x += this.panVelocity.x / 60; // Assuming 60 FPS
      this.viewTransform.y += this.panVelocity.y / 60;

      this.panVelocity.x *= deceleration;
      this.panVelocity.y *= deceleration;

      this.eventHandlers.onViewChange?.(this.getViewTransform());

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Zoom towards a specific point
   */
  private zoomTowards(x: number, y: number, newZoom: number): void {
    const oldZoom = this.viewTransform.zoom;
    const zoomRatio = newZoom / oldZoom;

    // Get world position under mouse before zoom
    const worldX = (x - this.canvas.width / 2) / oldZoom + this.viewTransform.x;
    const worldY = (y - this.canvas.height / 2) / oldZoom + this.viewTransform.y;

    // Update zoom
    this.viewTransform.zoom = newZoom;

    // Adjust position to keep the same world point under the mouse
    this.viewTransform.x = worldX - (x - this.canvas.width / 2) / newZoom;
    this.viewTransform.y = worldY - (y - this.canvas.height / 2) / newZoom;

    this.eventHandlers.onViewChange?.(this.getViewTransform());
    this.eventHandlers.onZoomChange?.(newZoom);
  }

  /**
   * Update mouse state
   */
  private updateMouseState(x: number, y: number): void {
    this.mouseState.x = x;
    this.mouseState.y = y;

    // Convert to world coordinates
    this.mouseState.worldX = (x - this.canvas.width / 2) / this.viewTransform.zoom + this.viewTransform.x;
    this.mouseState.worldY = (y - this.canvas.height / 2) / this.viewTransform.zoom + this.viewTransform.y;

    // Convert to tile coordinates (to be implemented based on grid size)
    // This would need access to grid configuration
  }

  /**
   * Get grid cell at screen position
   */
  private getGridCellAtPosition(x: number, y: number): GridCell | null {
    // This would need access to the grid configuration
    // For now, return null - this should be implemented based on the actual grid size
    return null;
  }

  /**
   * Update cursor based on interaction state
   */
  private updateCursor(): void {
    if (this.interactionState.isPanning) {
      this.canvas.style.cursor = 'grabbing';
    } else if (this.interactionState.isAltPressed) {
      this.canvas.style.cursor = 'grab';
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  /**
   * Get current view transform
   */
  public getViewTransform(): ViewTransform {
    return { ...this.viewTransform };
  }

  /**
   * Set view transform
   */
  public setViewTransform(transform: Partial<ViewTransform>): void {
    this.viewTransform = { ...this.viewTransform, ...transform };

    // Clamp zoom
    this.viewTransform.zoom = clamp(this.viewTransform.zoom, this.MIN_ZOOM, this.MAX_ZOOM);

    this.eventHandlers.onViewChange?.(this.getViewTransform());
  }

  /**
   * Get current mouse state
   */
  public getMouseState(): MouseState {
    return { ...this.mouseState };
  }

  /**
   * Check if currently panning
   */
  public isPanning(): boolean {
    return this.interactionState.isPanning;
  }

  /**
   * Clean up event listeners
   */
  public destroy(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.removeEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.removeEventListener('mouseenter', this.handleMouseEnter.bind(this));
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this));

    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
  }
}
