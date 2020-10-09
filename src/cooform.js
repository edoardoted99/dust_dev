// @ts-check
'use strict';

import _ from 'lodash'
import { observable, computed, configure, action } from 'mobx'
import { FormState } from './formstate.js'
import { Angle } from './angle.js'
import { galactic2equatorial, equatorial2galactic } from './coordinates.js'

configure({ enforceActions: 'observed' });

export class CooFormState extends FormState {
  @observable cooSys = 'G';
  @observable object = '';
  @observable lonType = 0;
  @observable latType = 0;
  @observable lonCtr = '';
  @observable latCtr = '';
  @observable lonWdt = '';
  @observable latWdt = '';
  @observable lonMin = '';
  @observable latMin = '';
  @observable lonMax = '';
  @observable latMax = '';

  validators = {
    lonCtr: x => x === '' && 'Please enter a valid coordinate',
    latCtr: x => x === '' && 'Please enter a valid coordinate',
    lonWdt: x => x === '' && 'Please enter a valid width',
    latWdt: x => x === '' && 'Please enter a valid width',
    lonMin: x => x === '' && 'Please enter a valid coordinate',
    latMin: x => x === '' && 'Please enter a valid coordinate',
    lonMax: x => x === '' && 'Please enter a valid coordinate',
    latMax: x => x === '' && 'Please enter a valid coordinate'
  }

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
          this.lonCtr = lon.angle;
          this.latCtr = lat.angle;
          if (size) {
            this.lonWdt = (new Angle(size / (this.cooSys === 'E' ? 15 : 1),
              this.cooSys === 'E' ? 'hms' : 'longitude', 2)).angle;
            this.latWdt = (new Angle(size, 'longitude', 2)).angle;
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

  @computed({ keepAlive: true }) get lonName() {
    return (this.cooSys === 'G') ? 'galactic longitude' : 'right ascension';
  }

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
 * @memberof MyForm1
 */
  cw2mm(ctr, wdt, type) {
    if (ctr === '' || wdt === '') return ['', ''];
    const ctrAngle = new Angle(ctr, type), wdtAngle = new Angle(wdt);
    return _.map(ctrAngle.scaleAdd(wdtAngle, [-0.5, 0.5], [1, 1]), a => a.angle);
  }

  /**
   * Convert min+max angles into center+width angle
   *
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
    this.handleChange(e, { name, value });
  }

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
        this.lonCtr = dstLon.angle;
        this.latCtr = dstLat.angle;
        // Check if we have already entered widths: if so, update the corner coordinates
        if (this.lonWdt) {
          if (dstType !== srcType)
            this.lonWdt = (new Angle(this.lonWdt, dstType)).scale$((value === 'E') ? (1.0 / 15.0) : 15).angle;
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
}
