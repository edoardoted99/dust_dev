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
   * The selection: rectangle or circle.
   * @type {'R'|'C'}
   * @memberof CooFormState
   */
  @observable shape = 'C';

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
   * The radius, in flexible string format.
   * @type {string}
   * @memberof CooFormState
   */
  @observable radius = '';

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

  /**
   * An object containing information on the ADQL query; see `get adqlComponents` in form0.
   * @memberof CooFormState
   */
  adqlComponents = {};

  cachedCheck = {};

  validators = {
    lonCtr: x => x.length <= 1 && 'Please enter a valid coordinate',
    latCtr: x => x.length <= 1 && 'Please enter a valid coordinate',
    radius: x => (this.shape === 'C' && x.length <= 1) && 'Please enter a valid radius',
    lonWdt: x => (this.shape === 'R' && x.length <= 1) && 'Please enter a valid width',
    latWdt: x => (this.shape === 'R' && x.length <= 1) && 'Please enter a valid width',
    lonMin: x => (this.shape === 'R' && x.length <= 1) && 'Please enter a valid coordinate',
    latMin: x => (this.shape === 'R' && x.length <= 1) && 'Please enter a valid coordinate',
    lonMax: x => (this.shape === 'R' && x.length <= 1) && 'Please enter a valid coordinate',
    latMax: x => (this.shape === 'R' && x.length <= 1) && 'Please enter a valid coordinate',
    // Empty validators, used to update the step in index.jsx
    cooSys: x => false,
    shape: x => false,
    object: x => false,
    lonType: x => false,
    latType: x => false
  };

  cooValidate() {
    const keys = ['lonCtr', 'latCtr', 'radius', 'lonWdt', 'latWdt', 'lonMin', 'latMin', 'lonMax', 'latMax'];
    for (let k of keys)
      if (this.validators[k](this[k])) return false;
    return true;
  }

  @action setMessage(delay = 500, startQuery = false, cbStart = null, cbSuccess = null, cbFail = null) {
    const axios = require('axios').default;
    const keys = ['lonCtr', 'latCtr', 'radius', 'lonWdt', 'latWdt', 'lonMin', 'latMin', 'lonMax', 'latMax',
      'coo_sys', 'shape', 'step'];
    let skipWait = false;
    if (this.cooValidate()) {
      // Check if the call is a duplicated one
      if (this.timeout === null && _.isEqual(_.pick(this, keys), this.cachedCheck)) {
        if (this.messageType === 'success') skipWait = true;
        else return;
      } else this.cachedCheck = _.pick(this, keys);
      if (!skipWait) {
        this.messageType = 'info';
        this.messageHeader = 'Checking selected area';
        this.messageContent = 'Estimating the number of objects in the selected area...';
        if (cbStart) cbStart();
      }
      if (this.timeout) clearTimeout(this.timeout);
      this.timeout = setTimeout(action(() => {
        this.timeout = null;
        axios
          .post('/app/count_stars', {
            ...this.adqlComponents,
            shape: this.shape,
            lon_ctr: this.lonCtrAngle.degrees,
            lon_wdt: this.lonWdtAngle.degrees,
            lat_ctr: this.latCtrAngle.degrees,
            lat_wdt: this.latWdtAngle.degrees,
            radius: this.radiusAngle.degrees,
            lon_min: this.lonMinAngle.degrees,
            lon_max: this.lonMaxAngle.degrees,
            lat_min: this.latMinAngle.degrees,
            lat_max: this.latMaxAngle.degrees,
            coo_sys: this.cooSys === 'D' ? 'E' : this.cooSys,
            step: this.step,
            start_query: startQuery
          }, { timeout: 30000 })
          .then(action(response => {
            this.nstars = response.data.nstars;
            this.job_urls = response.data.job_urls;
            if (!skipWait) {
              this.messageProps = response.data.message;
              if (this.messageType === 'success') {
                if (cbSuccess) cbSuccess(response.data);
              } else {
                if (cbFail) cbFail(response.data);
              }
            }
          }))
          .catch(action(error => {
            console.log(error);
            this.messageType = 'error';
            this.messageHeader = 'Server error';
            this.messageContent = 'Could not establish a connectiong with the server. Try again later.';
            if (cbFail) cbFail(error);
          }));
      }), delay);
    } else {
      this.messageType = null;
      this.messageHeader = 'Warning';
      this.messageContent = 'Please fill all the coordinate data.';
    }
    if (skipWait && cbSuccess) cbSuccess();
  }

  @computed({ keepAlive: true }) get lonCtrAngle() {
    return new Angle(this.lonCtr, (this.cooSys === 'E') ? 'hms' : 'longitude');
  }
  set lonCtrAngle(angle) { this.lonCtr = angle.angle; }
  @computed({ keepAlive: true }) get latCtrAngle() {
    return new Angle(this.latCtr, 'latitude');
  }
  set latCtrAngle(angle) { this.latCtr = angle.angle; }
  @computed({ keepAlive: true }) get radiusAngle() {
    return new Angle(this.radius, 'longitude');
  }
  set radiusAngle(angle) { this.radius = angle.angle; }
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
    const r2d = 180 / Math.PI
    if (this.shape === 'R') {
      let lonMin = this.lonMinAngle.radians, lonMax = this.lonMaxAngle.radians,
        latMin = this.latMinAngle.radians, latMax = this.latMaxAngle.radians;
      if (lonMin > lonMax) lonMin -= 2 * Math.PI;
      return Math.abs((lonMax - lonMin) * r2d * r2d *
        (Math.sin(latMax) - Math.sin(latMin)));
    } else {
      return (1 - Math.cos(this.radiusAngle.radians)) * 360.0 * r2d;
    }
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
          this.lonCtrAngle = lon;
          this.latCtrAngle = lat;
          if (size) {
            if (this.shape === 'R') {
              const c = Math.cos(lat.radians)
              this.lonWdtAngle = (new Angle(size / c / (this.cooSys === 'E' ? 15 : 1),
                this.cooSys === 'E' ? 'hms' : 'longitude', 2));
              this.latWdtAngle = (new Angle(size, 'longitude', 2));
            } else this.radiusAngle = (new Angle(size / 2, 'longitude', 2));
          } else this.lonWdt = this.latWdt = this.radius = '';
          this.errors.object = false;
          if (this.shape === 'R') {
            this.handleLinkedChange(e, { name: 'lonWdt', value: this.lonWdt });
            this.handleLinkedChange(e, { name: 'latWdt', value: this.latWdt });
          }
          this.setMessage();
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
    if (name !== 'radius') {
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
    }
    this.handleChange(e, { name, value });
    this.setMessage();
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
    this.setMessage();
  }

  @action.bound handleShapeChange(e, { name, value, checked }) {
    const c = Math.cos(this.latCtrAngle.radians);
    this.handleChange(e, { name, value, checked });
    if (value === 'C' && checked) {
      if (this.lonWdt && this.latWdt) {
        const numFields = Math.max(this.lonWdtAngle.values.length, this.latWdtAngle.values.length);
        const radius = new Angle(0, 'longitude', numFields);
        radius.degrees = Math.sqrt(this.lonWdtAngle.degrees * this.latWdtAngle.degrees * c) / 2;
        this.radius = radius.angle;
      } else this.radius = '';
      this.setMessage();
    } else {
      let lonWdt = '', latWdt = '';
      if (this.radius) {
        lonWdt = ((new Angle(this.radius, 'longitude')).scale$(2 / c)).angle;
        latWdt = (new Angle(this.radius, 'longitude').scale$(this.cooSys === 'E' ? 2 / 15 : 2)).angle;
      }
      this.handleLinkedChange(e, { name: 'lonWdt', value: lonWdt });
      this.handleLinkedChange(e, { name: 'latWdt', value: latWdt });
    }
  }

  /**
   * Copy the relevant fields from another `CooFormState`.
   * @param {CooFormState} orig - The object to copy from.
   * @memberof CooFormState
   */
  @action.bound copyFrom(orig) {
    for (let field of ['cooSys', 'shape', 'lonType', 'latType', 'lonCtr', 'latCtr', 'radius',
      'lonWdt', 'latWdt', 'lonMin', 'latMin', 'lonMax', 'latMax',
      'messageType', 'messageHeader', 'messageContent', 'nstars', 'job_urls'])
      this[field] = _.clone(orig[field]);
  }
}

///////////////////////////////////////////////////////////////////////////////
// Interface code

import React from 'react'
import { observer } from 'mobx-react' 
import { Grid, Header, Form, Divider } from 'semantic-ui-react'
import { InputAngle } from './inputangle.js'

const FormOptions = observer((props) => {
  let state = props.cooform;
  return (
    <Grid relaxed='very' stackable verticalAlign='top'>
      <Grid.Row>
        <Grid.Column width={10} stretched>
          <Header as='h3' dividing>Coordinate system</Header>
          <Form.Group inline>
            <Form.Radio label='Galatic' name='cooSys' value='G'
              checked={state.cooSys === 'G'} onChange={state.handleChange} {...props} />
            <Form.Radio label='Equatorial (hms)' name='cooSys' value='E'
              checked={state.cooSys === 'E'} onChange={state.handleChange} {...props} />
            <Form.Radio label='Equatorial (degrees)' name='cooSys' value='D'
              checked={state.cooSys === 'D'} onChange={state.handleChange} {...props} />
          </Form.Group>
        </Grid.Column>
        <Grid.Column width={6} stretched>
          <Header as='h3' dividing>Shape</Header>
          <Form.Group inline>
            <Form.Radio label='Cone' name='shape' value='C'
              checked={state.shape === 'C'} onChange={state.handleShapeChange} {...props} />
            <Form.Radio label='Slice' name='shape' value='R'
              checked={state.shape === 'R'} onChange={state.handleShapeChange} {...props} />
          </Form.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
});

const FormSymbad = observer((props) => {
  let state = props.cooform;
  return (
    <Form.Input label='Object name (Simbad resolved)' action='Search' placeholder='object name' width={16}
      onKeyPress={(e) => ((e.keyCode || e.which || e.charCode || 0) === 13) && state.handleSimbad(e)}
      {...state.props('object')} onBlur={state.handleSimbad} {...props} />);
});

const FormAngle = observer((props) => {
  let state = props.cooform;
  return (
    <InputAngle value={state[props.name]} onChange={state.handleLinkedChange}
      error={state.errors[props.name]} {...props} />
  );
});

export const CooForm = observer((props) => {
  let state = props.cooform;

  return (
    <>
      <FormOptions cooform={state} />

      <Header as='h3' dividing>{state.shape === 'R' ? 'Rectangular ' : 'Cone '}
      selection: center and {state.shape === 'R' ? 'widths' : 'radius'}</Header>
      <FormSymbad cooform={state} />

      <Form.Group>
        <FormAngle label={'Center ' + state.lonName} width={8} name='lonCtr'
          type={state.cooSys != 'E' ? 'longitude' : 'hms'} cooform={state} />
        <FormAngle label={'Center ' + state.latName} width={8} name='latCtr'
          type='latitude' cooform={state} />
      </Form.Group>
      {state.shape === 'R' ?
        <Form.Group>
          <FormAngle label='Width' width={8} name='lonWdt'
            type={state.cooSys != 'E' ? 'longitude' : 'hms'} cooform={state}/>
          <FormAngle label='Height' width={8} name='latWdt'
            type='longitude' cooform={state} />
        </Form.Group>
        :
        <FormAngle label='Radius' width={8} name='radius'
          type='longitude' cooform={state} />
      }
      {state.shape === 'R' ?
        <>
          <Header as='h3' dividing>Rectangular selection: corners</Header>
          <Form.Group>
            <FormAngle label={'Minimum ' + state.lonName} width={8} name='lonMin'
              type={state.cooSys != 'E' ? 'longitude' : 'hms'} cooform={state} />
            <FormAngle label={'Minimum ' + state.latName} width={8} name='latMin'
              type='latitude' cooform={state} />
          </Form.Group>
          <Form.Group>
            <FormAngle label={'Maximum ' + state.lonName} width={8} name='lonMax'
              type={state.cooSys != 'E' ? 'longitude' : 'hms'} cooform={state} />
            <FormAngle label={'Maximum ' + state.latName} width={8} name='latMax'
              type='latitude' cooform={state} />
          </Form.Group>
        </>
        : <></>}
    </>);
});

