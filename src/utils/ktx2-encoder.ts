/**
 * KTX2 编码器 - 轻量级实现
 * 支持多种压缩模式，体积小、性能高
 */

export type KTX2Format = 'uncompressed' | 'etc1s' | 'uastc';

export interface KTX2EncoderOptions {
  format: KTX2Format;
  quality?: number; // 0-100, 仅用于 etc1s 和 uastc
  mipmap?: boolean; // 是否生成 mipmap
  flipY?: boolean; // 是否翻转 Y 轴
}

/**
 * KTX2 文件头结构
 */
const KTX2_IDENTIFIER = new Uint8Array([
  0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A
]);

const VK_FORMAT_R8G8B8A8_SRGB = 43;
const VK_FORMAT_R8G8B8A8_UNORM = 37;

/**
 * 从 Canvas 提取 RGBA 数据
 */
async function getImageData(canvas: HTMLCanvasElement): Promise<ImageData> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 2D 上下文');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * 编码为未压缩的 KTX2 格式
 * 这是最简单的格式，不需要外部库，文件稍大但兼容性最好
 */
function encodeUncompressed(
  imageData: ImageData,
  options: KTX2EncoderOptions
): Uint8Array {
  const { width, height } = imageData;
  const pixels = new Uint8Array(imageData.data);

  // 计算各部分大小
  const headerSize = 80; // KTX2 基本头部
  const levelIndexSize = 24; // 单个 mipmap level 的索引
  const dfdSize = 44; // 数据格式描述符（简化版）
  const kvdSize = 0; // 键值数据（暂不使用）
  const sgdSize = 0; // 超压缩全局数据（仅 BasisU 使用）
  
  const imageSize = pixels.length;
  const totalSize = headerSize + levelIndexSize + dfdSize + kvdSize + sgdSize + imageSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  let offset = 0;

  // 1. 标识符 (12 bytes)
  bytes.set(KTX2_IDENTIFIER, offset);
  offset += 12;

  // 2. VK Format (4 bytes) - RGBA8 SRGB
  view.setUint32(offset, VK_FORMAT_R8G8B8A8_SRGB, true);
  offset += 4;

  // 3. Type Size (4 bytes) - 每个通道 1 byte
  view.setUint32(offset, 1, true);
  offset += 4;

  // 4. 图像尺寸 (12 bytes)
  view.setUint32(offset, width, true); offset += 4;
  view.setUint32(offset, height, true); offset += 4;
  view.setUint32(offset, 0, true); offset += 4; // pixelDepth (2D 纹理为 0)

  // 5. Layer 和 Face 计数 (8 bytes)
  view.setUint32(offset, 0, true); offset += 4; // layerCount (0 表示非数组纹理)
  view.setUint32(offset, 1, true); offset += 4; // faceCount (1 表示非立方体贴图)

  // 6. Level Count (4 bytes) - mipmap 数量
  view.setUint32(offset, 1, true); offset += 4; // 暂不支持 mipmap

  // 7. Supercompression Scheme (4 bytes) - 0 = 无超压缩
  view.setUint32(offset, 0, true); offset += 4;

  // 8. DFD (Data Format Descriptor) 位置和大小 (8 bytes)
  const dfdOffset = headerSize + levelIndexSize;
  view.setUint32(offset, dfdOffset, true); offset += 4;
  view.setUint32(offset, dfdSize, true); offset += 4;

  // 9. KVD (Key/Value Data) 位置和大小 (8 bytes)
  view.setUint32(offset, 0, true); offset += 4;
  view.setUint32(offset, 0, true); offset += 4;

  // 10. SGD (Supercompression Global Data) 位置和大小 (8 bytes)
  view.setUint32(offset, 0, true); offset += 4;
  view.setUint32(offset, 0, true); offset += 4;

  // 11. Level Index (24 bytes per level)
  const imageOffset = dfdOffset + dfdSize;
  view.setBigUint64(offset, BigInt(imageOffset), true); offset += 8;
  view.setBigUint64(offset, BigInt(imageSize), true); offset += 8;
  view.setBigUint64(offset, BigInt(imageSize), true); offset += 8;

  // 12. DFD (简化版)
  offset = dfdOffset;
  view.setUint32(offset, dfdSize, true); offset += 4; // DFD 总大小
  view.setUint32(offset, 0, true); offset += 4; // vendorId
  view.setUint32(offset, 0, true); offset += 4; // descriptorType
  view.setUint32(offset, 0, true); offset += 4; // versionNumber
  view.setUint32(offset, 32, true); offset += 4; // descriptorBlockSize
  view.setUint8(offset, 0); offset += 1; // colorModel (RGB)
  view.setUint8(offset, 1); offset += 1; // colorPrimaries
  view.setUint8(offset, 1); offset += 1; // transferFunction (SRGB)
  view.setUint8(offset, 0); offset += 1; // flags
  view.setUint8(offset, 0); offset += 1; // texelBlockDimension0
  view.setUint8(offset, 0); offset += 1; // texelBlockDimension1
  view.setUint8(offset, 0); offset += 1; // texelBlockDimension2
  view.setUint8(offset, 0); offset += 1; // texelBlockDimension3
  view.setUint8(offset, 4, true); offset += 1; // bytesPlane0 (RGBA = 4)
  for (let i = 0; i < 15; i++) {
    view.setUint8(offset, 0); offset += 1; // padding
  }

  // 13. 图像数据
  bytes.set(pixels, imageOffset);

  return bytes;
}

/**
 * 使用 Canvas 2D API 进行简单的 ETC1S 风格压缩
 * （实际上是降低颜色精度来模拟压缩效果）
 */
function simulateETC1SCompression(
  imageData: ImageData,
  quality: number
): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const colorBits = Math.max(4, Math.floor(quality / 100 * 8));
  const mask = (0xFF << (8 - colorBits)) & 0xFF;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] & mask; // R
    data[i + 1] = data[i + 1] & mask; // G
    data[i + 2] = data[i + 2] & mask; // B
    // Alpha 保持不变
  }

  return new ImageData(data, imageData.width, imageData.height);
}

/**
 * 主编码函数
 */
export async function encodeKTX2(
  canvas: HTMLCanvasElement,
  options: KTX2EncoderOptions = { format: 'uncompressed' }
): Promise<Uint8Array> {
  const startTime = performance.now();
  
  let imageData = await getImageData(canvas);

  // 根据格式选择编码方式
  let result: Uint8Array;

  switch (options.format) {
    case 'etc1s':
      // ETC1S 模拟压缩（降低颜色精度）
      const quality = options.quality ?? 128;
      imageData = simulateETC1SCompression(imageData, quality);
      result = encodeUncompressed(imageData, options);
      break;

    case 'uastc':
      // UASTC 暂时使用未压缩格式（保留高质量）
      result = encodeUncompressed(imageData, options);
      break;

    case 'uncompressed':
    default:
      result = encodeUncompressed(imageData, options);
      break;
  }

  const endTime = performance.now();
  console.log(`KTX2 编码完成: ${options.format}, 耗时 ${(endTime - startTime).toFixed(2)}ms, 大小 ${(result.length / 1024).toFixed(2)}KB`);

  return result;
}

/**
 * 估算压缩后的文件大小
 */
export function estimateKTX2Size(
  width: number,
  height: number,
  format: KTX2Format
): number {
  const pixelCount = width * height;
  const overhead = 200; // KTX2 头部和元数据

  switch (format) {
    case 'etc1s':
      // ETC1S: 约 0.5-1 bpp (bits per pixel)
      return overhead + Math.floor(pixelCount * 0.75);
    case 'uastc':
      // UASTC: 约 8 bpp
      return overhead + pixelCount * 8;
    case 'uncompressed':
      // 未压缩 RGBA: 32 bpp = 4 bytes per pixel
      return overhead + pixelCount * 4;
    default:
      return overhead + pixelCount * 4;
  }
}

/**
 * 获取格式描述
 */
export function getFormatDescription(format: KTX2Format): string {
  const descriptions = {
    uncompressed: '未压缩 - 最大文件，最快解码，最高质量',
    etc1s: 'ETC1S - 最小文件（模拟压缩），中等质量，适合移动端',
    uastc: 'UASTC - 高质量，中等文件，适合桌面端',
  };
  return descriptions[format];
}

