const html = require('choo/html')

function minMaxBox (points) {
  let top = -Infinity
  let right = -Infinity
  let bottom = Infinity
  let left = Infinity
  for (let i = 0, len = points.length; i < len; i++) {
    const {x, y} = points[i]
    top = Math.max(top, y)
    right = Math.max(right, x)
    bottom = Math.min(bottom, y)
    left = Math.min(left, x)
  }
  const width = right - left
  const height = top - bottom
  return {left, bottom, width, height}
}

function reflectPoint (p, p0, p1) {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const a = (dx * dx - dy * dy) / (dx * dx + dy * dy)
  const b = 2 * dx * dy / (dx * dx + dy * dy)
  const x = a * (p.x - p0.x) + b * (p.y - p0.y) + p0.x
  const y = b * (p.x - p0.x) - a * (p.y - p0.y) + p0.y

  return {x, y}
}

function makeSymmetrical (points) {
  const simPoints = points.slice()
  const a = points[0]
  const b = points[points.length-1]
  let i = points.length - 1
  while (i > 0) {
    const point = points[i]
    simPoints.push(reflectPoint(point, a, b))
    i--
  }
  return simPoints
}

function dClosed (points) {
  let path = 'M '
  for (let i = 0, len = points.length; i < len; i++) {
    const {x, y} = points[i]
    path += x + ' ' + y + ' L '
  }
  path += points[0].x + ' ' + points[0].y
  return path
}

function fit (points, fitWidth, fitHeight, padding = 4) {
  fitWidth -= padding * 2
  fitHeight -= padding * 2
  const {left, bottom, width, height} = minMaxBox(points)
  const scale = Math.min(fitWidth/width, fitHeight/height)
  const paddingLeft = Math.max(0, (fitWidth - (width * scale)) / 2)
  const paddingTop = Math.max(0, (fitHeight - (height * scale)) / 2)
  return points.map(function (point) {
    return {
      x: ((point.x - left) * scale) + paddingLeft + padding,
      y: ((point.y - bottom) * scale) + paddingTop + padding,
    }
  })
}

function line (a, b) {
  return html`<line
    x1=${a.x}
    y1=${a.y}
    x2=${b.x}
    y2=${b.y}
    stroke-width="1"
    stroke="green"
  />`
}

function svgPoly (points, symmetry = false, width = 72, height = 72) {
  const lastIndex = points.length-1
  if (symmetry) {
    points = makeSymmetrical(points)
  }
  points = fit(points, width, height)
  const d = dClosed(points)
  return html`
    <svg
      width="${width}" height="${height}"
      style="
        overflow:visible;
        border: 1px solid #ccc;
        border-radius: 5px;
        background-color: #eee;
      "
    >
      <path
        d="${d}"
        fill="#fff" stroke="black" stroke-width="1"
      />
      ${symmetry && line(points[0], points[lastIndex])}
    </svg>
  `
}

module.exports = svgPoly
