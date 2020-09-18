// @ts-check
'use strict';

import React from 'react'

import 'semantic-ui-css/semantic.min.css'
import { Icon, Form, Header, Grid, Input, Button, GridColumn } from 'semantic-ui-react'
import { serversDict, datasetsDict, colorDict } from './datasets.mjs';
import { InputAngle } from './inputangle.mjs'

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
  let parsedValue = value.replace(/[°'"ʰᵐˢ]/g, '').replace('—', '-').split(' ').map(parseFloat);
  // Fix negative values
  if (value[0] == '–' || value[0] == '-') {
    for (let i = 1; i < parsedValue.length; i++)
      parsedValue[i] = -parsedValue[i];
  }
  return parsedValue;
}

/**
 * Unparse an angle, that is returns a string from an array of numbers.
 *
 * @param {number[]} values - The array representing the various fields
 * @param {String} type - The angle type: any of 'latitude', 'longitude', 
 *   or 'hms'
 * @return {String} The corresponding angle
 * 
 * This is essentially the inverse of the function parseAngle 
 */
function unparseAngle(values, type) {
  var res = [], neg = false, markers = (type === 'hms') ? 'ʰᵐˢ' : '°\'"';
  for (let i = 0; i < values.length; i++) {
    let v = Math.abs(values[i]), f = Math.floor(v), s = f + markers[i];
    if (v != f) 
      s += (v - f).toFixed(10).replace(/0*$/, '').substr(1);
    neg = neg || (values[i] < 0);
    res.push(s);
  }
  if (type === 'latitude') res[0] = (neg ? '—' : '+') + res[0];
  return res.join(' ');
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
    for (let n = 0; n < numFields; n++) {
      let v;
      v = minV % 60;
      minP.push(v);
      minV = Math.trunc(minV / 60);
      v = maxV % 60;
      maxP.push(v);
      maxV = Math.trunc(maxV / 60);
    }
    // Convert the arrays into the result
    return [unparseAngle(minP.reverse(), type), unparseAngle(maxP.reverse(), type)];
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
    for (let n = 0; n < numFields; n++) {
      let v;
      v = ctrV % 60;
      ctrP.push(v);
      ctrV = Math.trunc(ctrV / 60);
      v = wdtV % 60;
      wdtP.push(v);
      wdtV = Math.trunc(wdtV / 60);
    }
    // Convert the arrays into the result
    return [unparseAngle(ctrP.reverse(), type), unparseAngle(wdtP.reverse(), type)];
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
            m[2] = m[2].replace('-', '—').replace(/(\.|$)/, '°$1');
          }
        } else if (this.state.coord === 'D') {
          m = data.match(/Coordinates\(ICRS,.*\):\s* ([^ ]+)\s*([^ \n\r]+)\s*$/im);
          if (m) {
            m[1] = m[1].replace(/(\.|$)/, '°$1');
            m[2] = m[2].replace('-', '—').replace(/(\.|$)/, '°$1');
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
    return (<Form autoComplete='off'>
      <Header as='h2'>Area selection</Header>
      All coordinates can be entered in the format <i>dd:mm:ss.cc</i>, <i>dd:mm.ccc</i>
      , or <i>dd.cccc</i>; alternatively, you can specify the area in map to the left 
      using the selection button (the square).
      <Header as='h3' dividing>Coordinate system</Header>
      <Form.Group inline>
        <Form.Radio label='Galatic' name='coord' value='G'
          checked={this.state.coord === 'G'} onChange={this.handleChange} />
        <Form.Radio label='Equatorial (hms)' name='coord' value='E'
          checked={this.state.coord === 'E'} onChange={this.handleChange} />
        <Form.Radio label='Equatorial (degrees)' name='coord' value='D'
          checked={this.state.coord === 'D'} onChange={this.handleChange} />
      </Form.Group>
      <Header as='h3' dividing>Rectangular selection: center and widths</Header>
      <Form.Input label='Object name (Simbad resolved)' placeholder='object name'
        width={16} icon={<Icon name='search' inverted circular link />}
        name='objectName' value={this.state.objectName} onChange={this.handleChange}
        onKeyPress={(e) => ((e.keyCode || e.which || e.charCode || 0) === 13) && this.handleSimbad()}
        onBlur={this.handleSimbad} error={this.state.errors.objectName} />
      <Form.Group>
        <InputAngle label={'Center ' + lonName} width={8}
          type={this.state.coord != 'E' ? 'longitude' : 'hms'}
          name='lonCtr' value={this.state.lonCtr} onChange={this.handleLinkedChange} />
        <InputAngle label={'Center ' + latName} type='latitude' width={8} 
          name='latCtr' value={this.state.latCtr} onChange={this.handleLinkedChange} />
      </Form.Group>
      <Form.Group>
        <InputAngle label='Width' type='longitude' width={8}
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
    </Form>);
  }
}