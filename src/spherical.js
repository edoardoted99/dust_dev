// @ts-check
'use strict';

const d2r = Math.PI / 180.0;
const r2d = 180.0 / Math.PI

/**
 * @typedef {[number, number, number]} vec3d A 3D vector
 */

/**
 * Convert a latitude-longitude into a vector notation
 * @param {number} l Longitude in degrees
 * @param {number} b Latitude in degrees
 * @returns {vec3d} The corresponding vector (an array of three numbers)
 */
export function ang2vec(l, b) {
  const lr = l * d2r, br = b * d2r;
  const cos_l = Math.cos(lr), sin_l = Math.sin(lr), cos_b = Math.cos(br), sin_b = Math.sin(br);
  return [cos_b * cos_l, cos_b * sin_l, sin_b];
}

/**
 * Convert a vector into a longitude-latitude tuple.
 * @param {vec3d} v The vector, as an array of three numbers
 * @returns {[number, number]} The corresponding longitude and latitude, in degrees
 */
export function vec2ang(v) {
  const vn = normalize(v);
  const br = Math.asin(vn[2]);
  const lr = Math.atan2(vn[1], vn[0]);
  return [lr * r2d, br * r2d];
}

/**
 * Compute the scalar product between two 3D vectors
 * @param {vec3d} v 
 * @param {vec3d} w 
 * @returns {number} The scalar product <v, w>
 */
export function dot(v, w) {
  return v[0] * w[0] + v[1] * w[1] + v[2] * w[2];
}

/**
 * Compute the square of the norm of a vector
 * @param {vec3d} v 
 * @returns {number} The result of |v|^2 = <v, v>
 */
export function norm2(v) {
  return dot(v, v);
}

/**
 * Compute the norm of a vector
 * @param {vec3d} v 
 * @returns {number} The value of |v|
 */
export function norm(v) {
  return Math.sqrt(norm2(v));
}

/**
 * Compute the cross product between two 3D vectors
 * @param {vec3d} v 
 * @param {vec3d} w 
 * @returns {vec3d} The resulting v ^ w
 */
export function cross(v, w) {
  return [v[1] * w[2] - v[2] * w[1], v[2] * w[0] - v[0] * w[2], v[0] * w[1] - v[1] * w[0]];
}

/**
 * Normalize a vector, so that its norm is unity
 * @param {vec3d} v 
 * @returns {vec3d} The normalized vector `v`
 */
export function normalize(v) {
  const nrm = norm(v);
  return [v[0] / nrm, v[1] / nrm, v[2] / nrm];
}

/**
 * Compute the angular distance between two vector directions
 * @param {vec3d} v 
 * @param {vec3d} w 
 * @returns {number} The angular distance in degrees
 */
export function angDist(v, w) {
  const vdotw = dot(v, w), vcrossw = norm(cross(v, w));
  return Math.atan(vcrossw / vdotw) * r2d;
}

/**
 * Compute the mid-point between two vector directions
 * @param {vec3d} v 
 * @param {vec3d} w 
 * @returns {vec3d} The mid-point between `v` and `w`.
 */
export function midPoint(v, w) {
  /** @type {vec3d} */
  const result = [(v[0] + w[0]) / 2, (v[1] + w[1]) / 2, (v[2] + w[2]) / 2];
  return normalize(result);
}

/**
 * Compute the vector coordinates of points along a great circle
 * @param {vec3d[]} points An array of `npts` vectors representing the points
 * @param {vec3d} v The starting point of the great circle
 * @param {vec3d} w The final point of the great circle
 * @param {number} [minpoints=5] Minimum number of points; if negative,
 *  the negative of the exact number of points requested
 * @param {number} [maxstep=1] Maximum allwed step size in degrees 
 * along the great circle
 */
export function greatCircle(points, v, w, minpoints = 5, maxstep = 1) {
  /** @type {vec3d} */
  const d = [w[0] - v[0], w[1] - v[1], w[2] - v[2]];  // d = w - v
  const chord = norm(d), alpha = Math.asin(chord / 2);  
  let npts;
  if (minpoints > 0) {
    npts = Math.max(minpoints, Math.ceil(360 * alpha * Math.PI / maxstep));
  } else npts = -minpoints;
  for (let n = 0; n <= npts; n++) {
    const beta = -alpha + 2 * alpha / npts * n;
    let t = Math.sin(beta) / chord + 0.5, t1 = 1 - t;
    /** @type {vec3d} */
    let point = [v[0] * t1 + w[0] * t, v[1] * t1 + w[1] * t, v[2] * t1 + w[2] * t]
    points.push(point);
  }
}

/**
 * Compute a list of the coordinates of a segment in a sphere given its extremes.
 * @param {any[]} points Output array with the point cordinatees
 * @param {number} x0 Longitude of the 1st point in degrees
 * @param {number} y0 Latitude of the 1st point in degrees
 * @param {number} x1 Longitude of the 2nd point in degrees
 * @param {number} y1 Latitude of the 2nd point in degrees
 * @param {number} [minpoints=5] Minimum number of points; if negative, 
 *  the negative of the exact number of points requested
 * @param {number} [maxstep=1] Maximum allwed step size in degrees
 */
export function sphereLine(points, x0, y0, x1, y1, minpoints = 5, maxstep = 1) {
  let dx = x1 - x0, dy = y1 - y0, nsteps;
  if (minpoints > 0) {
    const c = Math.cos((y1 + y0) * Math.PI / 360), len = Math.sqrt(dx * dx + dy * dy * c * c);
    nsteps = Math.max(minpoints, Math.ceil(len / maxstep));
  } else nsteps = -minpoints - 1;
  dx /= nsteps;
  dy /= nsteps;
  for (let n = 0; n < nsteps; n++)
    points.push([x0 + dx * n, y0 + dy * n]);
  points.push([x1, y1]);
}

/**
 * Compute the coordinates of a circle on a sphere given its center and radius.
 * @param {any[]} points Output array with the point coordinates
 * @param {number} x0 Longitude of the center in degrees
 * @param {number} y0 Latitude of the center in degrees
 * @param {number} r Radius of the circle in degrees
 * @param {number} [minpoints=5] Minimum number of points; if negative,
 *  the negative of the exact number of points requested
 * @param {number} [maxstep=1] Maximum allwed step size in degrees
 */
export function sphereCircle(points, x0, y0, r, minpoints = 64, maxstep = 1) {
  const a = r * Math.PI / 180, b = (90 - y0) * Math.PI / 180;
  const cos_a = Math.cos(a), sin_a = Math.sin(a); ``
  const cos_b = Math.cos(b), sin_b = Math.sin(b);
  const nsteps = minpoints > 0 ? Math.max(minpoints, Math.ceil(sin_a * 360 / maxstep) + 1)
    : (-minpoints - 1);
  for (let n = 0; n <= nsteps; n++) {
    let C = 2 * Math.PI / nsteps * n
    let cos_C = Math.cos(C), sin_C = Math.sin(C)
    let cos_c = cos_a * cos_b + sin_a * sin_b * cos_C, sin_c = Math.sqrt(1 - cos_c * cos_c);
    let sin_A = sin_C * sin_a / sin_c;
    // Next line equivalent to cos_A = (cos_a - cos_b * cos_c) / (sin_b * sin_c);
    // but avoids 0/0 in case sin_b ~= 0
    let cos_A = (cos_a * sin_b - sin_a * cos_b * cos_C) / sin_c;
    let A = Math.atan2(sin_A, cos_A);
    points.push([x0 + A * 180 / Math.PI, 90 - Math.acos(cos_c) * 180 / Math.PI]);
  }
}

/**
 * Compute the ranges in longitude and latitude for circle on a sphere given its center and radius.
 * @param {number} x0 Longitude of the center in degrees
 * @param {number} y0 Latitude of the center in degrees
 * @param {number} r Radius of the circle in degrees
 * @returns {[[number, number], [number, number]]} The ranges in longitude and in latitude
 */
export function sphereCircleRanges(x0, y0, r) {
  if (y0 + r > 90)
    return [[0, 360], [y0 - r, 90]];
  else if (y0 - r < -90)
    return [[0, 360], [-90, y0 + r]];
  else {
    const sinA = Math.sin(r * Math.PI / 180) / Math.sin(Math.abs(y0) * Math.PI / 180);
    const A = (sinA < 1) ? Math.asin(sinA) * 180 / Math.PI : 90;
    return [[x0 - A, x0 + A], [y0 - r, y0 + r]];
  }
}

/**
 * Compute the coordinates of the corners of a on a sphere given its center and side lenghts.
 * @param {number} x0 Longitude of the center in degrees
 * @param {number} y0 Latitude of the center in degrees
 * @param {number} w Width of the box in degrees
 * @param {number} h Height of the box in degrees
 * @returns {vec3d[]} Corners
 */
export function sphereBoxCorners(x0, y0, w, h) {
  let up = ang2vec(x0, 90 + y0 + h / 2);
  let down = ang2vec(x0, 90 + y0 - h / 2);
  let b = y0 * Math.PI / 180, cos_b = Math.cos(b), sin_b = Math.sin(b);
  let delta_l = Math.atan(Math.tan(w / 360 * Math.PI) * cos_b) / Math.PI * 180;
  let delta_b = Math.asin(Math.sin(w / 360 * Math.PI) * sin_b) / Math.PI * 180;
  let left = ang2vec(x0 + 90 + delta_l, -delta_b);
  let right = ang2vec(x0 + 90 - delta_l, delta_b);
  let ul = cross(left, up), ur = cross(right, up);
  let dl = cross(left, down), dr = cross(right, down);
  return [ur, ul, dl, dr];
}

/**
 * Compute the coordinates of a box on a sphere given its center and side lenghts.
 * @param {any[]} points Output array with the point coordinates
 * @param {vec3d[]} corners The corners of the box as returned by `sphereBoxCorners`
 * @param {number} [minpoints=5] Minimum number of points along each great cirle;
 *  if negative, the negative of the exact number of points requested
 * @param {number} [maxstep=1] Maximum allwed step size in degrees along each great circle
 */
export function sphereBox(points, corners, minpoints = 5, maxstep = 1) {
  let vpoints = [];
  greatCircle(vpoints, corners[0], corners[1], minpoints, maxstep);
  greatCircle(vpoints, corners[1], corners[2], minpoints, maxstep);
  greatCircle(vpoints, corners[2], corners[3], minpoints, maxstep);
  greatCircle(vpoints, corners[3], corners[0], minpoints, maxstep);
  let npts = vpoints.length;
  for (let n = 0; n < npts; n++)
    points.push(vec2ang(vpoints[n]));
}

/**
 * Compute the ranges in longitude and latitude for a box on a sphere given its center and sidelenghts.
 * @param {number} x0 Longitude of the center in degrees
 * @param {number} y0 Latitude of the center in degrees
 * @param {number} w Width of the box in degrees
 * @param {number} h Height of the box in degrees
 * @returns {[[number, number], [number, number]]} The ranges in longitude and in latitude
 */
export function sphereBoxRanges(corners, x0, y0, w, h) {
  if (y0 + h/2 > 90)
    return [[0, 360], [y0 - h/2, 90]];
  else if (y0 - h/2 < -90)
    return [[0, 360], [-90, y0 + h/2]];
  else {
    const angles = corners.map(vec2ang);
    let lonMax = Math.max(angles[0][0], angles[1][0], angles[2][0], angles[3][0]);
    let lonMin = Math.min(angles[0][0], angles[1][0], angles[2][0], angles[3][0]);
    let latMax = Math.max(angles[0][1], angles[1][1], angles[2][1], angles[3][1]);
    let latMin = Math.min(angles[0][1], angles[1][1], angles[2][1], angles[3][1]);
    let lonMean = (lonMax + lonMin) / 2;
    if (lonMean - x0 > 90) lonMin -= 360;
    if (lonMean - x0 < -90) lonMax += 360
    return [[lonMin, lonMax], [latMin, latMax]];
  }
}

