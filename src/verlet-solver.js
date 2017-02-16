// Experiment to do n integrations of verlet system, 
// synchronous, not animated

const System = require('verlet-system')
const Point = require('verlet-point')
const Constraint = require('verlet-constraint')
const Parser = require('expr-eval').Parser
const {AngleConstraint, rotate} = require('./verlet-constraint-angle-2d')
const {pointsWithSymmetry} = require('./geometry.js')


function pointToVertex (point, index) {
  const p = new Point({position: pointToPosition(point)})
  p.index = index
  return p
}

function pointToPosition (point) {
  return [point.x, point.y]
}

function vertexToPoint (vertex) {
  return positionToPoint(vertex.position)
}

function positionToPoint (position) {
  return {x: position[0], y: position[1]}
}

function verticesRotate (vertices, a1, b1, a2, b2) {
  function vectorAngle (a, b) {
    return Math.atan2(b[1] - a[1], b[0] - a[0])
  }
  const angle1 = vectorAngle(a1, b1)
  const angle2 = vectorAngle(a2, b2)
  const theta = angle1 - angle2
  const x = (a2[0] + b2[0]) / 2
  const y = (a2[1] + b2[1]) / 2
  const origin = [x, y]
  return vertices.map(function (vertex) {
    return rotate(vertex.position, origin, theta)
  })
}

function getDistance (constraint, measurements) {
  const {base, derived} = measurements
  let baseObj = {}
  for (let i = 0, len = base.length; i < len; i++) {
    const {key, value} = base[i]
    if (constraint.distance === key) {
      return value
    }
    baseObj[key] = value
  }
  // TODO cache these?
  for (let i = 0, len = derived.length; i < len; i++) {
    const {key, value} = derived[i]
    if (constraint.distance === key) {
      return Parser.evaluate(value, baseObj)
    }
  }
  throw new Error('measurement not found')
}

function mergeDistance (vertices, mutable, constraint, measurements) {
  // TODO support > 2
  const constraintVertices = constraint.points.map(function (index) {
    if (index < 0) {
      index = vertices.length + index
    }
    return vertices[index]
  })
  const restingDistance = getDistance(constraint, measurements)
  const toMerge = new Constraint(constraintVertices, {restingDistance, stiffness: 0.9})

  for (let i = 0, len = mutable.length; i < len; i++) {
    const base = mutable[i]
    if (base.points[0] === constraintVertices[0] && base.points[1] === constraintVertices[1]) {
      mutable[i] = toMerge
      return mutable
    }
  }

  mutable.push(toMerge)
  return mutable
}

function mergeDistances (vertices, baseConstraints, distances, measurements) {
  let mutable = baseConstraints.slice()
  for (let i = 0, len = distances.length; i < len; i++) {
    mergeDistance(vertices, mutable, distances[i], measurements)
  }
  return mutable
}

// Distance constraints from initial positions
function verticesToDistances (vertices) {
  const len = vertices.length
  return vertices.map(function (vertex, i) {
    var a = i
    var b = (i + 1) % len
    return new Constraint([vertices[a], vertices[b]], {stiffness: 0.1})
  })
}

// Angle constraints from initial positions
function verticesToAngles (vertices) {
  const len = vertices.length
  return vertices.map(function (vertex, i) {
    var a = i
    var b = (i + 1) % len
    var c = (i + 2) % len
    return new AngleConstraint([vertices[a], vertices[b], vertices[c]], {stiffness: 0.5})
  })
}

function solver (points, constraints, symmetry, measurements, steps = 360) {
  const {distances, angles} = constraints

  if ((!distances || !distances.length) && (!angles || !angles.length)) {
    // Short-circuit
    return {systemPoints: points}
  }

  const inputPoints = points.slice()
  const inputLength = inputPoints.length

  if (symmetry) {
    points = pointsWithSymmetry(points)
  }

  const system = System()
  const baseVertices = points.map(pointToVertex)
  const baseDistances = verticesToDistances(baseVertices)
  const mergedDistances = mergeDistances(baseVertices, baseDistances, distances, measurements)
  const baseAngles = verticesToAngles(baseVertices)
  const mergedAngles = baseAngles

  const systemVertices = baseVertices
  const systemDistances = mergedDistances
  const systemAngles = mergedAngles

  function tick() {
    // Integrate the physics
    system.integrate(baseVertices, 1000/60)

    // Distance constraint solving
    for (let i = 0, len = systemDistances.length; i < len; i++) {
      systemDistances[i].solve()
    }

    // Angle constraint solving
    for (let i = 0, len = systemAngles.length; i < len; i++) {
      systemAngles[i].solve()
    }
  }

  // Tick world synchronously
  for (let i = 0; i < steps; i++) {
    tick()
  }

  // HACK to fix rotation
  const a1 = pointToPosition(inputPoints[0])
  const b1 = pointToPosition(inputPoints[inputLength - 1])
  const outVertices = baseVertices.slice(0, inputLength - 0)
  const a2 = outVertices[0].position
  const b2 = outVertices[outVertices.length - 1].position
  const rotated = verticesRotate(outVertices, a1, b1, a2, b2)

  return {
    systemPoints: rotated.map(positionToPoint),
    systemDistances,
    systemAngles,
  }
}

module.exports = solver
