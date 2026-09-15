export class EscPosBuilder {
  private commands: number[] = []
  private encoder = new TextEncoder()
  
  init(): this {
    this.commands.push(0x1B, 0x40) // ESC @ - Initialize printer
    return this
  }
  
  text(text: string, options?: {
    align?: 'left' | 'center' | 'right'
    bold?: boolean
    size?: 1 | 2
    underline?: boolean
    font?: 'a' | 'b'
  }): this {
    const { align = 'left', bold = false, size = 1, underline = false, font = 'a' } = options || {}
    
    // Alignment
    this.commands.push(0x1B, 0x61, { left: 0, center: 1, right: 2 }[align])
    
    // Font
    this.commands.push(0x1B, 0x4D, font === 'a' ? 0 : 1)
    
    // Bold
    if (bold) {
      this.commands.push(0x1B, 0x45, 1)
    }
    
    // Size
    if (size === 2) {
      this.commands.push(0x1D, 0x21, 0x11) // Double width and height
    }
    
    // Underline
    if (underline) {
      this.commands.push(0x1B, 0x2D, 1)
    }
    
    // Text content
    this.commands.push(...this.encoder.encode(text))
    this.commands.push(0x0A) // LF
    
    // Reset styles
    if (underline) {
      this.commands.push(0x1B, 0x2D, 0)
    }
    if (bold) {
      this.commands.push(0x1B, 0x45, 0)
    }
    if (size === 2) {
      this.commands.push(0x1D, 0x21, 0x00)
    }
    
    return this
  }
  
  line(char: string = '-', width: number = 32): this {
    return this.text(char.repeat(width))
  }
  
  feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.commands.push(0x0A)
    }
    return this
  }
  
  cut(mode: 'full' | 'partial' = 'full'): this {
    if (mode === 'full') {
      this.commands.push(0x1D, 0x56, 0x41, 0x00) // Full cut
    } else {
      this.commands.push(0x1D, 0x56, 0x42, 0x00) // Partial cut
    }
    return this
  }
  
  kickDrawer(pin: number = 0, onTime: number = 25, offTime: number = 250): this {
    // ESC p m t1 t2
    this.commands.push(0x1B, 0x70, pin, onTime, offTime)
    return this
  }
  
  beep(count: number = 1, duration: number = 5): this {
    // GS B n t
    for (let i = 0; i < count; i++) {
      this.commands.push(0x1D, 0x42, count, duration)
    }
    return this
  }
  
  // Barcode (Code128)
  barcode(data: string, options?: {
    type?: 'CODE128' | 'EAN13' | 'CODE39'
    height?: number
    width?: number
    hri?: 'none' | 'above' | 'below' | 'both'
  }): this {
    const { type = 'CODE128', height = 64, width = 2, hri = 'below' } = options || {}
    
    const typeMap = { CODE128: 73, EAN13: 67, CODE39: 4 }
    const hriMap = { none: 0, above: 1, below: 2, both: 3 }
    
    this.commands.push(0x1D, 0x68, height) // Height
    this.commands.push(0x1D, 0x77, width)  // Width
    this.commands.push(0x1D, 0x48, hriMap[hri]) // HRI position
    this.commands.push(0x1D, 0x6B, typeMap[type]) // Barcode type
    this.commands.push(data.length) // Data length
    this.commands.push(...this.encoder.encode(data))
    this.commands.push(0x00) // NUL terminator
    
    return this
  }
  
  // QR Code
  qrCode(data: string, options?: {
    model?: 1 | 2
    size?: 1 | 2 | 3 | 4 | 5 | 6
    errorLevel?: 'L' | 'M' | 'Q' | 'H'
  }): this {
    const { model = 2, size = 3, errorLevel = 'M' } = options || {}
    
    const errorMap = { L: 48, M: 49, Q: 50, H: 51 }
    
    // QR Code: GS ( k
    this.commands.push(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, model, 0x00) // Select model
    this.commands.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, errorMap[errorLevel]) // Error correction
    this.commands.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x44, size) // Size
    
    const dataBytes = this.encoder.encode(data)
    const length = dataBytes.length + 3
    this.commands.push(0x1D, 0x28, 0x6B, length & 0xFF, (length >> 8) & 0xFF, 0x31, 0x50, 0x30)
    this.commands.push(...dataBytes)
    
    this.commands.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30) // Print
    
    return this
  }
  
  // Image (raster)
  image(imageData: Uint8Array, width: number, height: number): this {
    // This is a simplified version - real implementation needs proper raster encoding
    // For production, use a library like escpos-image
    return this
  }
  
  // Raw commands
  raw(...bytes: number[]): this {
    this.commands.push(...bytes)
    return this
  }
  
  build(): Uint8Array {
    return new Uint8Array(this.commands)
  }
  
  // Static helper for common sequences
  static reset(): Uint8Array {
    return new Uint8Array([0x1B, 0x40])
  }
  
  static selectCodePage(codePage: number): Uint8Array {
    // ESC t n
    return new Uint8Array([0x1B, 0x74, codePage])
  }
}

// Common code pages
export const CodePages = {
  PC437: 0,    // USA, Standard Europe
  KATAKANA: 1, // Japanese
  PC850: 2,    // Multilingual
  PC860: 3,    // Portuguese
  PC863: 4,    // Canadian French
  PC865: 5,    // Nordic
  WPC1252: 16, // Windows Latin 1
  PC866: 17,   // Cyrillic
  PC852: 18,   // Latin 2
  PC858: 19,   // Euro
  ISO_8859_1: 16,
  UTF8: 255,   // Not standard ESC/POS but some printers support
}

// Paper width constants (in dots, 203 DPI typical)
export const PaperWidth = {
  MM58: 384,   // 58mm
  MM80: 576,   // 80mm
}