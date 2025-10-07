import { createSignal, For, Show, onMount } from 'solid-js';
import './SpriteSheetComposer.css';
import { encodeKTX2, estimateKTX2Size, getFormatDescription, type KTX2Format } from './ktx2-encoder';

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
  
  // 导出配置
  const [exportFormat, setExportFormat] = createSignal<'png' | 'webp-high' | 'webp-compressed' | 'ktx2-uncompressed' | 'ktx2-etc1s' | 'ktx2-uastc'>('png');
  const [exportScale, setExportScale] = createSignal(1);
  const [imageSmoothingEnabled, setImageSmoothingEnabled] = createSignal(false);
  const [ktx2Quality, setKtx2Quality] = createSignal(128);
  
  // 动画播放配置
  const [selectionMode, setSelectionMode] = createSignal<'single' | 'row' | 'column' | 'multi'>('single');
  const [selectedCells, setSelectedCells] = createSignal<Set<string>>(new Set());
  const [animationFPS, setAnimationFPS] = createSignal(20);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentFrame, setCurrentFrame] = createSignal(0);
  const [selectedRow, setSelectedRow] = createSignal<number | null>(null);
  const [selectedColumn, setSelectedColumn] = createSignal<number | null>(null);
  const [playMode, setPlayMode] = createSignal<'loop' | 'once'>('loop'); // 默认循环播放
  const [showCanvas, setShowCanvas] = createSignal(false); // 控制画布显示
  
  // 动画背景配置
  const [canvasBackground, setCanvasBackground] = createSignal<'transparent' | 'white' | 'black' | 'custom'>('transparent');
  const [customBackgroundColor, setCustomBackgroundColor] = createSignal('#888888');
  const [recentColors, setRecentColors] = createSignal<string[]>(['#888888', '#666666', '#444444']);

  let canvasRef: HTMLCanvasElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;
  let imageLibraryRef: HTMLDivElement | undefined;
  let animationPreviewCanvas: HTMLCanvasElement | undefined;
  let animationFrameId: number | undefined;
  let lastFrameTime: number = 0;
  let hideCanvasTimeout: number | undefined;
  let spritesheetInputRef: HTMLInputElement | undefined;
  
  // 图片缓存：使用 ImageBitmap 而不是 blob URL
  const imageBitmapCache = new Map<string, ImageBitmap>();
  
  // 雪碧图导入配置
  const [spritesheetUrl, setSpritesheetUrl] = createSignal<string | null>(null);
  const [spritesheetRows, setSpritesheetRows] = createSignal(1);
  const [spritesheetCols, setSpritesheetCols] = createSignal(1);

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
    setSpritesheetUrl(null);
  };
  
  // 处理雪碧图上传
  const handleSpritesheetUpload = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }
    
    const url = URL.createObjectURL(file);
    setSpritesheetUrl(url);
  };
  
  // 从雪碧图创建画布并自动切分
  const createCanvasFromSpritesheet = async () => {
    const imageUrl = spritesheetUrl();
    if (!imageUrl) {
      alert('请先上传雪碧图');
      return;
    }
    
    const numRows = spritesheetRows();
    const numCols = spritesheetCols();
    
    if (numRows < 1 || numCols < 1) {
      alert('行数和列数必须大于0');
      return;
    }
    
    try {
      console.log(`开始处理雪碧图: ${numRows}行 x ${numCols}列`);
      const startTime = performance.now();
      
      // 加载图片
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      console.log(`图片加载完成: ${img.width}x${img.height}`);
      
      // ⚠️ 关键修复：使用精确的浮点数计算网格大小
      // 不能用 Math.floor，否则会丢失边缘像素！
      const exactGridW = img.width / numCols;   // 例如: 512/20 = 25.6
      const exactGridH = img.height / numRows;  // 例如: 512/20 = 25.6
      
      // 显示网格需要是整数，向上取整确保不丢失像素
      const gridW = Math.ceil(exactGridW);      // 26
      const gridH = Math.ceil(exactGridH);      // 26
      
      // ⚠️ 自动拆分模式：重置所有配置，使用最简单的布局
      // 画布大小需要容纳所有网格（可能比原图稍大）
      const canvasW = gridW * numCols;          // 26 * 20 = 520
      const canvasH = gridH * numRows;          // 26 * 20 = 520
      
      setCanvasWidth(canvasW);
      setCanvasHeight(canvasH);
      setGridWidth(gridW);
      setGridHeight(gridH);
      
      // 清零所有 padding 和 gap（自动拆分不需要这些）
      setCanvasPaddingTop(0);
      setCanvasPaddingRight(0);
      setCanvasPaddingBottom(0);
      setCanvasPaddingLeft(0);
      setGridPaddingTop(0);
      setGridPaddingRight(0);
      setGridPaddingBottom(0);
      setGridPaddingLeft(0);
      setGridGapHorizontal(0);
      setGridGapVertical(0);
      
      // 设置行列数
      setCols(numCols);
      setRows(numRows);
      setCanvasCreated(true);
      
      console.log(`画布配置: 原图${img.width}x${img.height} → 画布${canvasW}x${canvasH}, 网格${gridW}x${gridH}, ${numRows}行x${numCols}列=${numRows * numCols}个切片`);
      console.log(`精确网格尺寸: ${exactGridW.toFixed(2)}x${exactGridH.toFixed(2)} (向上取整为 ${gridW}x${gridH})`);
      
      // 批量切分所有图片（使用精确浮点数坐标，避免丢失像素）
      const slicePromises: Promise<{ row: number; col: number; url: string; bitmap: ImageBitmap }>[] = [];
      
      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
          // 每个切片使用独立的 canvas，确保并行处理安全
          const promise = (async (r: number, c: number) => {
            // ⚠️ 使用精确的浮点数坐标切分（Canvas API 支持亚像素精度）
            const srcX = c * exactGridW;  // 精确坐标，例如 25.6, 51.2, 76.8...
            const srcY = r * exactGridH;
            const srcW = exactGridW;       // 精确宽度 25.6
            const srcH = exactGridH;       // 精确高度 25.6
            
            // 为每个切片创建独立的临时 canvas（使用整数尺寸）
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = gridW;   // 向上取整的整数尺寸
            tempCanvas.height = gridH;
            const ctx = tempCanvas.getContext('2d', { 
              alpha: true,
              willReadFrequently: false
            });
            
            if (!ctx) {
              throw new Error(`无法创建切片 [${r},${c}] 的画布上下文`);
            }
            
            // ⚠️ 绘制切片：使用精确的浮点数源坐标，填充到整数目标画布
            // Canvas API 会自动处理亚像素插值
            ctx.drawImage(
              img,
              srcX, srcY, srcW, srcH,  // 源图区域（精确浮点数）
              0, 0, gridW, gridH        // 目标区域（整数）
            );
            
            // 直接从源图创建 ImageBitmap（用于高性能渲染）
            const bitmap = await createImageBitmap(
              img,
              srcX, srcY, srcW, srcH
            );
            
            // 转换为 Blob URL（用于显示和导出）
            const blob = await new Promise<Blob>((resolve, reject) => {
              tempCanvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error(`切片 [${r},${c}] 转换失败`));
              }, 'image/png');
            });
            
            const sliceUrl = URL.createObjectURL(blob);
            
            console.log(`✓ 切片 [${r},${c}] 源(${srcX.toFixed(1)},${srcY.toFixed(1)}) ${srcW.toFixed(1)}x${srcH.toFixed(1)} → 目标 ${gridW}x${gridH}`);
            
            return { row: r, col: c, url: sliceUrl, bitmap };
          })(row, col);
          
          slicePromises.push(promise);
        }
      }
      
      console.log(`🚀 开始并行切分 ${slicePromises.length} 个切片...`);
      
      // 等待所有切片完成
      const slices = await Promise.all(slicePromises);
      
      console.log(`✅ 切分完成，耗时 ${(performance.now() - startTime).toFixed(2)}ms`);
      
      // 创建一个 Map 用于快速查找切片（避免多次 find）
      const sliceMap = new Map<string, { url: string; bitmap: ImageBitmap }>();
      slices.forEach(slice => {
        const key = `${slice.row}-${slice.col}`;
        sliceMap.set(key, { url: slice.url, bitmap: slice.bitmap });
      });
      
      // 批量构建网格数据和图片库（按行列顺序）
      const newCells: GridCell[] = [];
      const newImages: string[] = [];
      
      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
          const key = `${row}-${col}`;
          const slice = sliceMap.get(key);
          
          if (slice) {
            newCells.push({ row, col, imageUrl: slice.url });
            newImages.push(slice.url);
            imageBitmapCache.set(slice.url, slice.bitmap);
          } else {
            console.warn(`⚠️ 未找到切片 [${row},${col}]`);
            newCells.push({ row, col, imageUrl: null });
          }
        }
      }
      
      console.log(`📦 构建完成: ${newCells.length} 个网格，${newImages.length} 张图片`);
      
      // 一次性更新所有状态（避免多次渲染）
      setGridCells(newCells);
      setUploadedImages(prev => [...prev, ...newImages]);
      
      const endTime = performance.now();
      const totalTime = (endTime - startTime).toFixed(2);
      
      console.log(`✅ 雪碧图处理完成！总耗时: ${totalTime}ms`);
      alert(`成功导入雪碧图！\n切分为 ${numRows} x ${numCols} = ${numRows * numCols} 张图片\n耗时: ${totalTime}ms`);
      
      // 清空状态
      setSpritesheetUrl(null);
      if (spritesheetInputRef) {
        spritesheetInputRef.value = '';
      }
      
    } catch (error) {
      console.error('雪碧图导入失败:', error);
      alert(`雪碧图导入失败: ${error}`);
    }
  };

  // 上传图片并预加载为 ImageBitmap
  const handleImageUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files) return;

    const files = Array.from(input.files);
    const imageUrls: string[] = [];

    // 异步加载所有图片并创建 ImageBitmap
    const loadPromises = files.map(async (file) => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        imageUrls.push(url);
        
        // 预加载为 ImageBitmap（高性能）
        try {
          const bitmap = await createImageBitmap(file);
          imageBitmapCache.set(url, bitmap);
        } catch (error) {
          console.error('创建 ImageBitmap 失败:', error);
        }
      }
    });

    await Promise.all(loadPromises);
    setUploadedImages(prev => [...prev, ...imageUrls]);
    console.log(`已上传 ${imageUrls.length} 张图片（已预加载为 ImageBitmap）`);
  };

  // 滚动图片库到指定图片
  const scrollToImage = (imageUrl: string) => {
    if (!imageLibraryRef) return;
    
    const images = uploadedImages();
    const index = images.indexOf(imageUrl);
    if (index === -1) return;
    
    // 找到对应的图片元素并滚动到可视区域
    const imageElements = imageLibraryRef.querySelectorAll('.image-item');
    const targetElement = imageElements[index] as HTMLElement;
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // 选中网格
  const selectCell = (row: number, col: number, isMultiSelect = false) => {
    const mode = selectionMode();
    
    if (mode === 'single') {
      setSelectedCell({ row, col });
      setSelectedRow(null);
      setSelectedColumn(null);
      setSelectedCells(new Set<string>());
      
      // 如果网格已填充，高亮对应的图片并滚动到可视区域
      const cell = gridCells().find(c => c.row === row && c.col === col);
      if (cell?.imageUrl) {
        setSelectedImage(cell.imageUrl);
        scrollToImage(cell.imageUrl);
      } else {
        setSelectedImage(null);
      }
    } else if (mode === 'row') {
      setSelectedRow(row);
      setSelectedColumn(null);
      setSelectedCell(null);
      setSelectedCells(new Set<string>());
    } else if (mode === 'column') {
      setSelectedColumn(col);
      setSelectedRow(null);
      setSelectedCell(null);
      setSelectedCells(new Set<string>());
    } else if (mode === 'multi') {
      const cellKey = `${row}-${col}`;
      const newSelected = new Set(selectedCells());
      
      if (isMultiSelect) {
        if (newSelected.has(cellKey)) {
          newSelected.delete(cellKey);
        } else {
          newSelected.add(cellKey);
        }
      } else {
        newSelected.clear();
        newSelected.add(cellKey);
      }
      
      setSelectedCells(newSelected);
      setSelectedCell(null);
      setSelectedRow(null);
      setSelectedColumn(null);
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

  // 导出为光栅格式（PNG/WebP）
  const exportAsRaster = (
    canvas: HTMLCanvasElement,
    format: string,
    scale: number,
    scaledWidth: number,
    scaledHeight: number
  ) => {
    let mimeType: string;
    let quality: number | undefined;
    let extension: string;

    switch (format) {
      case 'png':
        mimeType = 'image/png';
        quality = undefined;
        extension = 'png';
        break;
      case 'webp-high':
        mimeType = 'image/webp';
        quality = 1.0;
        extension = 'webp';
        break;
      case 'webp-compressed':
        mimeType = 'image/webp';
        quality = 0.82; // 压缩模式（更小的文件）
        extension = 'webp';
        break;
      default:
        mimeType = 'image/png';
        extension = 'png';
    }

    canvas.toBlob(
      blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const scaleStr = scale > 1 ? `_${scale}x` : '';
          a.download = `spritesheet${scaleStr}_${Date.now()}.${extension}`;
          a.click();
          URL.revokeObjectURL(url);
          
          const sizeKB = (blob.size / 1024).toFixed(2);
          console.log(`雪碧图已导出: ${extension.toUpperCase()}, ${scaledWidth}x${scaledHeight}, ${sizeKB}KB`);
          alert(`导出成功！\n格式: ${extension.toUpperCase()}\n尺寸: ${scaledWidth}x${scaledHeight}\n大小: ${sizeKB}KB`);
        }
      },
      mimeType,
      quality
    );
  };

  // 导出为 KTX2 格式
  const exportAsKTX2 = async (
    canvas: HTMLCanvasElement,
    format: string,
    scale: number,
    scaledWidth: number,
    scaledHeight: number
  ) => {
    try {
      let ktx2Format: KTX2Format;
      
      switch (format) {
        case 'ktx2-uncompressed':
          ktx2Format = 'uncompressed';
          break;
        case 'ktx2-etc1s':
          ktx2Format = 'etc1s';
          break;
        case 'ktx2-uastc':
          ktx2Format = 'uastc';
          break;
        default:
          ktx2Format = 'uncompressed';
      }

      // 编码为 KTX2
      const ktx2Data = await encodeKTX2(canvas, {
        format: ktx2Format,
        quality: ktx2Quality(),
      });

      // 下载文件
      const blob = new Blob([ktx2Data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const scaleStr = scale > 1 ? `_${scale}x` : '';
      a.download = `spritesheet${scaleStr}_${Date.now()}.ktx2`;
      a.click();
      URL.revokeObjectURL(url);
      
      const sizeKB = (blob.size / 1024).toFixed(2);
      const compressionRatio = ((1 - blob.size / (scaledWidth * scaledHeight * 4)) * 100).toFixed(1);
      console.log(`KTX2 已导出: ${ktx2Format}, ${scaledWidth}x${scaledHeight}, ${sizeKB}KB, 压缩率: ${compressionRatio}%`);
      alert(`导出成功！\n格式: KTX2 (${ktx2Format})\n尺寸: ${scaledWidth}x${scaledHeight}\n大小: ${sizeKB}KB\n压缩率: ${compressionRatio}%`);
    } catch (error) {
      console.error('KTX2 编码失败:', error);
      alert(`KTX2 导出失败: ${error}`);
    }
  };

  // 导出雪碧图
  const exportSpriteSheet = () => {
    if (!canvasRef) return;

    const cells = gridCells();
    const totalImages = cells.filter(cell => cell.imageUrl).length;

    if (totalImages === 0) {
      alert('请先添加图片');
      return;
    }

    // 获取导出配置
    const scale = exportScale();
    const format = exportFormat();
    const smoothing = imageSmoothingEnabled();

    // 创建缩放后的画布
    const scaledWidth = canvasWidth() * scale;
    const scaledHeight = canvasHeight() * scale;
    
    // 更新画布尺寸
    canvasRef.width = scaledWidth;
    canvasRef.height = scaledHeight;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    // 配置图像平滑
    ctx.imageSmoothingEnabled = smoothing;
    if (!smoothing) {
      // 对于像素风格图片，禁用平滑可以保持清晰度
      ctx.imageSmoothingQuality = 'low';
    } else {
      ctx.imageSmoothingQuality = 'high';
    }

    // 清空画布
    ctx.clearRect(0, 0, scaledWidth, scaledHeight);

    // 绘制所有图片
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

    cells.forEach(cell => {
      if (cell.imageUrl) {
        const img = new Image();
        img.onload = () => {
          // 计算绘制位置和尺寸（考虑padding、gap和缩放）
          const x = (cPaddingLeft + cell.col * (gWidth + gapH) + gPaddingLeft) * scale;
          const y = (cPaddingTop + cell.row * (gHeight + gapV) + gPaddingTop) * scale;
          const w = (gWidth - gPaddingLeft - gPaddingRight) * scale;
          const h = (gHeight - gPaddingTop - gPaddingBottom) * scale;
          
          ctx.drawImage(img, x, y, w, h);
          loadedCount++;

          // 所有图片加载完成后导出
          if (loadedCount === totalImages) {
            // 判断是否为 KTX2 格式
            if (format.startsWith('ktx2-')) {
              exportAsKTX2(canvasRef!, format, scale, scaledWidth, scaledHeight);
            } else {
              exportAsRaster(canvasRef!, format, scale, scaledWidth, scaledHeight);
            }
          }
        };
        img.src = cell.imageUrl;
      }
    });
  };

  // 移除图片
  const removeImage = (imageUrl: string) => {
    setUploadedImages(imgs => imgs.filter(img => img !== imageUrl));
    
    // 清理 ImageBitmap 缓存
    const bitmap = imageBitmapCache.get(imageUrl);
    if (bitmap) {
      bitmap.close(); // 释放 GPU 内存
      imageBitmapCache.delete(imageUrl);
    }
    
    URL.revokeObjectURL(imageUrl);
  };
  
  // 添加颜色到最近使用列表
  const addToRecentColors = (color: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      return [color, ...filtered].slice(0, 5); // 保留最近5个
    });
  };
  
  // 绘制透明方格背景
  const drawCheckerboard = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const squareSize = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#cccccc';
    for (let y = 0; y < height; y += squareSize) {
      for (let x = 0; x < width; x += squareSize) {
        if ((x / squareSize + y / squareSize) % 2 === 0) {
          ctx.fillRect(x, y, squareSize, squareSize);
        }
      }
    }
  };
  
  // 使用 Canvas 绘制动画帧
  const drawAnimationFrame = (frameIndex: number) => {
    if (!animationPreviewCanvas) return;
    
    const frames = getSelectedFrames();
    if (frameIndex >= frames.length) return;
    
    const frame = frames[frameIndex];
    if (!frame?.imageUrl) return;
    
    const bitmap = imageBitmapCache.get(frame.imageUrl);
    if (!bitmap) return;
    
    const ctx = animationPreviewCanvas.getContext('2d');
    if (!ctx) return;
    
    // 设置画布大小适配图片
    const maxSize = 200;
    const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height);
    const displayWidth = bitmap.width * scale;
    const displayHeight = bitmap.height * scale;
    
    animationPreviewCanvas.width = displayWidth;
    animationPreviewCanvas.height = displayHeight;
    
    // 绘制背景
    const bgType = canvasBackground();
    switch (bgType) {
      case 'transparent':
        drawCheckerboard(ctx, displayWidth, displayHeight);
        break;
      case 'white':
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, displayWidth, displayHeight);
        break;
      case 'black':
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, displayWidth, displayHeight);
        break;
      case 'custom':
        ctx.fillStyle = customBackgroundColor();
        ctx.fillRect(0, 0, displayWidth, displayHeight);
        break;
    }
    
    // 禁用图像平滑以保持像素风格
    ctx.imageSmoothingEnabled = false;
    
    // 绘制 ImageBitmap（高性能）
    ctx.drawImage(bitmap, 0, 0, displayWidth, displayHeight);
  };

  // 清空网格（仅在双击已填充的网格时）
  const clearCell = (row: number, col: number) => {
    const cell = gridCells().find(c => c.row === row && c.col === col);
    // 只有已填充的网格才能清空
    if (!cell?.imageUrl) return;
    
    // 创建新数组确保触发响应式更新
    setGridCells(cells => 
      cells.map(c => 
        c.row === row && c.col === col
          ? { row: c.row, col: c.col, imageUrl: null } // 创建新对象
          : c
      )
    );
    
    console.log(`已清空网格 [${row}, ${col}]`);
  };
  
  // 获取当前选中的帧序列
  const getSelectedFrames = (): GridCell[] => {
    const cells = gridCells();
    const mode = selectionMode();
    
    if (mode === 'row') {
      const row = selectedRow();
      if (row === null) return [];
      return cells
        .filter(cell => cell.row === row && cell.imageUrl)
        .sort((a, b) => a.col - b.col);
    } else if (mode === 'column') {
      const col = selectedColumn();
      if (col === null) return [];
      return cells
        .filter(cell => cell.col === col && cell.imageUrl)
        .sort((a, b) => a.row - b.row);
    } else if (mode === 'multi') {
      const selected = selectedCells();
      return cells.filter(cell => 
        selected.has(`${cell.row}-${cell.col}`) && cell.imageUrl
      );
    }
    
    return [];
  };
  
  // 播放/暂停动画
  const toggleAnimation = () => {
    if (isPlaying()) {
      pauseAnimation();
    } else {
      startAnimation();
    }
  };
  
  // 开始播放动画（使用 requestAnimationFrame）
  const startAnimation = () => {
    const frames = getSelectedFrames();
    if (frames.length === 0) {
      alert('请先选择要播放的帧（行、列或多选网格）');
      return;
    }
    
    // 清除之前的延迟隐藏定时器（如果有）
    if (hideCanvasTimeout !== undefined) {
      clearTimeout(hideCanvasTimeout);
      hideCanvasTimeout = undefined;
    }
    
    setIsPlaying(true);
    setShowCanvas(true); // 显示画布
    setCurrentFrame(0);
    lastFrameTime = performance.now();
    
    // 立即绘制第一帧
    drawAnimationFrame(0);
    
    const animate = (currentTime: number) => {
      if (!isPlaying()) return;
      
      const fps = animationFPS();
      const frameDuration = 1000 / fps; // 每帧持续时间（毫秒）
      const elapsed = currentTime - lastFrameTime;
      
      // 当经过的时间超过一帧的持续时间时，切换到下一帧
      if (elapsed >= frameDuration) {
        const totalFrames = getSelectedFrames().length;
        const currentFrameIndex = currentFrame();
        const nextFrameIndex = currentFrameIndex + 1;
        
        // 检查播放模式
        if (playMode() === 'once' && nextFrameIndex >= totalFrames) {
          // 单次播放模式：播放到最后一帧后停止
          setCurrentFrame(totalFrames - 1);
          drawAnimationFrame(totalFrames - 1);
          stopAnimation();
          console.log('动画播放完成（单次模式），3秒后隐藏画布');
          
          // 延迟3秒后隐藏画布
          hideCanvasTimeout = window.setTimeout(() => {
            setShowCanvas(false);
            console.log('动画画布已隐藏');
          }, 3000);
          
          return;
        }
        
        // 循环模式或未到达最后一帧
        const newFrameIndex = nextFrameIndex % totalFrames;
        setCurrentFrame(newFrameIndex);
        
        // 使用 Canvas 绘制帧（高性能）
        drawAnimationFrame(newFrameIndex);
        
        lastFrameTime = currentTime - (elapsed % frameDuration); // 保持精确的帧率
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
  };
  
  // 停止播放动画
  const stopAnimation = () => {
    setIsPlaying(false);
    if (animationFrameId !== undefined) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = undefined;
    }
    // 清除延迟隐藏的定时器
    if (hideCanvasTimeout !== undefined) {
      clearTimeout(hideCanvasTimeout);
      hideCanvasTimeout = undefined;
    }
  };
  
  // 手动暂停（立即隐藏画布）
  const pauseAnimation = () => {
    stopAnimation();
    setShowCanvas(false);
  };
  
  // 清理资源
  onMount(() => {
    return () => {
      stopAnimation();
      
      // 清理所有 ImageBitmap 缓存
      imageBitmapCache.forEach(bitmap => bitmap.close());
      imageBitmapCache.clear();
    };
  });

  return (
    <div class="sprite-composer-container">
      <h1>🎨 雪碧图合成工具</h1>

      <div class="composer-content">
        {/* 左侧配置面板 */}
        <div class="config-panel">
          <Show when={!canvasCreated()}>
            <div class="section">
              <h2>🎯 自动拆分模式</h2>
              <div class="info-box" style="font-size: 12px; margin-bottom: 12px;">
                <p><strong>💡 使用说明:</strong></p>
                <p>1. 上传一张完整的雪碧图（如 512x512）</p>
                <p>2. 输入行数和列数（如 20x20 = 400个切片）</p>
                <p>3. 点击"自动切分"按钮</p>
                <p>4. 系统会精确切分，不丢失任何像素</p>
                <p style="margin-top: 8px; color: #10b981;"><strong>✅ 智能切分:</strong> 支持非整数网格（如 512÷20=25.6），自动处理亚像素精度</p>
                <p style="margin-top: 4px; color: #f59e0b;"><strong>⚠️ 注意:</strong> 自动拆分会清零所有 padding 和 gap 配置</p>
              </div>
              
              <input
                ref={spritesheetInputRef}
                type="file"
                accept="image/*"
                onChange={handleSpritesheetUpload}
                style={{ display: 'none' }}
              />
              
              <button 
                class="btn-secondary" 
                onClick={() => spritesheetInputRef?.click()}
                style="margin-bottom: 12px; width: 100%;"
              >
                📁 上传雪碧图
              </button>
              
              <Show when={spritesheetUrl()}>
                <div style="margin-bottom: 12px;">
                  <img 
                    src={spritesheetUrl()!} 
                    alt="雪碧图预览" 
                    style="max-width: 100%; border: 2px solid #4CAF50; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
                  />
                </div>
                
                <div class="input-group" style="margin-bottom: 12px;">
                  <label>
                    行数:
                    <input
                      type="number"
                      value={spritesheetRows()}
                      onInput={e => setSpritesheetRows(parseInt(e.currentTarget.value) || 1)}
                      min="1"
                    />
                  </label>
                  <label>
                    列数:
                    <input
                      type="number"
                      value={spritesheetCols()}
                      onInput={e => setSpritesheetCols(parseInt(e.currentTarget.value) || 1)}
                      min="1"
                    />
                  </label>
                </div>
                
                <button 
                  class="btn-success" 
                  onClick={createCanvasFromSpritesheet}
                  style="width: 100%; font-weight: bold;"
                >
                  ✂️ 自动切分并创建画布
                </button>
                
                <div style="border-top: 2px dashed #ccc; margin: 20px 0;"></div>
              </Show>
            </div>
          
            <div class="section">
              <h2>🎨 手动配置</h2>
              <h3 style="font-size: 14px; color: #666; margin-top: 0;">画布配置</h3>
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

              <div class="image-library" ref={imageLibraryRef}>
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
              <h2>🎬 动画预览</h2>
              
              <div class="input-group">
                <label>
                  选择模式:
                  <select
                    value={selectionMode()}
                    onChange={e => {
                      const newMode = e.currentTarget.value as any;
                      setSelectionMode(newMode);
                      stopAnimation();
                      setSelectedRow(null);
                      setSelectedColumn(null);
                      setSelectedCells(new Set<string>());
                    }}
                  >
                    <option value="single">单选模式（编辑）</option>
                    <option value="row">行选模式（播放）</option>
                    <option value="column">列选模式（播放）</option>
                    <option value="multi">多选模式（播放）</option>
                  </select>
                </label>
              </div>

              <Show when={selectionMode() !== 'single'}>
                <div class="input-group">
                  <label>
                    帧率 (FPS):
                    <input
                      type="number"
                      value={animationFPS()}
                      onInput={e => {
                        const fps = parseInt(e.currentTarget.value) || 1;
                        setAnimationFPS(Math.max(1, Math.min(60, fps)));
                        if (isPlaying()) {
                          stopAnimation();
                          startAnimation();
                        }
                      }}
                      min="1"
                      max="60"
                    />
                  </label>
                </div>

                <div class="input-group">
                  <label>
                    播放模式:
                    <select
                      value={playMode()}
                      onChange={e => setPlayMode(e.currentTarget.value as any)}
                    >
                      <option value="loop">🔁 循环播放（默认）</option>
                      <option value="once">▶️ 播放一次</option>
                    </select>
                  </label>
                </div>

                <div class="input-group">
                  <label>画布背景:</label>
                  <div class="background-selector">
                    <button
                      class="bg-option"
                      classList={{ active: canvasBackground() === 'transparent' }}
                      onClick={() => setCanvasBackground('transparent')}
                      title="透明方格"
                    >
                      <div class="bg-preview checkerboard"></div>
                    </button>
                    <button
                      class="bg-option"
                      classList={{ active: canvasBackground() === 'white' }}
                      onClick={() => setCanvasBackground('white')}
                      title="纯白色"
                    >
                      <div class="bg-preview" style="background: white;"></div>
                    </button>
                    <button
                      class="bg-option"
                      classList={{ active: canvasBackground() === 'black' }}
                      onClick={() => setCanvasBackground('black')}
                      title="纯黑色"
                    >
                      <div class="bg-preview" style="background: black;"></div>
                    </button>
                    <button
                      class="bg-option"
                      classList={{ active: canvasBackground() === 'custom' }}
                      onClick={() => setCanvasBackground('custom')}
                      title="自定义颜色"
                    >
                      <div class="bg-preview" style={`background: ${customBackgroundColor()};`}></div>
                    </button>
                  </div>
                </div>

                <Show when={canvasBackground() === 'custom'}>
                  <div class="input-group">
                    <label>
                      自定义颜色:
                      <div class="color-picker-wrapper">
                        <input
                          type="color"
                          value={customBackgroundColor()}
                          onInput={e => {
                            const color = e.currentTarget.value;
                            setCustomBackgroundColor(color);
                            addToRecentColors(color);
                          }}
                        />
                        <input
                          type="text"
                          value={customBackgroundColor()}
                          onInput={e => {
                            const color = e.currentTarget.value;
                            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                              setCustomBackgroundColor(color);
                              addToRecentColors(color);
                            }
                          }}
                          placeholder="#888888"
                          class="color-input"
                        />
                      </div>
                    </label>
                    <Show when={recentColors().length > 0}>
                      <div class="recent-colors">
                        <span>最近使用:</span>
                        <For each={recentColors()}>
                          {color => (
                            <button
                              class="recent-color-btn"
                              style={`background: ${color};`}
                              onClick={() => setCustomBackgroundColor(color)}
                              title={color}
                            />
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>

                <div class="animation-controls">
                  <button
                    class={isPlaying() ? "btn-warning" : "btn-success"}
                    onClick={toggleAnimation}
                  >
                    {isPlaying() ? '⏸ 暂停' : '▶️ 播放'}
                  </button>
                  <Show when={isPlaying()}>
                    <div class="frame-info">
                      帧: {currentFrame() + 1} / {getSelectedFrames().length}
                    </div>
                  </Show>
                </div>

                <Show when={getSelectedFrames().length > 0 && showCanvas()}>
                  <div class="animation-preview">
                    <canvas
                      ref={animationPreviewCanvas}
                      style="image-rendering: pixelated; image-rendering: crisp-edges;"
                    />
                  </div>
                </Show>

                <div class="info-box" style="font-size: 12px; margin-top: 8px;">
                  <p><strong>📖 使用说明:</strong></p>
                  <p>• <strong>行选模式</strong>: 点击任意网格 → 整行绿色高亮 🟢</p>
                  <p>• <strong>列选模式</strong>: 点击任意网格 → 整列绿色高亮 🟢</p>
                  <p>• <strong>多选模式</strong>:</p>
                  <p style="margin-left: 16px;">- Mac: ⌘ Command + 点击选中/取消</p>
                  <p style="margin-left: 16px;">- Win: Ctrl + 点击选中/取消</p>
                  <p style="margin-left: 16px;">- 已选网格显示绿色边框 🟢</p>
                  <p>• <strong>播放模式</strong>: 循环播放 🔁 或播放一次 ▶️</p>
                  <p>• <strong>背景</strong>: 选择合适的背景查看透明区域</p>
                </div>

                <Show when={selectionMode() === 'row' && selectedRow() !== null}>
                  <div class="selection-info">
                    ✅ 已选中: 第 {selectedRow()! + 1} 行
                  </div>
                </Show>
                
                <Show when={selectionMode() === 'column' && selectedColumn() !== null}>
                  <div class="selection-info">
                    ✅ 已选中: 第 {selectedColumn()! + 1} 列
                  </div>
                </Show>
                
                <Show when={selectionMode() === 'multi' && selectedCells().size > 0}>
                  <div class="selection-info">
                    ✅ 已选中: {selectedCells().size} 个网格
                  </div>
                </Show>
              </Show>
            </div>

            <div class="section">
              <h2>导出配置</h2>
              
              <div class="input-group">
                <label>
                  导出格式:
                  <select
                    value={exportFormat()}
                    onChange={e => setExportFormat(e.currentTarget.value as any)}
                  >
                    <optgroup label="光栅格式">
                      <option value="png">PNG (无损)</option>
                      <option value="webp-high">WebP (高质量)</option>
                      <option value="webp-compressed">WebP (压缩)</option>
                    </optgroup>
                    <optgroup label="KTX2 纹理格式">
                      <option value="ktx2-uncompressed">KTX2 未压缩 (最大质量)</option>
                      <option value="ktx2-etc1s">KTX2 ETC1S (最小体积)</option>
                      <option value="ktx2-uastc">KTX2 UASTC (高质量)</option>
                    </optgroup>
                  </select>
                </label>
              </div>

              <Show when={exportFormat().startsWith('ktx2-')}>
                <div class="input-group">
                  <label>
                    KTX2 质量 (0-255):
                    <input
                      type="range"
                      value={ktx2Quality()}
                      onInput={e => setKtx2Quality(parseInt(e.currentTarget.value))}
                      min="0"
                      max="255"
                      step="1"
                    />
                    <span class="quality-value">{ktx2Quality()}</span>
                  </label>
                </div>
                
                <div class="info-box" style="font-size: 11px; margin-top: 8px;">
                  <p><strong>💾 KTX2 说明:</strong></p>
                  <p>• <strong>未压缩</strong>: 无损，GPU 直接使用，最快加载</p>
                  <p>• <strong>ETC1S</strong>: 模拟压缩，体积最小（~25%）</p>
                  <p>• <strong>UASTC</strong>: 高质量，适合桌面端</p>
                  <p style="margin-top: 6px;">
                    <strong>预估大小:</strong> {(estimateKTX2Size(
                      canvasWidth() * exportScale(),
                      canvasHeight() * exportScale(),
                      exportFormat().replace('ktx2-', '') as KTX2Format
                    ) / 1024).toFixed(2)}KB
                  </p>
                </div>
              </Show>

              <div class="input-group">
                <label>
                  缩放倍数:
                  <select
                    value={exportScale()}
                    onChange={e => setExportScale(parseInt(e.currentTarget.value))}
                  >
                    <option value="1">1x (原始尺寸)</option>
                    <option value="2">2x (放大2倍)</option>
                    <option value="3">3x (放大3倍)</option>
                    <option value="4">4x (放大4倍)</option>
                  </select>
                </label>
              </div>

              <div class="input-group">
                <label style="display: flex; align-items: center; gap: 8px;">
                  <input
                    type="checkbox"
                    checked={imageSmoothingEnabled()}
                    onChange={e => setImageSmoothingEnabled(e.currentTarget.checked)}
                  />
                  启用图像平滑 (像素图建议关闭)
                </label>
              </div>

              <div class="info-box" style="font-size: 12px; margin-top: 8px;">
                <p><strong>格式说明:</strong></p>
                <p>• PNG: 无损压缩，文件较大，保证最高质量</p>
                <p>• WebP高质量: 接近无损，文件适中</p>
                <p>• WebP压缩: 有损压缩，文件最小</p>
                <p style="margin-top: 8px;"><strong>导出尺寸:</strong> {canvasWidth() * exportScale()}x{canvasHeight() * exportScale()}</p>
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
                  {(cell, index) => {
                    // 使用 memo 创建响应式计算，确保 cell 数据变化时重新渲染
                    const currentCell = () => gridCells()[index()];
                    const isSingleSelected = () => selectedCell()?.row === cell.row && selectedCell()?.col === cell.col;
                    const isRowSelected = () => selectedRow() === cell.row;
                    const isColumnSelected = () => selectedColumn() === cell.col;
                    const isMultiSelected = () => selectedCells().has(`${cell.row}-${cell.col}`);
                    const isSelected = () => isSingleSelected() || isRowSelected() || isColumnSelected() || isMultiSelected();
                    
                    return (
                      <div
                        class="grid-cell"
                        classList={{
                          selected: isSelected(),
                          'row-selected': isRowSelected(),
                          'column-selected': isColumnSelected(),
                          'multi-selected': isMultiSelected(),
                          filled: !!currentCell().imageUrl,
                        }}
                        onClick={(e) => selectCell(cell.row, cell.col, e.ctrlKey || e.metaKey)}
                        onDblClick={() => clearCell(cell.row, cell.col)}
                        title={`行${cell.row + 1}, 列${cell.col + 1}${currentCell().imageUrl ? ' (双击清空)' : ''}`}
                      >
                        <Show when={currentCell().imageUrl}>
                          <img src={currentCell().imageUrl!} alt={`Cell ${cell.row}-${cell.col}`} />
                        </Show>
                      </div>
                    );
                  }}
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

