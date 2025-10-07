/**
 * 测试瓦片集生成器
 * 用于快速生成测试用的瓦片集图片
 */

/**
 * 生成简单的测试瓦片集
 */
export class TestTileSetGenerator {
  /**
   * 生成彩色网格瓦片集
   */
  static generateColorGrid(
    columns: number = 8,
    rows: number = 8,
    tileSize: number = 32,
    spacing: number = 0,
    margin: number = 0
  ): string {
    const width = margin * 2 + columns * tileSize + (columns - 1) * spacing;
    const height = margin * 2 + rows * tileSize + (rows - 1) * spacing;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // 背景
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // 生成彩色瓦片
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = margin + col * (tileSize + spacing);
        const y = margin + row * (tileSize + spacing);

        // 生成随机颜色
        const hue = ((row * columns + col) * 137.5) % 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
        ctx.fillRect(x, y, tileSize, tileSize);

        // 绘制边框
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tileSize, tileSize);

        // 绘制索引号
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.floor(tileSize / 3)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `${row * columns + col}`,
          x + tileSize / 2,
          y + tileSize / 2
        );
      }
    }

    return canvas.toDataURL('image/png');
  }

  /**
   * 生成地形瓦片集（简化版）
   */
  static generateTerrainTileset(
    tileSize: number = 32
  ): string {
    const columns = 8;
    const rows = 4;
    const width = columns * tileSize;
    const height = rows * tileSize;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // 定义地形类型
    const terrains = [
      { name: 'Grass', color: '#4a7c40' },
      { name: 'Dirt', color: '#8b6f47' },
      { name: 'Stone', color: '#6b7280' },
      { name: 'Water', color: '#3b82f6' },
      { name: 'Sand', color: '#f4e4c1' },
      { name: 'Lava', color: '#ef4444' },
      { name: 'Ice', color: '#bfdbfe' },
      { name: 'Wood', color: '#92400e' },
    ];

    let index = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = col * tileSize;
        const y = row * tileSize;
        const terrain = terrains[index % terrains.length];

        // 基础颜色
        ctx.fillStyle = terrain.color;
        ctx.fillRect(x, y, tileSize, tileSize);

        // 添加纹理效果
        this.addTexture(ctx, x, y, tileSize, terrain.color);

        // 边框
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tileSize, tileSize);

        index++;
      }
    }

    return canvas.toDataURL('image/png');
  }

  /**
   * 生成平台游戏瓦片集
   */
  static generatePlatformerTileset(
    tileSize: number = 32
  ): string {
    const columns = 12;
    const rows = 8;
    const width = columns * tileSize;
    const height = rows * tileSize;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // 背景
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // 绘制各种平台瓦片
    const tileTypes = [
      // 第一行：实心方块
      { pattern: 'solid', color: '#8b4513' },
      { pattern: 'solid', color: '#654321' },
      { pattern: 'solid', color: '#a0522d' },
      { pattern: 'brick', color: '#cd5c5c' },
      { pattern: 'brick', color: '#8b0000' },
      { pattern: 'metal', color: '#708090' },
      { pattern: 'metal', color: '#2f4f4f' },
      { pattern: 'grass_top', color: '#228b22' },
      { pattern: 'dirt', color: '#8b6914' },
      { pattern: 'stone', color: '#696969' },
      { pattern: 'ice', color: '#87ceeb' },
      { pattern: 'lava', color: '#ff4500' },
    ];

    for (let i = 0; i < columns * rows && i < tileTypes.length * 8; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = col * tileSize;
      const y = row * tileSize;
      const tileType = tileTypes[i % tileTypes.length];

      this.drawPlatformTile(ctx, x, y, tileSize, tileType.pattern, tileType.color);
    }

    return canvas.toDataURL('image/png');
  }

  /**
   * 添加纹理效果
   */
  private static addTexture(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    baseColor: string
  ): void {
    // 简单的噪点纹理
    const imageData = ctx.getImageData(x, y, size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 30;
      data[i] += noise;     // R
      data[i + 1] += noise; // G
      data[i + 2] += noise; // B
    }

    ctx.putImageData(imageData, x, y);
  }

  /**
   * 绘制平台瓦片
   */
  private static drawPlatformTile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    pattern: string,
    color: string
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);

    switch (pattern) {
      case 'brick':
        this.drawBrickPattern(ctx, x, y, size, color);
        break;
      case 'metal':
        this.drawMetalPattern(ctx, x, y, size, color);
        break;
      case 'grass_top':
        this.drawGrassTopPattern(ctx, x, y, size, color);
        break;
      case 'dirt':
        this.drawDirtPattern(ctx, x, y, size, color);
        break;
      case 'stone':
        this.drawStonePattern(ctx, x, y, size, color);
        break;
      case 'ice':
        this.drawIcePattern(ctx, x, y, size, color);
        break;
      case 'lava':
        this.drawLavaPattern(ctx, x, y, size, color);
        break;
    }

    // 边框
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
  }

  private static drawBrickPattern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + (i * size) / 3);
      ctx.lineTo(x + size, y + (i * size) / 3);
      ctx.stroke();
    }
  }

  private static drawMetalPattern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, this.lightenColor(color, 20));
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);
  }

  private static drawGrassTopPattern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.fillStyle = this.darkenColor(color, 30);
    ctx.fillRect(x, y + size / 4, size, (size * 3) / 4);
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const gx = x + (i * size) / 5;
      ctx.fillRect(gx, y, size / 10, size / 4);
    }
  }

  private static drawDirtPattern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = this.darkenColor(color, Math.random() * 20);
      const dx = x + Math.random() * size;
      const dy = y + Math.random() * size;
      ctx.fillRect(dx, dy, size / 8, size / 8);
    }
  }

  private static drawStonePattern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.strokeStyle = this.darkenColor(color, 20);
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + Math.random() * size, y + Math.random() * size);
      ctx.lineTo(x + Math.random() * size, y + Math.random() * size);
      ctx.stroke();
    }
  }

  private static drawIcePattern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    const gradient = ctx.createRadialGradient(x + size / 2, y + size / 2, 0, x + size / 2, y + size / 2, size / 2);
    gradient.addColorStop(0, this.lightenColor(color, 30));
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);
  }

  private static drawLavaPattern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = this.lightenColor(color, Math.random() * 40);
      const lx = x + Math.random() * size;
      const ly = y + Math.random() * size;
      const radius = size / 6;
      ctx.beginPath();
      ctx.arc(lx, ly, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 颜色加深
   */
  private static darkenColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount);
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount);
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * 颜色变浅
   */
  private static lightenColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount);
    const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount);
    const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * 下载瓦片集
   */
  static downloadTileset(dataUrl: string, filename: string = 'tileset.png'): void {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }
}

