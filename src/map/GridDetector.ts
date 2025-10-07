/**
 * 网格检测器
 * 自动识别图片中的瓦片网格（类似于 Godot 的实现）
 */

export interface GridDetectionResult {
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  spacing: number;
  margin: number;
  confidence: number; // 检测置信度 0-1
}

export class GridDetector {
  /**
   * 自动检测图片中的网格
   */
  static async detectGrid(imageUrl: string): Promise<GridDetectionResult | null> {
    const img = await this.loadImage(imageUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    
    // 尝试多种常见的瓦片大小
    const commonTileSizes = [8, 16, 24, 32, 48, 64, 128];
    const results: GridDetectionResult[] = [];

    for (const tileSize of commonTileSizes) {
      // 检测水平和垂直方向的间距
      const horizontalSpacing = this.detectSpacing(imageData, tileSize, 'horizontal');
      const verticalSpacing = this.detectSpacing(imageData, tileSize, 'vertical');
      
      // 检测边距
      const margin = this.detectMargin(imageData, tileSize);
      
      const spacing = Math.max(horizontalSpacing, verticalSpacing);
      const columns = Math.floor((img.width - 2 * margin + spacing) / (tileSize + spacing));
      const rows = Math.floor((img.height - 2 * margin + spacing) / (tileSize + spacing));
      
      if (columns > 0 && rows > 0) {
        const confidence = this.calculateConfidence(imageData, tileSize, tileSize, spacing, margin, columns, rows);
        
        results.push({
          tileWidth: tileSize,
          tileHeight: tileSize,
          columns,
          rows,
          spacing,
          margin,
          confidence,
        });
      }
    }

    // 返回置信度最高的结果
    if (results.length === 0) {
      // 如果没有检测到，返回默认配置
      return {
        tileWidth: 32,
        tileHeight: 32,
        columns: Math.floor(img.width / 32),
        rows: Math.floor(img.height / 32),
        spacing: 0,
        margin: 0,
        confidence: 0.5,
      };
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results[0];
  }

  /**
   * 手动设置网格参数
   */
  static manualGrid(
    imageWidth: number,
    imageHeight: number,
    tileWidth: number,
    tileHeight: number,
    spacing: number = 0,
    margin: number = 0
  ): GridDetectionResult {
    const columns = Math.floor((imageWidth - 2 * margin + spacing) / (tileWidth + spacing));
    const rows = Math.floor((imageHeight - 2 * margin + spacing) / (tileHeight + spacing));

    return {
      tileWidth,
      tileHeight,
      columns,
      rows,
      spacing,
      margin,
      confidence: 1.0,
    };
  }

  /**
   * 检测间距
   */
  private static detectSpacing(imageData: ImageData, tileSize: number, direction: 'horizontal' | 'vertical'): number {
    const maxSpacing = 10;
    const spacingScores: number[] = [];

    for (let spacing = 0; spacing <= maxSpacing; spacing++) {
      let score = 0;
      const samples = 10; // 采样数量

      for (let i = 0; i < samples; i++) {
        if (direction === 'horizontal') {
          const x = (tileSize + spacing) * (i + 1) - spacing;
          if (x < imageData.width) {
            score += this.isLineDifferent(imageData, x, 'vertical');
          }
        } else {
          const y = (tileSize + spacing) * (i + 1) - spacing;
          if (y < imageData.height) {
            score += this.isLineDifferent(imageData, y, 'horizontal');
          }
        }
      }

      spacingScores.push(score);
    }

    // 找到得分最高的间距
    let maxScore = 0;
    let bestSpacing = 0;
    for (let i = 0; i < spacingScores.length; i++) {
      if (spacingScores[i] > maxScore) {
        maxScore = spacingScores[i];
        bestSpacing = i;
      }
    }

    return bestSpacing;
  }

  /**
   * 检测边距
   */
  private static detectMargin(imageData: ImageData, tileSize: number): number {
    const maxMargin = 20;
    
    for (let margin = 0; margin <= maxMargin; margin++) {
      // 检查从边距开始是否有规律的瓦片排列
      const columns = Math.floor((imageData.width - 2 * margin) / tileSize);
      if (columns > 0) {
        // 简单检查：边距处是否有明显的边界
        const leftEdge = this.getAverageColor(imageData, margin, 0, 1, imageData.height);
        const rightEdge = this.getAverageColor(imageData, imageData.width - margin - 1, 0, 1, imageData.height);
        
        // 如果边缘颜色相似，可能是边距
        const diff = this.colorDifference(leftEdge, rightEdge);
        if (diff < 30 && margin > 0) {
          return margin;
        }
      }
    }

    return 0;
  }

  /**
   * 计算检测置信度
   */
  private static calculateConfidence(
    imageData: ImageData,
    tileWidth: number,
    tileHeight: number,
    spacing: number,
    margin: number,
    columns: number,
    rows: number
  ): number {
    let totalSamples = 0;
    let matchingSamples = 0;

    // 采样检查瓦片边界
    const sampleCount = Math.min(10, columns * rows);
    
    for (let i = 0; i < sampleCount; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      
      const x = margin + col * (tileWidth + spacing);
      const y = margin + row * (tileHeight + spacing);
      
      // 检查瓦片边界是否清晰
      if (x + tileWidth < imageData.width && y + tileHeight < imageData.height) {
        totalSamples++;
        
        // 检查右边界
        if (x + tileWidth + spacing < imageData.width) {
          const tileBorder = this.getAverageColor(imageData, x + tileWidth - 1, y, 1, tileHeight);
          const nextTile = this.getAverageColor(imageData, x + tileWidth + spacing, y, 1, tileHeight);
          const diff = this.colorDifference(tileBorder, nextTile);
          if (diff > 20 || spacing > 0) {
            matchingSamples++;
          }
        }
      }
    }

    const baseConfidence = totalSamples > 0 ? matchingSamples / totalSamples : 0;
    
    // 调整置信度基于瓦片数量的合理性
    const tileCoverage = (columns * rows * tileWidth * tileHeight) / (imageData.width * imageData.height);
    const coverageBonus = Math.abs(tileCoverage - 1.0) < 0.2 ? 0.2 : 0;
    
    return Math.min(1.0, baseConfidence + coverageBonus);
  }

  /**
   * 检查一条线是否与周围不同（用于检测分隔线）
   */
  private static isLineDifferent(imageData: ImageData, position: number, direction: 'horizontal' | 'vertical'): number {
    let diffSum = 0;
    const samples = direction === 'horizontal' ? imageData.width : imageData.height;
    const sampleStep = Math.max(1, Math.floor(samples / 100)); // 采样100个点

    for (let i = 0; i < samples; i += sampleStep) {
      const x = direction === 'horizontal' ? i : position;
      const y = direction === 'horizontal' ? position : i;
      
      if (x >= imageData.width || y >= imageData.height) continue;
      
      // 比较当前像素与前后像素的差异
      const current = this.getPixelColor(imageData, x, y);
      
      if (direction === 'horizontal' && y > 0 && y < imageData.height - 1) {
        const prev = this.getPixelColor(imageData, x, y - 1);
        const next = this.getPixelColor(imageData, x, y + 1);
        diffSum += this.colorDifference(current, prev);
        diffSum += this.colorDifference(current, next);
      } else if (direction === 'vertical' && x > 0 && x < imageData.width - 1) {
        const prev = this.getPixelColor(imageData, x - 1, y);
        const next = this.getPixelColor(imageData, x + 1, y);
        diffSum += this.colorDifference(current, prev);
        diffSum += this.colorDifference(current, next);
      }
    }

    return diffSum;
  }

  /**
   * 获取区域平均颜色
   */
  private static getAverageColor(
    imageData: ImageData,
    x: number,
    y: number,
    width: number,
    height: number
  ): { r: number; g: number; b: number; a: number } {
    let r = 0, g = 0, b = 0, a = 0, count = 0;

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
          const color = this.getPixelColor(imageData, px, py);
          r += color.r;
          g += color.g;
          b += color.b;
          a += color.a;
          count++;
        }
      }
    }

    return {
      r: r / count,
      g: g / count,
      b: b / count,
      a: a / count,
    };
  }

  /**
   * 获取像素颜色
   */
  private static getPixelColor(
    imageData: ImageData,
    x: number,
    y: number
  ): { r: number; g: number; b: number; a: number } {
    const index = (y * imageData.width + x) * 4;
    return {
      r: imageData.data[index],
      g: imageData.data[index + 1],
      b: imageData.data[index + 2],
      a: imageData.data[index + 3],
    };
  }

  /**
   * 计算颜色差异
   */
  private static colorDifference(
    c1: { r: number; g: number; b: number; a: number },
    c2: { r: number; g: number; b: number; a: number }
  ): number {
    return Math.sqrt(
      Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2) +
      Math.pow(c1.a - c2.a, 2)
    );
  }

  /**
   * 加载图片
   */
  private static loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }
}

