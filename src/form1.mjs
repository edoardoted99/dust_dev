// @ts-check
'use strict';

import React from 'react'

import 'semantic-ui-css/semantic.min.css'
import { Container, Dimmer, Loader, Form, Header, Grid } from 'semantic-ui-react'
import { InputAngle } from './inputangle.mjs'
import { galactic2equatorial, equatorial2galactic } from './coordinates.mjs'

/**
 * Parse an angle and returns an array of fields
 *
 * @param {string} value - The string representing the angle
 * @return {number[]} The parsed fields
 * 
 * The accepted format anything like these examples: 
 * –12° 34' 56".789  =>  [-12, -34, -56.789];
 * –12° 34'.567  =>  [-12, -34.567];
 * +12°.3456  =>  [12.3456];
 * 12ʰ 34ᵐ 56ˢ.7  =>  [12, 34, 56.7];
 * 12ʰ 34ᵐ.56  =>  [12, 34.56];
 * 
 * and so on. Notice that negative angles have all fields negative: this helps
 * for the conversion and avoids mistakes for angles such as -0° 0' 12".
 */
function parseAngle(value) {
  let parsedValue = value.replace(/[°'"ʰᵐˢ]/g, '').replace(/[–—]/, '-').split(' ').map(parseFloat);
  // Fix negative values
  if (value[0] === '-' || value[0] === '–'|| value[0] === '—') {
    for (let i = 1; i < parsedValue.length; i++)
      parsedValue[i] = -parsedValue[i];
  }
  return parsedValue;
}

/**
 * Unparse an angle, that is returns a string from an array of numbers.
 *
 * @param {number[]} values The array representing the various fields
 * @param {String} type The angle type: any of 'latitude', 'longitude', 
 *   or 'hms'
 * @param {number} [basePrecision=7] The original precision, in decimal
 *   places after the dot. The precision is increased by 1 for cordinates
 *   of type 'hms', and is reduced by 2 for each field after the degrees 
 *   or hours. Therefore, for example, arcseconds have by default 3
 *   decimal digits after the dot.
 * @return {String} The corresponding angle
 * 
 * This is essentially the inverse of the function parseAngle 
 */
function unparseAngle(values, type, basePrecision=7) {
  var res = [], neg = false, markers
  if (type === 'hms') {
    markers = 'ʰᵐˢ'
    basePrecision += 1
  } else markers = '°\'"';
  for (let i = 0; i < values.length; i++) {
    let v = Math.abs(values[i]), s
    s = v.toFixed(basePrecision - i * 2).replace(/0*$/, '').replace('.', markers[i] + '.').replace(/\.$/, '');
    neg = neg || (values[i] < 0);
    res.push(s);
  }
  if (type === 'latitude') res[0] = (neg ? '–' : '+') + res[0];
  return res.join(' ');
}

/**
 * Convert a float number into an angle array format.
 *
 * @param {number} value The float number to convert
 * @param {number} numFields The requested number of fields
 * @return {number[]} The converted angle
 * 
 * This procedure assumes that the value passed is in units of the smallest
 * field. So, for example, if numFields = 3, then the value is taken to be in 
 * arcseconds. Note that negative numbers will result in angles with all 
 * fields negative: this is intended.
 */
function decimal2angle(value, numFields) {
  var result = [], d = value;
  for (let n = 0; n < numFields-1; n++) {
    result.push(d % 60);
    d = Math.trunc(d / 60);
  }
  result.push(d);
  return result.reverse();
} 

function scaleAngle(value, type, factor) {
  let precision = 7;
  if (factor < 0.3 && type !== 'hms') precision += 1;
  if (value !== '') {
    let angle = parseAngle(value), numFields = angle.length, decimal = 0;
    for (let n = numFields - 1; n >= 0; n--) {
      decimal += angle[n] * factor;
      factor *= 60;
    }
    angle = decimal2angle(decimal, numFields);
    return unparseAngle(angle, type, precision);
  } else return '';
}

export class MyForm1 extends React.Component {
  state = {
    objectName: '', coord: 'G', 
    lonCtr: '', lonWdt: '', lonMin: '', lonMax: '', lonType: 0,
    latCtr: '', latWdt: '', latMin: '', latMax: '', latType: 0,
    errors: {}, undo: false
  };

  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.handleLinkedChange = this.handleLinkedChange.bind(this);
    this.handleCoordChange = this.handleCoordChange.bind(this);
    this.handleToggle = this.handleToggle.bind(this);
    this.handleSimbad = this.handleSimbad.bind(this);
    this.submit = this.submit.bind(this);
    this.clearOrUndo = this.clearOrUndo.bind(this);
  }

  /**
   * Convert center+width angles into min+max angles
   *
   * @param {String} ctr The central angle
   * @param {String} wdt The width angle
   * @param {String} type Either 'longitude', 'latitude', or 'hms'
   * @return {String[]} An array with the minimum and maximum angles
   * @memberof MyForm1
   */
  cw2mm(ctr, wdt, type) {
    if (ctr === '' || wdt === '') return ['', ''];
    // Extract the components and make sure both ctr and wdt have the same length
    let ctrP = parseAngle(ctr), wdtP = parseAngle(wdt), ctrV = 0.0, wdtV = 0.0, numFields = 0;
    let mod = (type === 'hms') ? 24 : ((type === 'longitude') ? 360 : 90);
    for (let n = 0; n < 3; n++) {
      if (ctrP[n] === undefined && wdtP[n] === undefined) break;
      ctrV *= 60;
      wdtV *= 60;
      mod *= 60;
      if (ctrP[n]) ctrV += ctrP[n]
      if (wdtP[n]) wdtV += wdtP[n]
      numFields += 1;
    }
    mod /= 60;
    // Computes the minimum and maximum
    let minV, maxV, minP = [], maxP = [];
    minV = ctrV - wdtV / 2;
    maxV = ctrV + wdtV / 2;
    if (type === 'latitude') {
      if (minV < -mod) minV = -mod;
      if (maxV > mod) maxV = mod;
    } else {
      minV = minV - Math.floor(minV / mod) * mod;
      maxV = maxV - Math.floor(maxV / mod) * mod;
    }
    // Convert float values into arrays
    minP = decimal2angle(minV, numFields);
    maxP = decimal2angle(maxV, numFields);
    // Convert the arrays into the result
    return [unparseAngle(minP, type), unparseAngle(maxP, type)];
  } 

  /**
   * Convert min+max angles into center+width angle
   *
   * @param {String} min The central angle
   * @param {String} max The width angle
   * @param {String} type Either 'longitude', 'latitude', or 'hms'
   * @return {String[]} An array with the center and width
   * @memberof MyForm1
   */
  mm2cw(min, max, type) {
    if (min === '' || max === '') return ['', ''];
    // Extract the components and make sure both min and max have the same length
    let minP = parseAngle(min), maxP = parseAngle(max), minV = 0.0, maxV = 0.0, numFields = 0;
    let mod = (type === 'hms') ? 24 : ((type === 'longitude') ? 360 : 90);
    for (let n = 0; n < 3; n++) {
      if (minP[n] === undefined && maxP[n] === undefined) break;
      minV *= 60;
      maxV *= 60;
      mod *= 60;
      if (minP[n]) minV += minP[n]
      if (maxP[n]) maxV += maxP[n]
      numFields += 1;
    }
    mod /= 60;
    // Computes the minimum and maximum
    let ctrV, wdtV, ctrP = [], wdtP = [];
    if (minV < maxV) {
      if (type === 'longitude') minV -= mod;
      else if (type === 'hms') minV -= mod;
      else [minV, maxV] = [maxV, minV];
    }
    ctrV = (minV + maxV) / 2;
    wdtV = maxV - minV;
    if (type === 'longitude') 
      ctrV = ctrV - Math.floor(ctrV / mod) * mod;
    else if (type === 'hms')
      ctrV = ctrV - Math.floor(ctrV / mod) * mod;
    // Convert float values into arrays
    ctrP = decimal2angle(ctrV, numFields);
    wdtP = decimal2angle(wdtV, numFields);
    // Convert the arrays into the result
    return [unparseAngle(ctrP, type), unparseAngle(wdtP, type)];
  } 

  handleChange(e, { name, value }) {
    this.setStateValidate({ [name]: value });
    this.setState({ undo: false });
  }

  handleLinkedChange(e, { name, value }) {
    const lonlat = name.substr(0, 3), rest = name.substr(3), isCorner = name[3] === 'M';
    const type = (lonlat === 'lat') ? 'latitude' : ((this.state.coord === 'E') ? 'hms' : 'longitude');
    if (isCorner) {
      let [ctr, wdt] = this.mm2cw(
        (rest === 'Min') ? value : this.state[lonlat + 'Min'],
        (rest === 'Max') ? value : this.state[lonlat + 'Max'], type);
      this.setState({
        [lonlat + 'Type']: (isCorner ? 2 : 1),
        [lonlat + 'Ctr']: ctr,
        [lonlat + 'Wdt']: wdt
      });
    } else {
      let [min, max] = this.cw2mm(
        (rest === 'Ctr') ? value : this.state[lonlat + 'Ctr'],
        (rest === 'Wdt') ? value : this.state[lonlat + 'Wdt'], type);
      this.setState({
        [lonlat + 'Type']: (isCorner ? 2 : 1),
        [lonlat + 'Min']: min,
        [lonlat + 'Max']: max
      });
    }
    this.handleChange(e, { name, value });
  }

  handleCoordChange(e, { name, value }) {
    const frames = { 'G': 'g', 'E': 'e', 'D': 'e', '': '' };
    let stateUpdate = { lonType: 0 };
    if (frames[value] === frames[this.state.coord]) {
      // Just a change of units: proceeds
      let fields = ['lonCtr', 'lonWdt', 'lonMin', 'lonMax'];
      for (let field of fields) 
        stateUpdate[field] = scaleAngle(this.state[field], (value === 'D') ? 'longitude' : 'hms',
          (value === 'D') ? 15 : (1.0 / 15.0));
    } else {
      if (this.state.lonCtr === '' || this.state.latCtr === '') {
        // One field is missing: clear everything!
        this.setState({ lonCtr: '', latCtr: '', lonMin: '', lonMax: '', latMin: '', latMax: '' });
      } else {
        // Parse the longitude and latitude
        let lonA = parseAngle(this.state.lonCtr), latA = parseAngle(this.state.latCtr);
        let lon, lat, numFields = Math.max(lonA.length, latA.length), factor = [1,60,3600][numFields-1];
        lon = (lonA[0] || 0) + (lonA[1] || 0) / 60 + (lonA[2] || 0) / 3600;
        lat = (latA[0] || 0) + (latA[1] || 0) / 60 + (latA[2] || 0) / 3600;
        // If we start with hms, convert the longitude (RA) to degrees
        if (this.state.coord === 'E') {
          lon *= 15;
          stateUpdate.lonWdt = scaleAngle(this.state.lonWdt, 'longitude', 15.0);
        }
        // Perform the coordinate transformation
        if (value === 'G') [lon, lat] = equatorial2galactic(lon, lat);
        else[lon, lat] = galactic2equatorial(lon, lat);
        // If we end-up with hms, convert the longitude (RA) to hms
        if (value === 'E') {
          lon /= 15;
          stateUpdate.lonWdt = scaleAngle(this.state.lonWdt, 'hms', 1.0/15.0);
        }
        // Update the state
        stateUpdate.lonCtr = unparseAngle(decimal2angle(lon * factor, numFields), (value === 'E') ? 'hms' : 'longitude', 5);
        stateUpdate.latCtr = unparseAngle(decimal2angle(lat * factor, numFields), 'latitude', 5);
        // Check if we have already entered widths: if so, update the corner coordinates
        if (this.state.lonWdt) {
          let [min, max] = this.cw2mm(stateUpdate.lonCtr, stateUpdate.lonWdt || this.state.lonWdt,
            (value === 'E') ? 'hms' : 'longitude');
          stateUpdate.lonType = 1;
          stateUpdate.lonMin = min;
          stateUpdate.lonMax = max;
        }
        if (this.state.latWdt) {
          let [min, max] = this.cw2mm(stateUpdate.latCtr, stateUpdate.latWdt || this.state.lonWdt, 'latitude');
          stateUpdate.latType = 1;
          stateUpdate.latMin = min;
          stateUpdate.latMax = max;
        }
      }
    }
    this.handleChange(e, { name, value });
    this.setState(stateUpdate);
  }

  handleToggle(e, { name, checked }) {
    this.setState({ [name]: checked, undo: false });
  }

  setStateValidate(dict) {
    for (let name in dict) this.validate(name, dict[name]);
    return this.setState(dict);
  }

  validate(name, value) {
    const validations = {
      objectName: x => true
    }
    if (name === undefined) {
      let errors = {}, hasErrors = false;
      for (let key of Object.keys(validations)) {
        if (validations[key] !== undefined) {
          let state = validations[key](this.state[key]);
          hasErrors = hasErrors || (!state);
          if (!state) errors[key] = true;
        }
      }
      this.setState({ errors: errors });
      return hasErrors;
    } else if (validations[name] !== undefined) {
      if (this.state.errors[name]) {
        let state = validations[name](value), errors = this.state.errors;
        errors[name] = !state;
        this.setState({ errors: errors })
        return !state;
      }
    }
  }

  submit(e) {
    if (!this.validate()) e.preventDefault();
    else this.props.onSubmit(e);
  }

  clearOrUndo() {
    if (!this.state.undo) {
      this.setState({
        objectName: '', coord: 'G', lonCtr: '', latCtr: '', lonWdt: '', latWdt: '',
        lonMin: '', latMin: '', lonMax: '', latMax: '', errors: {}, undo: Object.assign(this.state)
      });
    } else {
      this.setState(this.state.undo);
    }
  }

  handleSimbad() {
    if (this.state.objectName.match(/^\s*$/)) return;
    let xhr = new XMLHttpRequest();
    const url = 'http://simbad.u-strasbg.fr/simbad/sim-id?output.format=ASCII&' +
      'obj.coo1=on&frame1=ICRS&epoch1=J2000&equi1=2000&coodisp1=s2&' +
      'obj.coo2=on&frame2=ICRS&epoch2=J2000&equi2=2000&coodisp2=d2&' +
      'obj.coo3=on&frame3=GAL&epoch3=J2000&equi3=2000&coodisp3=d2&' +
      'obj.coo4=off&obj.bibsel=off&Ident=' + escape(this.state.objectName);
    xhr.open('GET', url);
    xhr.onload = () => {
      if (xhr.status === 200) {
        let data = xhr.responseText, m;
        if (this.state.coord === 'G') {
          m = data.match(/Coordinates\(GAL,.*\):\s* ([^ ]+)\s*([^ \n\r]+)/i);
          if (m) {
            m[1] = m[1].replace(/(\.|$)/, '°$1');
            m[2] = m[2].replace('-', '–').replace(/(\.|$)/, '°$1');
          }
        } else if (this.state.coord === 'D') {
          m = data.match(/Coordinates\(ICRS,.*\):\s* ([^ ]+)\s*([^ \n\r]+)\s*$/im);
          if (m) {
            m[1] = m[1].replace(/(\.|$)/, '°$1');
            m[2] = m[2].replace('-', '–').replace(/(\.|$)/, '°$1');
          }
        } else {
          m = data.match(/Coordinates\(ICRS,.*\):\s* ([^ ]+)\s*([^ ]+)\s*([^ ]+)\s*([^ ]+)\s*([^ ]+)\s*([^ \n\r]+)/i);
          if (m) {
            m[1] = m[1] + 'ʰ ' + m[2] + 'ᵐ ' + m[3].replace(/(\.|$)/, 'ˢ$1');
            m[2] = m[4].replace('-', '–') + '° ' + m[5] + "' " + m[6].replace(/(\.|$)/, '"$1');
          }
        }
        if (m) {
          this.setState({ lonCtr: m[1], latCtr: m[2] });
        } else {
          this.setState({ errors: { objectName: 'Simbad could not resolve this object name' }})
        }
      } else {
        this.setState({ errors: { objectName: 'Connection error to Simbad' } })
      }
    };
    xhr.onerror = () => this.setState({ errors: { objectName: 'Connection error to Simbad' } });
    xhr.send();
  }

  render() {
    const lonName = (this.state.coord === 'G') ? 'galactic longitude' : 'right ascension';
    const latName = (this.state.coord === 'G') ? 'galactic latitude' : 'declination';
    return (
      <Container>
        <Dimmer.Dimmable blurring dimmed={Boolean(this.state.wait)}>
          <Dimmer active={Boolean(this.state.wait)} inverted >
            <Loader inverted indeterminate content={String(this.state.wait)} />
          </Dimmer>
          <Grid stackable columns={2}>
            <Grid.Column style={{ flex: "1" }}>
      
      <Form autoComplete='off'>
      <Header as='h2'>Area selection</Header>
      All coordinates can be entered in the format <i>dd:mm:ss.cc</i>, <i>dd:mm.ccc</i>
      , or <i>dd.cccc</i>; alternatively, you can specify the area in map to the left 
      using the selection button (the square).
      <Header as='h3' dividing>Coordinate system</Header>
      <Form.Group inline>
        <Form.Radio label='Galatic' name='coord' value='G'
          checked={this.state.coord === 'G'} onChange={this.handleCoordChange} />
        <Form.Radio label='Equatorial (hms)' name='coord' value='E'
          checked={this.state.coord === 'E'} onChange={this.handleCoordChange} />
        <Form.Radio label='Equatorial (degrees)' name='coord' value='D'
          checked={this.state.coord === 'D'} onChange={this.handleCoordChange} />
      </Form.Group>
      <Header as='h3' dividing>Rectangular selection: center and widths</Header>
      <Form.Input label='Object name (Simbad resolved)' placeholder='object name' width={16}
        name='objectName' value={this.state.objectName} onChange={this.handleChange}
        onKeyPress={(e) => ((e.keyCode || e.which || e.charCode || 0) === 13) && this.handleSimbad()}
        onBlur={this.handleSimbad} error={this.state.errors.objectName}
        action='Search' />
      <Form.Group>
        <InputAngle label={'Center ' + lonName} width={8}
          type={this.state.coord != 'E' ? 'longitude' : 'hms'}
          name='lonCtr' value={this.state.lonCtr} onChange={this.handleLinkedChange} />
        <InputAngle label={'Center ' + latName} type='latitude' width={8} 
          name='latCtr' value={this.state.latCtr} onChange={this.handleLinkedChange} />
      </Form.Group>
      <Form.Group>
        <InputAngle label='Width' width={8}
          type={this.state.coord != 'E' ? 'longitude' : 'hms'}
          name='lonWdt' value={this.state.lonWdt} onChange={this.handleLinkedChange} />
        <InputAngle label='Height' type='longitude' width={8}
          name='latWdt' value={this.state.latWdt} onChange={this.handleLinkedChange} />
      </Form.Group>
      <Header as='h3' dividing>Rectangular selection: corners</Header>
      <Form.Group>
        <InputAngle label={'Minimum ' + lonName} width={8}
          type={this.state.coord != 'E' ? 'longitude' : 'hms'}
          name='lonMin' value={this.state.lonMin} onChange={this.handleLinkedChange} />
        <InputAngle label={'Minimum ' + latName} type='latitude' width={8}
          name='latMin' value={this.state.latMin} onChange={this.handleLinkedChange} />
      </Form.Group>
      <Form.Group>
        <InputAngle label={'Maximum ' + lonName} width={8}
          type={this.state.coord != 'E' ? 'longitude' : 'hms'}
          name='lonMax' value={this.state.lonMax} onChange={this.handleLinkedChange} />
        <InputAngle label={'Maximum ' + latName} type='latitude' width={8}
          name='latMax' value={this.state.latMax} onChange={this.handleLinkedChange} />
      </Form.Group>
              </Form>
            </Grid.Column>
            <Grid.Column style={{ flex: "0 0 300px" }}>
              Right form
            </Grid.Column>
          </Grid>
        </Dimmer.Dimmable>
      </Container>
    );
  }
}