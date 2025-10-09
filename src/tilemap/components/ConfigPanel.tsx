/**
 * Configuration Panel for Tilemap Settings
 * Provides UI controls for grid and canvas configuration
 */

import { createSignal, For } from 'solid-js';
import {
  GridConfig,
  CanvasConfig,
  TileMapConfig
} from '../types';

interface ConfigPanelProps {
  config: TileMapConfig;
  onConfigChange: (config: TileMapConfig) => void;
  class?: string;
  style?: string;
}

export function ConfigPanel(props: ConfigPanelProps) {
  // Local state for form values
  const [gridRows, setGridRows] = createSignal(props.config.grid.rows);
  const [gridColumns, setGridColumns] = createSignal(props.config.grid.columns);
  const [borderWidth, setBorderWidth] = createSignal(props.config.grid.borderWidth);
  const [borderColor, setBorderColor] = createSignal(props.config.grid.borderColor);
  const [gridSize, setGridSize] = createSignal(props.config.canvasConfig.gridSize);
  const [backgroundColor, setBackgroundColor] = createSignal(props.config.canvasConfig.backgroundColor);

  // Predefined background colors
  const backgroundColors = [
    { value: 'black', label: '纯黑' },
    { value: 'white', label: '纯白' },
    { value: 'transparent', label: '透明' },
  ];

  // Handle grid configuration changes
  const handleGridChange = (updates: Partial<GridConfig>) => {
    const newConfig: TileMapConfig = {
      ...props.config,
      grid: {
        ...props.config.grid,
        ...updates
      }
    };
    props.onConfigChange(newConfig);
  };

  // Handle canvas configuration changes
  const handleCanvasChange = (updates: Partial<CanvasConfig>) => {
    const newConfig: TileMapConfig = {
      ...props.config,
      canvasConfig: {
        ...props.config.canvasConfig,
        ...updates
      }
    };
    props.onConfigChange(newConfig);
  };

  // Handle background color change
  const handleBackgroundColorChange = (value: string) => {
    setBackgroundColor(value);
    handleCanvasChange({ backgroundColor: value });
  };

  // Handle custom color input
  const handleCustomColorChange = (value: string) => {
    setBorderColor(value);
    handleGridChange({ borderColor: value });
  };

  return (
    <div class={`tilemap-config-panel ${props.class || ''}`} style={props.style}>
      <div style={{
        'background-color': 'rgba(30, 30, 46, 0.95)',
        'border-radius': '8px',
        padding: '16px',
        color: 'white',
        'font-family': 'system-ui, -apple-system, sans-serif',
        'backdrop-filter': 'blur(10px)',
        'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.3)',
      }}>
        <h3 style={{
          margin: '0 0 16px 0',
          'font-size': '16px',
          'font-weight': '600',
          'border-bottom': '1px solid rgba(255, 255, 255, 0.2)',
          'padding-bottom': '8px',
        }}>
          ⚙️ TileMap 配置
        </h3>

        {/* Grid Configuration */}
        <div style={{ 'margin-bottom': '20px' }}>
          <h4 style={{
            margin: '0 0 12px 0',
            'font-size': '14px',
            'font-weight': '500',
            color: 'rgba(255, 255, 255, 0.9)',
          }}>
            📐 网格设置
          </h4>

          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
            {/* Grid Rows */}
            <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
              <label style={{
                'min-width': '80px',
                'font-size': '13px',
                color: 'rgba(255, 255, 255, 0.8)',
              }}>
                行数:
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={gridRows()}
                onInput={(e) => {
                  const value = parseInt(e.target.value);
                  setGridRows(value);
                  handleGridChange({ rows: value });
                }}
                style={{
                  flex: 1,
                  height: '4px',
                  'background-color': 'rgba(255, 255, 255, 0.2)',
                  'border-radius': '2px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
              <span style={{
                'min-width': '30px',
                'font-size': '12px',
                'font-family': 'monospace',
                color: 'rgba(255, 255, 255, 0.9)',
              }}>
                {gridRows()}
              </span>
            </div>

            {/* Grid Columns */}
            <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
              <label style={{
                'min-width': '80px',
                'font-size': '13px',
                color: 'rgba(255, 255, 255, 0.8)',
              }}>
                列数:
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={gridColumns()}
                onInput={(e) => {
                  const value = parseInt(e.target.value);
                  setGridColumns(value);
                  handleGridChange({ columns: value });
                }}
                style={{
                  flex: 1,
                  height: '4px',
                  'background-color': 'rgba(255, 255, 255, 0.2)',
                  'border-radius': '2px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
              <span style={{
                'min-width': '30px',
                'font-size': '12px',
                'font-family': 'monospace',
                color: 'rgba(255, 255, 255, 0.9)',
              }}>
                {gridColumns()}
              </span>
            </div>

            {/* Border Width */}
            <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
              <label style={{
                'min-width': '80px',
                'font-size': '13px',
                color: 'rgba(255, 255, 255, 0.8)',
              }}>
                边框宽度:
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={borderWidth()}
                onInput={(e) => {
                  const value = parseFloat(e.target.value);
                  setBorderWidth(value);
                  handleGridChange({ borderWidth: value });
                }}
                style={{
                  flex: 1,
                  height: '4px',
                  'background-color': 'rgba(255, 255, 255, 0.2)',
                  'border-radius': '2px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
              <span style={{
                'min-width': '30px',
                'font-size': '12px',
                'font-family': 'monospace',
                color: 'rgba(255, 255, 255, 0.9)',
              }}>
                {borderWidth()}px
              </span>
            </div>

            {/* Border Color */}
            <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
              <label style={{
                'min-width': '80px',
                'font-size': '13px',
                color: 'rgba(255, 255, 255, 0.8)',
              }}>
                边框颜色:
              </label>
              <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', flex: 1 }}>
                <input
                  type="color"
                  value={borderColor()}
                  onInput={(e) => handleCustomColorChange(e.target.value)}
                  style={{
                    width: '40px',
                    height: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    'border-radius': '4px',
                    cursor: 'pointer',
                    'background-color': 'transparent',
                  }}
                />
                <input
                  type="text"
                  value={borderColor()}
                  onInput={(e) => handleCustomColorChange(e.target.value)}
                  placeholder="#ffffff"
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    'background-color': 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    'border-radius': '4px',
                    color: 'white',
                    'font-size': '12px',
                    'font-family': 'monospace',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Canvas Configuration */}
        <div style={{ 'margin-bottom': '20px' }}>
          <h4 style={{
            margin: '0 0 12px 0',
            'font-size': '14px',
            'font-weight': '500',
            color: 'rgba(255, 255, 255, 0.9)',
          }}>
            🎨 画布设置
          </h4>

          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
            {/* Grid Size */}
            <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
              <label style={{
                'min-width': '80px',
                'font-size': '13px',
                color: 'rgba(255, 255, 255, 0.8)',
              }}>
                网格大小:
              </label>
              <input
                type="range"
                min="16"
                max="128"
                step="8"
                value={gridSize()}
                onInput={(e) => {
                  const value = parseInt(e.target.value);
                  setGridSize(value);
                  handleCanvasChange({ gridSize: value });
                }}
                style={{
                  flex: 1,
                  height: '4px',
                  'background-color': 'rgba(255, 255, 255, 0.2)',
                  'border-radius': '2px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
              <span style={{
                'min-width': '30px',
                'font-size': '12px',
                'font-family': 'monospace',
                color: 'rgba(255, 255, 255, 0.9)',
              }}>
                {gridSize()}px
              </span>
            </div>

            {/* Background Color */}
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
              <label style={{
                'font-size': '13px',
                color: 'rgba(255, 255, 255, 0.8)',
              }}>
                背景颜色:
              </label>
              <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '8px' }}>
                <For each={backgroundColors}>
                  {(color) => (
                    <button
                      onClick={() => handleBackgroundColorChange(color.value)}
                      style={{
                        padding: '6px 12px',
                        'background-color': backgroundColor() === color.value
                          ? 'rgba(102, 126, 234, 0.8)'
                          : 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        'border-radius': '4px',
                        color: 'white',
                        'font-size': '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseOver={(e) => {
                        if (backgroundColor() !== color.value) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (backgroundColor() !== color.value) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        }
                      }}
                    >
                      {color.label}
                    </button>
                  )}
                </For>

                {/* Custom color input */}
                <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                  <input
                    type="color"
                    value={backgroundColor().startsWith('#') ? backgroundColor() : '#000000'}
                    onInput={(e) => handleBackgroundColorChange(e.target.value)}
                    style={{
                      width: '32px',
                      height: '28px',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      'border-radius': '4px',
                      cursor: 'pointer',
                      'background-color': 'transparent',
                    }}
                  />
                  <input
                    type="text"
                    value={backgroundColor()}
                    onInput={(e) => handleBackgroundColorChange(e.target.value)}
                    placeholder="#000000"
                    style={{
                      width: '80px',
                      padding: '4px 6px',
                      'background-color': 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      'border-radius': '4px',
                      color: 'white',
                      'font-size': '11px',
                      'font-family': 'monospace',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current Settings Display */}
        <div style={{
          'background-color': 'rgba(0, 0, 0, 0.3)',
          'border-radius': '4px',
          padding: '12px',
          'font-size': '11px',
          'font-family': 'monospace',
          'line-height': '1.4',
          color: 'rgba(255, 255, 255, 0.7)',
        }}>
          <div style={{ 'font-weight': 'bold', 'margin-bottom': '6px', color: 'rgba(255, 255, 255, 0.9)' }}>
            当前配置:
          </div>
          <div>网格: {gridRows()} × {gridColumns()}</div>
          <div>边框: {borderWidth()}px, {borderColor()}</div>
          <div>网格大小: {gridSize()}px</div>
          <div>背景: {backgroundColor()}</div>
          <div>总网格数: {gridRows() * gridColumns()}</div>
        </div>
      </div>
    </div>
  );
}
