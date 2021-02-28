// @ts-check
'use strict';

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
