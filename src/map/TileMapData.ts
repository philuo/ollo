/**
 * TileMap 数据结构和导入/导出功能
 * 实现高效的地图数据存储格式
 */

/**
 * 瓦片定义
 */
export interface Tile {
  // 瓦片在 tileset 中的位置
  tilesetId: number; // 使用的瓦片集 ID
  tileIndex: number; // 在瓦片集中的索引
}

/**
 * 瓦片集定义
 */
export interface TileSetDefinition {
  id: number;
  name: string;
  imageUrl: string;
  imageData?: string; // base64 编码的图片数据（用于导出）
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  spacing: number; // 瓦片间距
  margin: number; // 边距
}

/**
 * 地图层定义
 */
export interface MapLayer {
  name: string;
  visible: boolean;
  opacity: number;
  tiles: (Tile | null)[][]; // 二维数组，null 表示空瓦片
}

/**
 * 地图数据
 */
export interface TileMapData {
  version: string;
  width: number; // 地图宽度（以瓦片为单位）
  height: number; // 地图高度（以瓦片为单位）
  tileWidth: number; // 单个瓦片宽度（像素）
  tileHeight: number; // 单个瓦片高度（像素）
  tileSets: TileSetDefinition[];
  layers: MapLayer[];
}

/**
 * 压缩的地图数据格式（用于导出）
 * 使用游程编码（Run-Length Encoding）压缩空瓦片
 */
export interface CompressedMapData {
  v: string; // version
  w: number; // width
  h: number; // height
  tw: number; // tileWidth
  th: number; // tileHeight
  ts: CompressedTileSet[]; // tileSets
  l: CompressedLayer[]; // layers
}

interface CompressedTileSet {
  i: number; // id
  n: string; // name
  u?: string; // imageUrl
  d?: string; // imageData (base64)
  tw: number; // tileWidth
  th: number; // tileHeight
  c: number; // columns
  r: number; // rows
  s: number; // spacing
  m: number; // margin
}

interface CompressedLayer {
  n: string; // name
  v: boolean; // visible
  o: number; // opacity
  t: string; // tiles (compressed)
}

/**
 * TileMap 数据管理类
 */
export class TileMapDataManager {
  /**
   * 创建空地图
   */
  static createEmptyMap(width: number, height: number, tileWidth: number, tileHeight: number): TileMapData {
    return {
      version: '1.0.0',
      width,
      height,
      tileWidth,
      tileHeight,
      tileSets: [],
      layers: [
        {
          name: 'Layer 1',
          visible: true,
          opacity: 1.0,
          tiles: Array(height).fill(null).map(() => Array(width).fill(null)),
        },
      ],
    };
  }

  /**
   * 添加图层
   */
  static addLayer(mapData: TileMapData, name: string): TileMapData {
    const newLayer: MapLayer = {
      name,
      visible: true,
      opacity: 1.0,
      tiles: Array(mapData.height).fill(null).map(() => Array(mapData.width).fill(null)),
    };
    return {
      ...mapData,
      layers: [...mapData.layers, newLayer],
    };
  }

  /**
   * 设置瓦片
   */
  static setTile(
    mapData: TileMapData,
    layerIndex: number,
    x: number,
    y: number,
    tile: Tile | null
  ): TileMapData {
    if (layerIndex < 0 || layerIndex >= mapData.layers.length) {
      return mapData;
    }
    if (x < 0 || x >= mapData.width || y < 0 || y >= mapData.height) {
      return mapData;
    }

    const newLayers = [...mapData.layers];
    const newLayer = { ...newLayers[layerIndex] };
    const newTiles = newLayer.tiles.map(row => [...row]);
    newTiles[y][x] = tile;
    newLayer.tiles = newTiles;
    newLayers[layerIndex] = newLayer;

    return {
      ...mapData,
      layers: newLayers,
    };
  }

  /**
   * 导出地图数据（压缩格式）
   */
  static async exportMap(mapData: TileMapData, includeImageData: boolean = true): Promise<string> {
    const compressed: CompressedMapData = {
      v: mapData.version,
      w: mapData.width,
      h: mapData.height,
      tw: mapData.tileWidth,
      th: mapData.tileHeight,
      ts: await Promise.all(mapData.tileSets.map(async ts => {
        const compressedTs: CompressedTileSet = {
          i: ts.id,
          n: ts.name,
          tw: ts.tileWidth,
          th: ts.tileHeight,
          c: ts.columns,
          r: ts.rows,
          s: ts.spacing,
          m: ts.margin,
        };
        
        if (includeImageData && ts.imageUrl && !ts.imageData) {
          // 如果需要包含图片数据但还没有，尝试加载
          try {
            const imageData = await this.urlToBase64(ts.imageUrl);
            compressedTs.d = imageData;
          } catch (e) {
            console.warn(`Failed to load image data for tileset ${ts.id}:`, e);
            compressedTs.u = ts.imageUrl;
          }
        } else if (ts.imageData) {
          compressedTs.d = ts.imageData;
        } else {
          compressedTs.u = ts.imageUrl;
        }
        
        return compressedTs;
      })),
      l: mapData.layers.map(layer => ({
        n: layer.name,
        v: layer.visible,
        o: layer.opacity,
        t: this.compressTiles(layer.tiles),
      })),
    };

    return JSON.stringify(compressed);
  }

  /**
   * 导入地图数据
   */
  static importMap(jsonString: string): TileMapData {
    const compressed: CompressedMapData = JSON.parse(jsonString);

    return {
      version: compressed.v,
      width: compressed.w,
      height: compressed.h,
      tileWidth: compressed.tw,
      tileHeight: compressed.th,
      tileSets: compressed.ts.map(ts => ({
        id: ts.i,
        name: ts.n,
        imageUrl: ts.u || '',
        imageData: ts.d,
        tileWidth: ts.tw,
        tileHeight: ts.th,
        columns: ts.c,
        rows: ts.r,
        spacing: ts.s,
        margin: ts.m,
      })),
      layers: compressed.l.map(layer => ({
        name: layer.n,
        visible: layer.v,
        opacity: layer.o,
        tiles: this.decompressTiles(layer.t, compressed.w, compressed.h),
      })),
    };
  }

  /**
   * 压缩瓦片数据（使用游程编码）
   * 格式：每个瓦片用 "tilesetId:tileIndex" 表示，空瓦片用 "e"
   * 连续相同的瓦片用 "count*tile" 表示
   */
  private static compressTiles(tiles: (Tile | null)[][]): string {
    const flat: string[] = [];
    
    for (const row of tiles) {
      for (const tile of row) {
        if (tile === null) {
          flat.push('e');
        } else {
          flat.push(`${tile.tilesetId}:${tile.tileIndex}`);
        }
      }
    }

    // 游程编码
    const compressed: string[] = [];
    let currentValue = flat[0];
    let count = 1;

    for (let i = 1; i < flat.length; i++) {
      if (flat[i] === currentValue) {
        count++;
      } else {
        if (count > 1) {
          compressed.push(`${count}*${currentValue}`);
        } else {
          compressed.push(currentValue);
        }
        currentValue = flat[i];
        count = 1;
      }
    }

    // 添加最后一组
    if (count > 1) {
      compressed.push(`${count}*${currentValue}`);
    } else {
      compressed.push(currentValue);
    }

    return compressed.join(',');
  }

  /**
   * 解压瓦片数据
   */
  private static decompressTiles(compressed: string, width: number, height: number): (Tile | null)[][] {
    const parts = compressed.split(',');
    const flat: (Tile | null)[] = [];

    for (const part of parts) {
      if (part.includes('*')) {
        // 游程编码
        const [countStr, value] = part.split('*');
        const count = parseInt(countStr, 10);
        const tile = this.parseTile(value);
        for (let i = 0; i < count; i++) {
          flat.push(tile);
        }
      } else {
        flat.push(this.parseTile(part));
      }
    }

    // 转换为二维数组
    const tiles: (Tile | null)[][] = [];
    for (let y = 0; y < height; y++) {
      const row: (Tile | null)[] = [];
      for (let x = 0; x < width; x++) {
        row.push(flat[y * width + x] || null);
      }
      tiles.push(row);
    }

    return tiles;
  }

  /**
   * 解析瓦片字符串
   */
  private static parseTile(str: string): Tile | null {
    if (str === 'e') {
      return null;
    }
    const [tilesetId, tileIndex] = str.split(':').map(s => parseInt(s, 10));
    return { tilesetId, tileIndex };
  }

  /**
   * 将 URL 转换为 base64
   */
  private static async urlToBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 计算地图数据大小（字节）
   */
  static getDataSize(mapData: TileMapData): number {
    const json = JSON.stringify(mapData);
    return new Blob([json]).size;
  }

  /**
   * 计算压缩后的数据大小
   */
  static async getCompressedSize(mapData: TileMapData): Promise<number> {
    const compressed = await this.exportMap(mapData, false);
    return new Blob([compressed]).size;
  }
}

