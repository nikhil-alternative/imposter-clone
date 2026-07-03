import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function createPNG(width, height, r, g, b) {
  // Minimal valid PNG with solid color
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const crcData = Buffer.concat([Buffer.from(type), data])
    const crc = crc32(crcData)
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc)
    return Buffer.concat([len, Buffer.from(type), data, crcBuf])
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  // Raw pixel data (filter byte + RGB for each row)
  const rawSize = (1 + width * 3) * height
  const raw = Buffer.alloc(rawSize)
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 3)
    raw[offset] = 0 // filter: None
    for (let x = 0; x < width; x++) {
      const poff = offset + 1 + x * 3
      raw[poff] = r
      raw[poff + 1] = g
      raw[poff + 2] = b
    }
  }

  const compressed = deflateSync(raw)

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >>> 1) ^ 0xEDB88320
      else crc >>>= 1
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

const outDir = join(__dirname, '..', 'public')

// Generate icons
// Accent color: #ff2d55 = rgb(255, 45, 85)
const sizes = [
  [192, 192],
  [512, 512]
]

for (const [w, h] of sizes) {
  const png = createPNG(w, h, 255, 45, 85)
  writeFileSync(join(outDir, `icon-${w}.png`), png)
  console.log(`Generated icon-${w}.png (${png.length} bytes)`)
}
