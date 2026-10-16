export interface FocalPoint {
  /** Normalized horizontal focal coordinate from 0 (left) to 1 (right). Optical center is 0.5. */
  x: number
  /** Normalized vertical focal coordinate from 0 (top) to 1 (bottom). Optical center is 0.5. */
  y: number
}

export const OPTICAL_CENTER: Readonly<FocalPoint> = Object.freeze({
  x: 0.5,
  y: 0.5,
})

export interface DetectedFace {
  x: number
  y: number
  width: number
  height: number
}

export interface SubjectDetectionDeps {
  detectFaces?: (source: CanvasImageSource) => Promise<DetectedFace[]>
}

/**
 * Clamp a normalized coordinate value into the [0, 1] interval.
 * Returns 0.5 (optical center) if the input is not finite.
 */
export function clamp01(val: number): number {
  if (!Number.isFinite(val)) return 0.5
  return Math.max(0, Math.min(1, val))
}

/**
 * Extract natural or intrinsic pixel dimensions from any CanvasImageSource.
 * Returns { width: 0, height: 0 } if dimensions cannot be determined.
 */
export function getSourceDimensions(source: CanvasImageSource): { width: number; height: number } {
  const width =
    (source as HTMLImageElement).naturalWidth ??
    (source as HTMLVideoElement).videoWidth ??
    (source as { width?: number }).width ??
    0
  const height =
    (source as HTMLImageElement).naturalHeight ??
    (source as HTMLVideoElement).videoHeight ??
    (source as { height?: number }).height ??
    0
  return { width, height }
}

/**
 * Native browser FaceDetector using the Shape Detection API when supported.
 */
async function nativeDetectFaces(source: CanvasImageSource): Promise<DetectedFace[]> {
  const win =
    typeof window !== 'undefined'
      ? (window as unknown as {
          FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
            detect: (s: CanvasImageSource) => Promise<
              Array<{ boundingBox: { x: number; y: number; width: number; height: number } }>
            >
          }
        })
      : null
  if (!win || !win.FaceDetector) {
    return []
  }
  try {
    const detector = new win.FaceDetector({ fastMode: true, maxDetectedFaces: 10 })
    const results = await detector.detect(source)
    return results.map((r) => ({
      x: r.boundingBox.x,
      y: r.boundingBox.y,
      width: r.boundingBox.width,
      height: r.boundingBox.height,
    }))
  } catch {
    return []
  }
}

/**
 * Client-side face and subject detection.
 * Analyzes the picture to locate primary focal subjects (faces).
 * When multiple faces exist, centers on the collective bounding box of all detected faces
 * so attendee groups are not cut off.
 * Smoothly falls back to optical center-cropping (0.5, 0.5) when no faces are detected.
 */
export async function detectSubject(
  source: CanvasImageSource,
  deps: SubjectDetectionDeps = {},
): Promise<FocalPoint> {
  const { width, height } = getSourceDimensions(source)
  const detectFaces = deps.detectFaces ?? nativeDetectFaces

  try {
    const faces = await detectFaces(source)
    if (faces && faces.length > 0 && width > 0 && height > 0) {
      let minX = faces[0].x
      let minY = faces[0].y
      let maxX = faces[0].x + faces[0].width
      let maxY = faces[0].y + faces[0].height

      for (let i = 1; i < faces.length; i++) {
        const f = faces[i]
        if (f.x < minX) minX = f.x
        if (f.y < minY) minY = f.y
        if (f.x + f.width > maxX) maxX = f.x + f.width
        if (f.y + f.height > maxY) maxY = f.y + f.height
      }

      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2

      return {
        x: clamp01(centerX / width),
        y: clamp01(centerY / height),
      }
    }
  } catch {
    // Face detection failed; smoothly fall back to optical center
  }

  return OPTICAL_CENTER
}
