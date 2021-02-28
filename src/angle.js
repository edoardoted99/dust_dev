// @ts-check
'use strict';

import _ from 'lodash'

/**
 * A class to save and perform operations on an Angle.
 * @export
 * @class Angle
 */
export class Angle {
  /**
   * The angle value, as an array of numbers (degrees, minutes, seconds).
   * 
   * Depending on the value length, the angle is entered as degree.fraction (length=1),
   * degree arcmin.fraction (length=2), or degree arcmin arcsec.fraction (length=3).
   * Hence, only the last element of this array can have fractional values.
   * @type {number[]}
   * @memberof Angle
   */
  values = [0.0];
  
  /** 
   * The angle type.
   * @type {'latitude'|'longitude'|'hms'} 
   * @memberof Angle
   */
  type = 'latitude';

  /**
   * The precisioon used to display the angle, expressed as total number of digits.
   * @type {number}
   * @memberof Angle
   */
  precision = 7;

  /**
   * Creates an instance of Angle.
   * @param {number|number[]|string|Angle} [value=0] The initial value
   * @param {'latitude'|'longitude'|'hms'} [type='latitude'] The angle type
   * @param {number} [numFields=1] The requested number of fields; used only if value is a number
   * @param {number} [precision=7] The angle precision
   * @memberof Angle
   */
  constructor(value = 0, type = 'latitude', numFields = 1, precision=7) {
    this.type = type;
    this.precision = precision;
    if (_.isNumber(value)) {
      if (numFields) this.values = new Array(numFields);
      this.value = value;
    } else if (_.isArray(value)) this.values = value;
    else if (_.isString(value)) this.angle = value;
    else if (value.constructor === Angle) {
      this.values = value.values;
      this.type = value.type
      this.precision = value.precision;
    }
  }

  /**
   * Parse an angle string and return the numeric fields.
   * @memberof Angle
   * ```
   * "–12° 34' 56".789"  =>  [-12, -34, -56.789];
   * "–12° 34'.567"  =>  [-12, -34.567];
   * "+12°.3456"  =>  [12.3456];
   * "12ʰ 34ᵐ 56ˢ.7"  =>  [12, 34, 56.7];
   * "12ʰ 34ᵐ.56"  =>  [12, 34.56];
   * "12:34.56"  =>  [12, 34.56]
   * ```
   */
  set angle(angle) {
    this.values = angle.replace(/[°'"ʰᵐˢhdms:]/g, ' ').replace(/[–—-]/, '').replace(/ *\./, '.').trim()
      .split(/ +/).map(parseFloat);
    // Fix negative values
    if (angle[0] === '-' || angle[0] === '–' || angle[0] === '—') {
      _.forEach(this.values, (v, i) => { this.values[i] = -this.values[i]; });
    }
  }

  /**
   * Return the angle string corresponding to the current Angle.
   * @memberof Angle
   */
  get angle() {
    let res = [], neg = false, len = this.values.length, markers, basePrecision = this.precision;
    if (this.type === 'hms') {
      markers = 'ʰᵐˢ'
      basePrecision += 1
    } else markers = '°\'"';
    let x = new Angle(_.round(this.value, basePrecision - len * 2), this.type, len, basePrecision);
    for (let i = 0; i < len; i++) {
      let v = Math.abs(x.values[i]), s
      s = v.toFixed(basePrecision - i * 2).replace(/0*$/, '').replace('.', markers[i] + '.').replace(/\.$/, '');
      neg = neg || (x.values[i] < 0);
      res.push(s);
    }
    if (this.type === 'latitude') res[0] = (neg ? '–' : '+') + res[0];
    return res.join(' ');
  }

  /**
   * Convert a number into an angle, using the current number of fields.
   * @param value {number} The value to store, in units of the smallest field.
   * @memberof Angle
   */
  set value(value) {
    const numFields = this.values.length;
    const mod = ((this.type === 'hms') ? 24 : ((this.type === 'longitude') ? 360 : 90)) * Math.pow(60, numFields - 1);
    var d = (this.type === 'latitude') ? _.clamp(value, -mod, mod) : (value - Math.floor(value / mod) * mod);
    for (let n = numFields-1; n > 0; n--) {
      this.values[n] = d % 60;
      d = Math.trunc(d / 60);
    }
    this.values[0] = d;
  }

  /**
   * Return the numeric value of an number in units of the smallest field.
   * @memberof Angle
   */
  get value() {
    return _.reduce(this.values, (acc, field) => acc*60 + field, 0);
  }

  /**
  * Convert a number into an angle. This is a scaled version of `value`.
  * @param value {number} The value to store, in units of degrees.
  * @memberof Angle
  */
  set degrees(value) {
    let factor = Math.pow(60, this.values.length - 1);
    if (this.type === 'hms') factor /= 15;
    this.value = value * factor;
  }

  /**
   * Return the numeric value of an angle in units of degrees.
   * @memberof Angle
   */
  get radians() {
    return this.degrees * Math.PI / 180;
  }

  /**
  * Convert a number into an angle. This is a scaled version of `value`.
  * @param value {number} The value to store, in units of degrees.
  * @memberof Angle
  */
  set radians(value) {
    this.degrees = value * 180 / Math.PI;
  }

  /**
   * Return the numeric value of an angle in units of degrees.
   * @memberof Angle
   */
  get degrees() {
    let factor = Math.pow(60, this.values.length - 1);
    if (this.type === 'hms') factor /= 15;
    return this.value / factor;
  }


  /**
   * Scale an `Angle` by a given factor
   * @param {number} factor
   * @return {Angle} The newly allocated scaled angle
   * @memberof Angle
   */
  scale(factor) {
    var result = new Angle(this);
    result.value = result.value * factor;
    return result;
  }

  /**
   * In-place scaling of an `Angle`.
   * @param {number} factor
   * @return {this} The modified scaled angle
   * @memberof Angle
   */
  scale$(factor) {
    this.value = this.value * factor;
    return this;
  }

  /**
   * Returns the result of cofactor * this + factor * angle
   * @param {Angle} angle The angle to use as argumeent
   * @param {number|number[]} [factors=1] The scaling factor[s] for angle
   * @param {number|number[]} [cofactors=1] The scaling cofactor[s] for this
   * @return {Angle[]} The computed expression
   * @memberof Angle
   */
  scaleAdd(angle, factors = 1, cofactors = 1) {
    let value1 = 0, value2 = 0, numFields = 0;
    let factorsArray = _.castArray(factors), cofactorsArray = _.castArray(cofactors);
    for (let n = 0; n < 3; n++) {
      if (this.values[n] === undefined && angle.values[n] === undefined) break;
      value1 *= 60;
      value2 *= 60;
      if (this.values[n]) value1 += this.values[n];
      if (angle.values[n]) value2 += angle.values[n];
      numFields += 1;
    }
    // Computes the results
    return _.map(factorsArray, (f, n) => new Angle(value1*cofactorsArray[n] + value2*f, this.type, numFields));
  }

  valueOf() {
    return this.value;
  }

  toString() {
    return this.angle;
  }
}
