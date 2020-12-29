// @ts-check
'use strict';

import _ from 'lodash'
import { observable, computed, configure, action } from 'mobx'
import { FormState } from './formstate.js'
import { Angle } from './angle.js'
import { galactic2equatorial, equatorial2galactic } from './coordinates.js'

configure({ enforceActions: 'observed' });

/**
 * A class for coordinate range form states.
 * 
 * This class makes it simple to work with forms that allow the input of coordinate ranges.
 * The input is recognized in various coordinate systems (see `cooSys`), and as center+width
 * or as min+max, for both the longitude and latitudes.
 * @export
 * @class CooFormState
 */
export class CooFormState extends FormState {
  /**
   * The chosen coordinate system: Galactic, Equatorial, or Decimal equatorial.
   * @type {'G'|'E'|'D'}
   * @memberof CooFormState
   */
  @observable cooSys = 'G';

  /**
   * The object name, used with Sesame resolution.
   * @type {string}
   * @memberof CooFormState
   */
  @observable object = '';

  /**
   * The type of input for the longitude.
   * 0: undefined; 1: center and width; 2: min and max; 3: graphic input
   * @type {0|1|2|3}
   * @memberof CooFormState
   */
  @observable lonType = 0;

  /**
   * The type of input for the latitude.
   * 0: undefined; 1: center and width; 2: min and max; 3: graphic input
   * @type {0|1|2|3}
   * @memberof CooFormState
   */
  @observable latType = 0;

  /**
   * The longitude center, in flexible string format.
   * @type {string}
   * @memberof CooFormState
   */
  @observable lonCtr = '';

  /**
   * The latitude center, in flexible string format.
   * @type {string}
   * @memberof CooFormState
   */
  @observable latCtr = '';

  /**
   * The longitude width, in flexible string format.
   * @type {string}
   * @memberof CooFormState
   */
  @observable lonWdt = '';

  /**
   * The latitude width, in flexible string format.
   * @type {string}
   * @memberof CooFormState
   */
  @observable latWdt = '';

  /**
   * The minimum longitude, in flexible string format.
   * @type {string}
   * @memberof CooFormState
   */
  @observable lonMin = '';

  /**
   * The minimum latitude, in flexible string format.
   * @type { string }
   * @memberof CooFormState
   */
  @observable latMin = '';

  /**
   * The maximum longitude, in flexible string format.
   * @type { string }
   * @memberof CooFormState
   */
  @observable lonMax = '';

  /**
   * The maximum latitude, in flexible string format.
   * @type { string }
   * @memberof CooFormState
   */
  @observable latMax = '';
  // FIXME: is this necessary? @observable state = 'UNDEF';

  /**
   * The computed number of stars in this field.
   * @type { number }
   * @memberof CooFormState
   */
  @observable nstars = 0;

  /**
   * The job urls associated to the queries of this field.
   * @type { string[] }
   * @memberof CooFormState
   */
  @observable job_urls = [];

  validators = {
    lonCtr: x => x.length <= 1 && 'Please enter a valid coordinate',
    latCtr: x => x.length <= 1 && 'Please enter a valid coordinate',
    lonWdt: x => x.length <= 1 && 'Please enter a valid width',
    latWdt: x => x.length <= 1 && 'Please enter a valid width',
    lonMin: x => x.length <= 1 && 'Please enter a valid coordinate',
    latMin: x => x.length <= 1 && 'Please enter a valid coordinate',
    lonMax: x => x.length <= 1 && 'Please enter a valid coordinate',
    latMax: x => x.length <= 1 && 'Please enter a valid coordinate'
  }

  @computed({ keepAlive: true }) get lonCtrAngle() {
    return new Angle(this.lonCtr, (this.cooSys === 'E') ? 'hms' : 'longitude');
  }
  set lonCtrAngle(angle) { this.lonCtr = angle.angle; }
  @computed({ keepAlive: true }) get latCtrAngle() {
    return new Angle(this.latCtr, 'latitude');
  }
  set latCtrAngle(angle) { this.latCtr = angle.angle; }
  @computed({ keepAlive: true }) get lonWdtAngle() {
    return new Angle(this.lonWdt, (this.cooSys === 'E') ? 'hms' : 'longitude');
  }
  set lonWdtAngle(angle) { this.lonWdt = angle.angle; }
  @computed({ keepAlive: true }) get latWdtAngle() {
    return new Angle(this.latWdt, 'latitude');
  }
  set latWdtAngle(angle) { this.latWdt = angle.angle; }
  @computed({ keepAlive: true }) get lonMinAngle() {
    return new Angle(this.lonMin, (this.cooSys === 'E') ? 'hms' : 'longitude');
  }
  set lonMinAngle(angle) { this.lonMin = angle.angle; }
  @computed({ keepAlive: true }) get latMinAngle() {
    return new Angle(this.latMin, 'latitude');
  }
  set latMinAngle(angle) { this.latMin = angle.angle; }
  @computed({ keepAlive: true }) get lonMaxAngle() {
    return new Angle(this.lonMax, (this.cooSys === 'E') ? 'hms' : 'longitude');
  }
  set lonMaxAngle(angle) { this.lonMax = angle.angle; }
  @computed({ keepAlive: true }) get latMaxAngle() {
    return new Angle(this.latMax, 'latitude');
  }
  set latMaxAngle(angle) { this.latMax = angle.angle; }

  /**
   * Return the area of the current field, in square degrees.
   *
   * @type {number}
   * @readonly
   * @memberof CooFormState
   */
  @computed({ keepAlive: true }) get area() {
    let lonMin = this.lonMinAngle.degrees, lonMax = this.lonMaxAngle.degrees,
      latMin = this.latMinAngle.degrees, latMax = this.latMaxAngle.degrees;
    if (lonMin > lonMax) lonMin -= 360;
    return Math.abs((lonMax - lonMin) * 180.0 / Math.PI *
      (Math.sin(latMax * Math.PI / 180.0) - Math.sin(latMin * Math.PI / 180.0)));
  }

  /**
   * Return the object density of the current field, in objects per square degree.
   * @type {number}
   * @readonly
   * @memberof CooFormState
   */
  @computed({ keepAlive: true }) get density() {
    return this.nstars / this.area;
  }

  /**
   * Handle an object change event and call the SIMBAD server with the object name.
   * @param {React.SyntheticEvent} e - The event generating the call
   * @param {Object} o - The object associated to the event `e`
   * @memberof CooFormState
   */
  @action.bound handleSimbad(e, o) {
    if (this.object.match(/^\s*$/)) return;
    let xhr = new XMLHttpRequest();
    const url = 'http://simbad.u-strasbg.fr/simbad/sim-id?output.format=ASCII&' +
      'obj.coo1=on&frame1=ICRS&epoch1=J2000&equi1=2000&coodisp1=s2&' +
      'obj.coo2=on&frame2=ICRS&epoch2=J2000&equi2=2000&coodisp2=d2&' +
      'obj.coo3=on&frame3=GAL&epoch3=J2000&equi3=2000&coodisp3=d2&' +
      'obj.coo4=off&obj.bibsel=off&Ident=' + escape(this.object);
    xhr.open('GET', url);
    xhr.onload = action(() => {
      if (xhr.status === 200) {
        let data = xhr.responseText, m, lon, lat, size = null;
        m = data.match(/Angular size:\s* ([^ ]+)\s*([^ \n\r]+)?/i);
        if (m) {
          if (m[2]) size = _.max([parseFloat(m[1]), parseFloat(m[2])]);
          else size = parseFloat(m[1]);
        }
        if (this.cooSys === 'G') {
          m = data.match(/Coordinates\(GAL,.*\):\s* ([^ ]+)\s*([^ \n\r]+)/i);
          if (m) {
            lon = new Angle(parseFloat(m[1]), 'longitude');
            lat = new Angle(parseFloat(m[2]), 'latitude');
          }
        } else if (this.cooSys === 'D') {
          m = data.match(/Coordinates\(ICRS,.*\):\s* ([^ ]+)\s*([^ \n\r]+)\s*$/im);
          if (m) {
            lon = new Angle(parseFloat(m[1]), 'longitude');
            lat = new Angle(parseFloat(m[2]), 'latitude');
          }
        } else {
          // m = data.match(/Coordinates\(ICRS,.*\):\s* ([^ ]+)\s*([^ ]+)\s*([^ ]+)\s*([^ ]+)\s*([^ ]+)\s*([^ \n\r]+)/i);
          m = data.match(/Coordinates\(ICRS,.*\):\s* ([^ ]+)\s*([^ \n\r]+)\s*$/im);
          if (m) {
            lon = new Angle(parseFloat(m[1]) * 240, 'hms', 3);
            lat = new Angle(parseFloat(m[2]) * 3600, 'latitude', 3);
          }
        }
        if (m) {
          this.messageType = null;
          this.lonCtrAngle = lon;
          this.latCtrAngle = lat;
          if (size) {
            const c = Math.cos(lat.degrees * Math.PI / 180.0)
            this.lonWdtAngle = (new Angle(size / c / (this.cooSys === 'E' ? 15 : 1),
              this.cooSys === 'E' ? 'hms' : 'longitude', 2));
            this.latWdtAngle = (new Angle(size, 'longitude', 2));
          } else this.lonWdt = this.latWdt = '';
          this.errors.object = false;
          this.handleLinkedChange(e, { name: 'lonWdt', value: this.lonWdt });
          this.handleLinkedChange(e, { name: 'latWdt', value: this.latWdt });
        } else this.errors.object = 'Simbad could not resolve this object name';
      } else this.errors.object = 'Connection error to Simbad';
    });
    xhr.onerror = action(() => this.errors.object = 'Connection error to Simbad');
    xhr.send();
  }

  /**
   * Return the name of the current longitude, depending on `cooSys`.
   * @type {'galactic longitude'|'right ascension'}
   * @readonly
   * @memberof CooFormState
   */
  @computed({ keepAlive: true }) get lonName() {
    return (this.cooSys === 'G') ? 'galactic longitude' : 'right ascension';
  }

  /**
   * Return the name of the current latitude, depending on `cooSys`.
   * @type {'galactic latitude'|'declination'}
   * @readonly
   * @memberof CooFormState
   */
  @computed({ keepAlive: true }) get latName() {
    return (this.cooSys === 'G') ? 'galactic latitude' : 'declination';
  }

  /**
   * Convert center+width angles into min+max angles
   *
   * @param {String} ctr The central angle
   * @param {String} wdt The width angle
   * @param {'longitude'|'latitude'|'hms'} type The coordinate type
   * @return {String[]} An array with the minimum and maximum angles
   * @memberof CooFormState
   */
    cw2mm(ctr, wdt, type) {
    if (ctr === '' || wdt === '') return ['', ''];
    const ctrAngle = new Angle(ctr, type), wdtAngle = new Angle(wdt);
    return _.map(ctrAngle.scaleAdd(wdtAngle, [-0.5, 0.5], [1, 1]), a => a.angle);
  }

  /**
   * Convert min+max angles into center+width angle
   * @param {String} min The central angle
   * @param {String} max The width angle
   * @param {'longitude'|'latitude'|'hms'} type The coordinate type
   * @return {String[]} An array with the center and width
   * @memberof MyForm1
   */
  mm2cw(min, max, type) {
    if (min === '' || max === '') return ['', ''];
    const minAngle = new Angle(min, type), maxAngle = new Angle(max, type);
    let resAngle;
    if (type !== 'latitude' && (maxAngle.degrees < minAngle.degrees)) {
      resAngle = minAngle.scaleAdd(maxAngle, [0.5, 1], [0.5, -1]);
      resAngle[0].degrees += 180;
    } else resAngle = minAngle.scaleAdd(maxAngle, [0.5, 1], [0.5, -1]);
    return _.map(resAngle, a => a.angle);
  }

  /**
   * Handle a change event in any of the coordinate fields.
   * @param {React.SyntheticEvent} e - The event generating the call
   * @param {Object} o - The object associated to the event `e`
   * @memberof CooFormState
   */
  @action.bound handleLinkedChange(e, { name, value }) {
    const lonlat = name.substr(0, 3), rest = name.substr(3), isCorner = name[3] === 'M';
    const type = (lonlat === 'lat') ? 'latitude' : ((this.cooSys === 'E') ? 'hms' : 'longitude');
    if (isCorner) {
      let [ctr, wdt] = this.mm2cw(
        (rest === 'Min') ? value : this[lonlat + 'Min'],
        (rest === 'Max') ? value : this[lonlat + 'Max'], type);
      this[lonlat + 'Type'] = 2;
      this[lonlat + 'Ctr'] = ctr;
      this[lonlat + 'Wdt'] = wdt;
    } else {
      let [min, max] = this.cw2mm(
        (rest === 'Ctr') ? value : this[lonlat + 'Ctr'],
        (rest === 'Wdt') ? value : this[lonlat + 'Wdt'], type);
      this[lonlat + 'Type'] = 1;
      this[lonlat + 'Min'] = min;
      this[lonlat + 'Max'] = max;
    }
    this.messageType = null;
    this.handleChange(e, { name, value });
  }

  /**
   * Handle a change coordinate system event.
   * @param {React.SyntheticEvent} e - The event generating the call
   * @param {Object} o - The object associated to the event `e`
   * @memberof CooFormState
   */
  @action.bound handleCooSys(e, { name, value }) {
    const frames = { 'G': 'g', 'E': 'e', 'D': 'e', '': '' };
    const srcType = (this.cooSys === 'E') ? 'hms' : 'longitude';
    const dstType = (value === 'E') ? 'hms' : 'longitude';
    if (frames[value] === frames[this.cooSys]) {
      // Just a change of units: proceeds
      const fields = ['lonCtr', 'lonWdt', 'lonMin', 'lonMax'];
      for (let field of fields)
        if (this[field])
          this[field] = (new Angle(this[field], dstType))
            .scale$((value === 'E') ? (1.0 / 15.0) : 15).angle;
    } else {
      this.messageType = null;
      if (this.lonCtr === '' || this.latCtr === '') {
        // One field is missing: clear everything!
        const fields = ['lonCtr', 'latCtr', 'lonMin', 'lonMax', 'latMin', 'latMax'];
        for (let field of fields) this[field] = '';
      } else {
        // Parse the longitude and latitude
        const srcLon = new Angle(this.lonCtr, srcType), srcLat = new Angle(this.latCtr, 'latitude');
        let dstLon = new Angle(new Array(srcLon.values.length), dstType)
        let dstLat = new Angle(new Array(srcLat.values.length), 'latitude');
        // Perform the coordinate transformation
        if (value === 'G') [dstLon.degrees, dstLat.degrees] = equatorial2galactic(srcLon.degrees, srcLat.degrees);
        else[dstLon.degrees, dstLat.degrees] = galactic2equatorial(srcLon.degrees, srcLat.degrees);
        // Update the state
        this.lonCtrAngle = dstLon;
        this.latCtrAngle = dstLat;
        // Check if we have already entered widths: if so, update the corner coordinates
        if (this.lonWdt) {
          if (dstType !== srcType)
            this.lonWdtAngle = (new Angle(this.lonWdt, dstType)).scale$((value === 'E') ? (1.0 / 15.0) : 15);
          const [min, max] = this.cw2mm(this.lonCtr, this.lonWdt, dstType);
          this.lonType = 1;
          this.lonMin = min;
          this.lonMax = max;
        }
        if (this.latWdt) {
          const [min, max] = this.cw2mm(this.latCtr, this.latWdt, 'latitude');
          this.latType = 1;
          this.latMin = min;
          this.latMax = max;
        }
      }
    }
  }

  /**
   * Copy the relevant fields from another `CooFormState`.
   * @param {CooFormState} orig - The object to copy from.
   * @memberof CooFormState
   */
  @action.bound copyFrom(orig) {
    for (let field of ['cooSys', 'lonType', 'latType', 'lonCtr', 'latCtr', 'lonWdt', 'latWdt',
      'lonMin', 'latMin', 'lonMax', 'latMax', 'messageType', 'messageHeader', 'messageContent',
      'nstars', 'job_urls'])
      this[field] = _.clone(orig[field]);
  }
}
