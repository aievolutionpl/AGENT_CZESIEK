import type { MemoryCamera, MemoryPoint3D, MemoryProjection, MemoryProjectionSize, ProjectedMemoryNode } from './types'

const finite = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback)

/** Project a deterministic world point into CSS pixels. The camera looks down
 * the negative Z axis; depth is therefore always measured from the camera and
 * larger depths are painted first. */
export function projectMemoryGraph(
  points: readonly MemoryPoint3D[],
  camera: MemoryCamera,
  size: MemoryProjectionSize
): MemoryProjection {
  const width = Math.max(0, finite(size.width, 0))
  const height = Math.max(0, finite(size.height, 0))
  const yaw = finite(camera.yaw, 0)
  const pitch = finite(camera.pitch, 0)
  const distance = Math.max(0.0001, finite(camera.distance, 600))
  const focal = Math.max(0.0001, finite(camera.focal_length, 600))
  const zoom = Math.max(0.0001, finite(camera.zoom, 1))
  const near = Math.max(0.0001, finite(camera.near, 1))
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const cx = width / 2 + finite(camera.pan_x, 0)
  const cyScreen = height / 2 + finite(camera.pan_y, 0)

  const projected = points.map((point): ProjectedMemoryNode => {
    const x = finite(point.x, 0)
    const y = finite(point.y, 0)
    const z = finite(point.z, 0)
    const yawX = cy * x - sy * z
    const yawZ = sy * x + cy * z
    const rotatedY = cp * y - sp * yawZ
    const rotatedZ = sp * y + cp * yawZ
    const depth = distance + rotatedZ
    const visible = depth >= near && Number.isFinite(depth)
    const scale = visible ? (focal * zoom) / depth : 0

    return {
      id: point.id,
      x: cx + yawX * scale,
      y: cyScreen + rotatedY * scale,
      depth,
      radius: Math.max(0, finite(point.radius, 0) * scale),
      visible
    }
  })

  projected.sort((a, b) => (b.depth === a.depth ? a.id.localeCompare(b.id) : b.depth - a.depth))

  return { size: { width, height }, nodes: projected }
}

/** Pick the nearest visible node, in the same CSS-pixel space and with the
 * same projected radius used by the renderer. */
export function hitTestMemoryProjection(projection: MemoryProjection, x: number, y: number): string | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }

  for (let index = projection.nodes.length - 1; index >= 0; index -= 1) {
    const node = projection.nodes[index]!

    if (!node.visible || node.radius <= 0) {
      continue
    }

    if ((node.x - x) ** 2 + (node.y - y) ** 2 <= node.radius ** 2) {
      return node.id
    }
  }

  return null
}
