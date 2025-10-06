import { createSignal, For, Show, onMount } from 'solid-js';
import './SpriteSheetComposer.css';

interface GridCell {
  row: number;
  col: number;
  imageUrl: string | null;
}

export default function SpriteSheetComposer() {
  const [canvasWidth, setCanvasWidth] = createSignal(512);
  const [canvasHeight, setCanvasHeight] = createSignal(512);
  const [gridWidth, setGridWidth] = createSignal(64);
  const [gridHeight, setGridHeight] = createSignal(64);
  const [canvasCreated, setCanvasCreated] = createSignal(false);
  const [gridCells, setGridCells] = createSignal<GridCell[]>([]);
  const [selectedCell, setSelectedCell] = createSignal<{ row: number; col: number } | null>(null);
  const [uploadedImages, setUploadedImages] = createSignal<string[]>([]);
  const [selectedImage, setSelectedImage] = createSignal<string | null>(null);
  const [cols, setCols] = createSignal(0);
  const [rows, setRows] = createSignal(0);
  
  // 网格填充
  const [gridPaddingTop, setGridPaddingTop] = createSignal(0);
  const [gridPaddingRight, setGridPaddingRight] = createSignal(0);
  const [gridPaddingBottom, setGridPaddingBottom] = createSignal(0);
  const [gridPaddingLeft, setGridPaddingLeft] = createSignal(0);
  
  // 画布填充
  const [canvasPaddingTop, setCanvasPaddingTop] = createSignal(0);
  const [canvasPaddingRight, setCanvasPaddingRight] = createSignal(0);
  const [canvasPaddingBottom, setCanvasPaddingBottom] = createSignal(0);
  const [canvasPaddingLeft, setCanvasPaddingLeft] = createSignal(0);
  
  // 网格间隙
  const [gridGapHorizontal, setGridGapHorizontal] = createSignal(0);
  const [gridGapVertical, setGridGapVertical] = createSignal(0);

  let canvasRef: HTMLCanvasElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;

  // 创建画布和网格
  const createCanvas = () => {
    const width = canvasWidth();
    const height = canvasHeight();
    const gWidth = gridWidth();
    const gHeight = gridHeight();
    const cPaddingLeft = canvasPaddingLeft();
    const cPaddingRight = canvasPaddingRight();
    const cPaddingTop = canvasPaddingTop();
    const cPaddingBottom = canvasPaddingBottom();
    const gapH = gridGapHorizontal();
    const gapV = gridGapVertical();

    if (width <= 0 || height <= 0 || gWidth <= 0 || gHeight <= 0) {
      alert('请输入有效的尺寸');
      return;
    }

    // 计算可用空间
    const availableWidth = width - cPaddingLeft - cPaddingRight;
    const availableHeight = height - cPaddingTop - cPaddingBottom;

    // 计算网格数量（考虑gap）
    // 公式: n个网格 + (n-1)个间隙 <= 可用空间
    // n * gridWidth + (n-1) * gap <= availableWidth
    // n * gridWidth + n * gap - gap <= availableWidth
    // n * (gridWidth + gap) <= availableWidth + gap
    const numCols = Math.floor((availableWidth + gapH) / (gWidth + gapH));
    const numRows = Math.floor((availableHeight + gapV) / (gHeight + gapV));

    setCols(numCols);
    setRows(numRows);

    // 初始化网格单元
    const cells: GridCell[] = [];
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        cells.push({ row, col, imageUrl: null });
      }
    }
    setGridCells(cells);
    setCanvasCreated(true);
    setSelectedCell({ row: 0, col: 0 }); // 默认选中第一个

    console.log(`画布已创建: ${width}x${height}, 网格: ${gWidth}x${gHeight}, 共 ${numRows}行 x ${numCols}列`);
  };

  // 重置画布
  const resetCanvas = () => {
    setCanvasCreated(false);
    setGridCells([]);
    setSelectedCell(null);
    setUploadedImages([]);
  };

  // 上传图片
  const handleImageUpload = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files) return;

    const files = Array.from(input.files);
    const imageUrls: string[] = [];

    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        imageUrls.push(url);
      }
    });

    setUploadedImages(prev => [...prev, ...imageUrls]);
    console.log(`已上传 ${imageUrls.length} 张图片`);
  };

  // 选中网格
  const selectCell = (row: number, col: number) => {
    setSelectedCell({ row, col });
    
    // 如果网格已填充，高亮对应的图片
    const cell = gridCells().find(c => c.row === row && c.col === col);
    if (cell?.imageUrl) {
      setSelectedImage(cell.imageUrl);
    } else {
      setSelectedImage(null);
    }
  };

  // 填充图片到选中的网格
  const fillImageToSelectedCell = (imageUrl: string) => {
    const selected = selectedCell();
    if (!selected) return;

    // 更新网格单元
    setGridCells(cells =>
      cells.map(cell =>
        cell.row === selected.row && cell.col === selected.col
          ? { ...cell, imageUrl }
          : cell
      )
    );

    // 设置选中的图片
    setSelectedImage(imageUrl);

    // 自动选中下一个网格
    selectNextCell(selected.row, selected.col);
  };

  // 选中下一个网格（优先水平方向）
  const selectNextCell = (currentRow: number, currentCol: number) => {
    const numCols = cols();
    const numRows = rows();

    // 优先选中同一行的下一个
    if (currentCol + 1 < numCols) {
      setSelectedCell({ row: currentRow, col: currentCol + 1 });
    }
    // 如果是最后一列，选中下一行的第一个
    else if (currentRow + 1 < numRows) {
      setSelectedCell({ row: currentRow + 1, col: 0 });
    }
    // 如果已经是最后一个，回到第一个
    else {
      setSelectedCell({ row: 0, col: 0 });
    }
  };

  // 更新网格尺寸或画布填充
  const updateGridSize = () => {
    const width = canvasWidth();
    const height = canvasHeight();
    const gWidth = gridWidth();
    const gHeight = gridHeight();
    const cPaddingLeft = canvasPaddingLeft();
    const cPaddingRight = canvasPaddingRight();
    const cPaddingTop = canvasPaddingTop();
    const cPaddingBottom = canvasPaddingBottom();
    const gapH = gridGapHorizontal();
    const gapV = gridGapVertical();

    if (width <= 0 || height <= 0 || gWidth <= 0 || gHeight <= 0) {
      alert('请输入有效的尺寸');
      return;
    }

    // 计算可用空间
    const availableWidth = width - cPaddingLeft - cPaddingRight;
    const availableHeight = height - cPaddingTop - cPaddingBottom;

    // 计算网格数量（考虑gap）
    const numCols = Math.floor((availableWidth + gapH) / (gWidth + gapH));
    const numRows = Math.floor((availableHeight + gapV) / (gHeight + gapV));

    setCols(numCols);
    setRows(numRows);

    // 保留现有的图片数据
    const oldCells = gridCells();
    const cells: GridCell[] = [];
    
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const existingCell = oldCells.find(c => c.row === row && c.col === col);
        cells.push({
          row,
          col,
          imageUrl: existingCell?.imageUrl || null,
        });
      }
    }
    
    setGridCells(cells);
    console.log(`网格已更新: ${numRows}行 x ${numCols}列`);
  };

  // 导出雪碧图
  const exportSpriteSheet = () => {
    if (!canvasRef) return;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvasWidth(), canvasHeight());

    // 绘制所有图片
    const cells = gridCells();
    const gWidth = gridWidth();
    const gHeight = gridHeight();
    const gPaddingTop = gridPaddingTop();
    const gPaddingRight = gridPaddingRight();
    const gPaddingBottom = gridPaddingBottom();
    const gPaddingLeft = gridPaddingLeft();
    const cPaddingTop = canvasPaddingTop();
    const cPaddingLeft = canvasPaddingLeft();
    const gapH = gridGapHorizontal();
    const gapV = gridGapVertical();

    let loadedCount = 0;
    const totalImages = cells.filter(cell => cell.imageUrl).length;

    if (totalImages === 0) {
      alert('请先添加图片');
      return;
    }

    cells.forEach(cell => {
      if (cell.imageUrl) {
        const img = new Image();
        img.onload = () => {
          // 计算绘制位置和尺寸（考虑padding和gap）
          // 位置 = 画布填充 + (网格大小 + gap) * 索引 + 网格内填充
          const x = cPaddingLeft + cell.col * (gWidth + gapH) + gPaddingLeft;
          const y = cPaddingTop + cell.row * (gHeight + gapV) + gPaddingTop;
          const w = gWidth - gPaddingLeft - gPaddingRight;
          const h = gHeight - gPaddingTop - gPaddingBottom;
          
          ctx.drawImage(img, x, y, w, h);
          loadedCount++;

          // 所有图片加载完成后导出
          if (loadedCount === totalImages) {
            canvasRef?.toBlob(blob => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `spritesheet_${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(url);
                console.log('雪碧图已导出');
              }
            });
          }
        };
        img.src = cell.imageUrl;
      }
    });
  };

  // 移除图片
  const removeImage = (imageUrl: string) => {
    setUploadedImages(imgs => imgs.filter(img => img !== imageUrl));
    URL.revokeObjectURL(imageUrl);
  };

  // 清空网格
  const clearCell = (row: number, col: number) => {
    setGridCells(cells =>
      cells.map(cell =>
        cell.row === row && cell.col === col
          ? { ...cell, imageUrl: null }
          : cell
      )
    );
  };

  return (
    <div class="sprite-composer-container">
      <h1>🎨 雪碧图合成工具</h1>

      <div class="composer-content">
        {/* 左侧配置面板 */}
        <div class="config-panel">
          <Show when={!canvasCreated()}>
            <div class="section">
              <h2>画布配置</h2>
              <div class="input-group">
                <label>
                  画布宽度 (px):
                  <input
                    type="number"
                    value={canvasWidth()}
                    onInput={e => setCanvasWidth(parseInt(e.currentTarget.value) || 0)}
                    min="1"
                  />
                </label>
                <label>
                  画布高度 (px):
                  <input
                    type="number"
                    value={canvasHeight()}
                    onInput={e => setCanvasHeight(parseInt(e.currentTarget.value) || 0)}
                    min="1"
                  />
                </label>
              </div>
              
              <details>
                <summary>画布填充 (可选)</summary>
                <div class="padding-grid">
                  <div class="padding-center">
                    <input
                      type="number"
                      value={canvasPaddingTop()}
                      onInput={e => setCanvasPaddingTop(parseInt(e.currentTarget.value) || 0)}
                      min="0"
                      placeholder="上"
                      title="上边距"
                    />
                  </div>
                  <div class="padding-left">
                    <input
                      type="number"
                      value={canvasPaddingLeft()}
                      onInput={e => setCanvasPaddingLeft(parseInt(e.currentTarget.value) || 0)}
                      min="0"
                      placeholder="左"
                      title="左边距"
                    />
                  </div>
                  <div class="padding-middle"></div>
                  <div class="padding-right">
                    <input
                      type="number"
                      value={canvasPaddingRight()}
                      onInput={e => setCanvasPaddingRight(parseInt(e.currentTarget.value) || 0)}
                      min="0"
                      placeholder="右"
                      title="右边距"
                    />
                  </div>
                  <div class="padding-bottom">
                    <input
                      type="number"
                      value={canvasPaddingBottom()}
                      onInput={e => setCanvasPaddingBottom(parseInt(e.currentTarget.value) || 0)}
                      min="0"
                      placeholder="下"
                      title="下边距"
                    />
                  </div>
                </div>
              </details>
            </div>

            <div class="section">
              <h2>网格配置</h2>
              <div class="input-group">
                <label>
                  网格宽度 (px):
                  <input
                    type="number"
                    value={gridWidth()}
                    onInput={e => setGridWidth(parseInt(e.currentTarget.value) || 0)}
                    min="1"
                  />
                </label>
                <label>
                  网格高度 (px):
                  <input
                    type="number"
                    value={gridHeight()}
                    onInput={e => setGridHeight(parseInt(e.currentTarget.value) || 0)}
                    min="1"
                  />
                </label>
              </div>
              
              <details>
                <summary>网格填充 (可选)</summary>
                <div class="padding-grid">
                  <div class="padding-center">
                    <input
                      type="number"
                      value={gridPaddingTop()}
                      onInput={e => setGridPaddingTop(parseInt(e.currentTarget.value) || 0)}
                      min="0"
                      placeholder="上"
                      title="上边距"
                    />
                  </div>
                  <div class="padding-left">
                    <input
                      type="number"
                      value={gridPaddingLeft()}
                      onInput={e => setGridPaddingLeft(parseInt(e.currentTarget.value) || 0)}
                      min="0"
                      placeholder="左"
                      title="左边距"
                    />
                  </div>
                  <div class="padding-middle"></div>
                  <div class="padding-right">
                    <input
                      type="number"
                      value={gridPaddingRight()}
                      onInput={e => setGridPaddingRight(parseInt(e.currentTarget.value) || 0)}
                      min="0"
                      placeholder="右"
                      title="右边距"
                    />
                  </div>
                  <div class="padding-bottom">
                    <input
                      type="number"
                      value={gridPaddingBottom()}
                      onInput={e => setGridPaddingBottom(parseInt(e.currentTarget.value) || 0)}
                      min="0"
                      placeholder="下"
                      title="下边距"
                    />
                  </div>
                </div>
              </details>
              
              <details>
                <summary>网格间隙 (可选)</summary>
                <div class="input-group">
                  <label>
                    水平间隙 (px):
                    <input
                      type="number"
                      value={gridGapHorizontal()}
                      onInput={e => setGridGapHorizontal(parseInt(e.currentTarget.value) || 0)}
                      min="0"
                    />
                  </label>
                  <label>
                    垂直间隙 (px):
                    <input
                      type="number"
                      value={gridGapVertical()}
                      onInput={e => setGridGapVertical(parseInt(e.currentTarget.value) || 0)}
                      min="0"
                    />
                  </label>
                </div>
              </details>
            </div>

            <button class="btn-primary" onClick={createCanvas}>
              创建画布
            </button>
          </Show>

          <Show when={canvasCreated()}>
            <div class="section">
              <h2>画布信息</h2>
              <div class="info-box">
                <p>目标画布尺寸: {canvasWidth()} x {canvasHeight()}</p>
                <p>
                  实际画布尺寸: {
                    cols() * gridWidth() + 
                    (cols() - 1) * gridGapHorizontal() + 
                    canvasPaddingLeft() + canvasPaddingRight()
                  } x {
                    rows() * gridHeight() + 
                    (rows() - 1) * gridGapVertical() + 
                    canvasPaddingTop() + canvasPaddingBottom()
                  }
                </p>
                <p>网格尺寸: {gridWidth()} x {gridHeight()}</p>
                <p>网格数量: {rows()} 行 x {cols()} 列 = {rows() * cols()} 个</p>
              </div>
              <button class="btn-secondary" onClick={resetCanvas}>
                重新配置
              </button>
            </div>

            <div class="section">
              <h2>画布填充</h2>
              <div class="padding-grid">
                <div class="padding-center">
                  <input
                    type="number"
                    value={canvasPaddingTop()}
                    onInput={e => setCanvasPaddingTop(parseInt(e.currentTarget.value) || 0)}
                    min="0"
                    placeholder="上"
                    title="上边距"
                  />
                </div>
                <div class="padding-left">
                  <input
                    type="number"
                    value={canvasPaddingLeft()}
                    onInput={e => setCanvasPaddingLeft(parseInt(e.currentTarget.value) || 0)}
                    min="0"
                    placeholder="左"
                    title="左边距"
                  />
                </div>
                <div class="padding-middle"></div>
                <div class="padding-right">
                  <input
                    type="number"
                    value={canvasPaddingRight()}
                    onInput={e => setCanvasPaddingRight(parseInt(e.currentTarget.value) || 0)}
                    min="0"
                    placeholder="右"
                    title="右边距"
                  />
                </div>
                <div class="padding-bottom">
                  <input
                    type="number"
                    value={canvasPaddingBottom()}
                    onInput={e => setCanvasPaddingBottom(parseInt(e.currentTarget.value) || 0)}
                    min="0"
                    placeholder="下"
                    title="下边距"
                  />
                </div>
              </div>
            </div>

            <div class="section">
              <h2>网格间隙</h2>
              <div class="input-group">
                <label>
                  水平间隙 (px):
                  <input
                    type="number"
                    value={gridGapHorizontal()}
                    onInput={e => setGridGapHorizontal(parseInt(e.currentTarget.value) || 0)}
                    min="0"
                  />
                </label>
                <label>
                  垂直间隙 (px):
                  <input
                    type="number"
                    value={gridGapVertical()}
                    onInput={e => setGridGapVertical(parseInt(e.currentTarget.value) || 0)}
                    min="0"
                  />
                </label>
              </div>
            </div>

            <div class="section">
              <h2>修改网格</h2>
              <div class="input-group">
                <label>
                  网格宽度 (px):
                  <input
                    type="number"
                    value={gridWidth()}
                    onInput={e => setGridWidth(parseInt(e.currentTarget.value) || 0)}
                    min="1"
                  />
                </label>
                <label>
                  网格高度 (px):
                  <input
                    type="number"
                    value={gridHeight()}
                    onInput={e => setGridHeight(parseInt(e.currentTarget.value) || 0)}
                    min="1"
                  />
                </label>
              </div>
              <button class="btn-primary" onClick={updateGridSize}>
                应用修改
              </button>
            </div>

            <div class="section">
              <h2>图片库</h2>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <button class="btn-primary" onClick={() => fileInputRef?.click()}>
                + 上传图片
              </button>

              <div class="image-library">
                <For each={uploadedImages()}>
                  {imageUrl => (
                    <div
                      class="image-item"
                      classList={{
                        highlighted: selectedImage() === imageUrl,
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt="Uploaded"
                        onClick={() => fillImageToSelectedCell(imageUrl)}
                      />
                      <button
                        class="remove-btn"
                        onClick={() => removeImage(imageUrl)}
                        title="删除图片"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>

            <div class="section">
              <h2>操作</h2>
              <button class="btn-success" onClick={exportSpriteSheet}>
                📥 导出雪碧图
              </button>
            </div>
          </Show>
        </div>

        {/* 右侧画布区域 */}
        <div class="canvas-area">
          <Show when={canvasCreated()}>
            <div class="canvas-wrapper">
              <div
                class="grid-overlay"
                style={{
                  padding: `${canvasPaddingTop()}px ${canvasPaddingRight()}px ${canvasPaddingBottom()}px ${canvasPaddingLeft()}px`,
                  'grid-template-columns': `repeat(${cols()}, ${gridWidth()}px)`,
                  'grid-template-rows': `repeat(${rows()}, ${gridHeight()}px)`,
                  'column-gap': `${gridGapHorizontal()}px`,
                  'row-gap': `${gridGapVertical()}px`,
                }}
              >
                <For each={gridCells()}>
                  {cell => (
                    <div
                      class="grid-cell"
                      classList={{
                        selected:
                          selectedCell()?.row === cell.row &&
                          selectedCell()?.col === cell.col,
                        filled: !!cell.imageUrl,
                      }}
                      onClick={() => selectCell(cell.row, cell.col)}
                      onDblClick={() => clearCell(cell.row, cell.col)}
                      title={`行${cell.row + 1}, 列${cell.col + 1}${cell.imageUrl ? ' (双击清空)' : ''}`}
                    >
                      {cell.imageUrl && (
                        <img src={cell.imageUrl} alt={`Cell ${cell.row}-${cell.col}`} />
                      )}
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* 隐藏的导出画布 */}
            <canvas
              ref={canvasRef}
              width={canvasWidth()}
              height={canvasHeight()}
              style={{ display: 'none' }}
            />
          </Show>

          <Show when={!canvasCreated()}>
            <div class="empty-state">
              <p>👈 请在左侧配置并创建画布</p>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

