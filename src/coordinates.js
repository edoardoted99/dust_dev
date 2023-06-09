// @ts-check
'use strict';


/* Formulae are taken from
 * https://www.aanda.org/articles/aa/full_html/2011/02/aa14961-10/aa14961-10.html
 */

/**
 * Perform a spherical coordinate transformation.
 * @param {[lon: number, lat: number]} p The coordinates (lon, lat) of the point, in degrees
 * @param {number[]} rot The rotation matrix as a number[9] vector
 * @return {[lon: number, lat: number]} The transformed coordinates, in degrees
 * Note that `p` is modified by this function (that is: the function is not 
 * pure!).
 */
function transform(p, rot) {
  const d2r = Math.PI / 180, r2d = 180 / Math.PI;	
  p[0] *= d2r;
  p[1] *= d2r;
  let cp1 = Math.cos(p[1]);
  let m = [Math.cos(p[0]) * cp1, Math.sin(p[0]) * cp1, Math.sin(p[1])];
  let s = [m[0] * rot[0] + m[1] * rot[1] + m[2] * rot[2], m[0] * rot[3] + m[1] * rot[4] +
    m[2] * rot[5], m[0] * rot[6] + m[1] * rot[7] + m[2] * rot[8]];
  let r = Math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]);
  let b = Math.asin(s[2] / r); // Declination in range -90 -> +90
  let cb = Math.cos(b);
  let a = Math.atan2(((s[1] / r) / cb), ((s[0] / r) / cb));
  if (a < 0) a += 2 * Math.PI;
  return [a * r2d, b * r2d];
}


/**
 * Convert galactic coordinates into equatorial ones.
 * @param {number} l Galactic longitude, in degrees
 * @param {number} b Galactic latitude, in degrees
 * @param {'FK4'|'B1950'|'1950'|'FK5'|'J2000'|'2000'} [epoch='J2000'] The epoch: 'FK4'='B1950'='1950' or 'FK5'='J2000'='2000'
 * @return {[ra: number, dec: number]} The corresponding [ra, dec] vector, in degrees
 */
export function galactic2equatorial(l, b, epoch = 'J2000') {
  let t;
  if (epoch == '1950' || epoch == 'B1950' || epoch == 'FK4')
    t = [-0.066988739415, 0.492728466075, -0.867600811151,
      -0.872755765852, -0.450346958020, -0.188374601723,
      -0.483538914632, 0.744584633283, 0.460199784784];
  else
    t = [-0.054875539390, 0.494109453633, -0.867666135681,
         -0.873437104725, -0.444829594298, -0.198076389622,
         -0.483834991775, 0.746982248696, 0.455983794523];
  return transform([l, b], t);
}

/**
 * Convert galactic coordinates into equatorial ones.
 * @param {number} ra Right Ascension, in degrees
 * @param {number} dec Declination, in degrees
 * @param {string} [epoch='J2000'] The epoch: 'FK4'='B1950'='1950' or 'FK5'='J2000'='2000'
 * @return {[l: number, b: number]} The corresponding [l, b] vector, in degrees
 */
export function equatorial2galactic(ra, dec, epoch = 'J2000') {
  let t;
  if (epoch == '1950' || epoch == 'B1950' || epoch == 'FK4')
    t = [-0.066988739415, -0.872755765852, -0.483538914632,
      0.492728466075, -0.450346958020, 0.744584633283,
    -0.867600811151, -0.188374601723, 0.460199784784];
  else
    t = [-0.054875539390, -0.873437104725, -0.483834991775,
        0.494109453633, -0.444829594298,  0.746982248696,
        -0.867666135681, -0.198076389622,  0.455983794523];
  return transform([ra, dec], t);
}