// @ts-check
'use strict';

import React from 'react'

import './css/sql.css'
import _ from 'lodash'
import { observable, computed, isObservableProp, isComputedProp, when, configure, action } from "mobx"
import { observer } from "mobx-react"
import { Container, Loader, Dimmer, Grid, Form, Header, Button } from 'semantic-ui-react'
import { InputAngle } from './inputangle.js'
import { FormState } from './formstate.js'
import { Angle } from './angle.js'
import { galactic2equatorial, equatorial2galactic } from './coordinates.js'

configure({ enforceActions: 'observed' });


export class Form1State extends FormState {
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
    lonctr: x => x == '' && 'Please enter a valid coordinate',
    latctr: x => x == '' && 'Please enter a valid coordinate',
    lonwdt: x => x == '' && 'Please enter a valid width',
    latwdt: x => x == '' && 'Please enter a valid width',
    lonmin: x => x == '' && 'Please enter a valid coordinate',
    latmin: x => x == '' && 'Please enter a valid coordinate',
    lonmax: x => x == '' && 'Please enter a valid coordinate',
    latmax: x => x == '' && 'Please enter a valid coordinate'
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
        let data = xhr.responseText, m;
        if (this.cooSys === 'G') {
          m = data.match(/Coordinates\(GAL,.*\):\s* ([^ ]+)\s*([^ \n\r]+)/i);
          if (m) {
            m[1] = m[1].replace(/(\.|$)/, '°$1');
            m[2] = m[2].replace('-', '–').replace(/(\.|$)/, '°$1');
          }
        } else if (this.cooSys === 'D') {
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
          this.lonCtr = m[1];
          this.latCtr = m[2];
          this.errors.object = false;
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
    return _.map(minAngle.scaleAdd(maxAngle, [0.5, -1], [0.5, 1]), a => a.angle);
  } 

  @action.bound handleLinkedChange(e, { name, value }) {
    const lonlat = name.substr(0, 3), rest = name.substr(3), isCorner = name[3] === 'M';
    const type = (lonlat === 'lat') ? 'latitude' : ((this.cooSys === 'E') ? 'hms' : 'longitude');
    if (isCorner) {
      let [ctr, wdt] = this.mm2cw(
        (rest === 'Min') ? value : this[lonlat + 'Min'],
        (rest === 'Max') ? value : this[lonlat + 'Max'], type);
      this[lonlat + 'Type'] = isCorner ? 2 : 1;
      this[lonlat + 'Ctr'] = ctr;
      this[lonlat + 'Wdt'] = wdt;
    } else {
      let [min, max] = this.cw2mm(
        (rest === 'Ctr') ? value : this[lonlat + 'Ctr'],
        (rest === 'Wdt') ? value : this[lonlat + 'Wdt'], type);
      this[lonlat + 'Type'] = isCorner ? 2 : 1;
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
            .scale$((value === 'E') ? (1.0/15.0) : 15).angle;
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

export const state1 = new Form1State();

const FormCooSys = observer((props) => {
  return (
    <Form.Group inline>
      <Form.Radio label='Galatic' name='cooSys' value='G'
        checked={state1.cooSys === 'G'} {...props} />
      <Form.Radio label='Equatorial (hms)' name='cooSys' value='E'
        checked={state1.cooSys === 'E'} {...props} />
      <Form.Radio label='Equatorial (degrees)' name='cooSys' value='D'
        checked={state1.cooSys === 'D'} {...props} />
    </Form.Group>
  );
});

const FormSymbad = observer((props) => {
  return (
    <Form.Input label='Object name (Simbad resolved)' placeholder='object name' width={16}
      name='object' value={state1.object} onChange={state1.handleChange}
      onKeyPress={(e) => ((e.keyCode || e.which || e.charCode || 0) === 13) && state1.handleSimbad()}
      onBlur={state1.handleSimbad} error={state1.errors.object}
      action='Search' {...props} />);
})

const FormAngle = observer((props) => {
  return (
    <InputAngle value={state1[props.name]} onChange={state1.handleLinkedChange} {...props} />
  );
});


const ClearButton = observer(() => {
  return (
    <Button style={{ width: "110px" }} icon={state1.undo ? 'undo' : 'delete'} content={state1.undo ? 'Undo' : 'Clear'}
      color={state1.undo ? 'green' : 'red'} onClick={state1.resetOrUndo} />
  );
});

export const MyForm1 = observer((props) => {
  const [wait] = React.useState(false);

  const handleChange = state1.handleChange;

  function handleNext(e) {
    e.preventDefault();
    let a = new Angle(1.5, 'hms'), b = new Angle([1, 30], 'hms');
    let c = a.scaleAdd(b);
    // if (state1.validate()) props.onNext(e);
  }

  function handleBack(e) {
    e.preventDefault();
    props.onBack(e);
  }

  return (
    <Container>
      <Dimmer.Dimmable blurring dimmed={Boolean(wait)}>
        <Dimmer active={Boolean(wait)} inverted >
          <Loader inverted indeterminate content={String(wait)} />
        </Dimmer>
        <Grid stackable columns={2}>
          <Grid.Column style={{ flex: "1" }}>
            <Form autoComplete='off'>
              <Header as='h2'>Area selection</Header>
                  All coordinates can be entered in the format <i>dd:mm:ss.cc</i>, <i>dd:mm.ccc</i>
                  , or <i>dd.cccc</i>; alternatively, you can specify the area in map to the left
                  using the selection button (the square).
                <Header as='h3' dividing>Coordinate system</Header>
              <FormCooSys onChange={handleChange} />
              <Header as='h3' dividing>Rectangular selection: center and widths</Header>
              <FormSymbad />

              <Form.Group>
                <FormAngle label={'Center ' + state1.lonName} width={8} name='lonCtr' 
                  type={state1.cooSys != 'E' ? 'longitude' : 'hms'} />
                <FormAngle label={'Center ' + state1.latName} width={8} name='latCtr'
                  type='latitude' />
              </Form.Group>
              <Form.Group>
                <FormAngle label='Width' width={8} name='lonWdt' 
                  type={state1.cooSys != 'E' ? 'longitude' : 'hms'}
                  />
                <FormAngle label='Height' width={8} name='latWdt' 
                  type='longitude' />
              </Form.Group>
              <Header as='h3' dividing>Rectangular selection: corners</Header>
              <Form.Group>
                <FormAngle label={'Minimum ' + state1.lonName} width={8} name='lonMin' 
                  type={state1.cooSys != 'E' ? 'longitude' : 'hms'} />
                <FormAngle label={'Minimum ' + state1.latName} width={8} name='latMin' 
                  type='latitude' />
              </Form.Group>
              <Form.Group>
                <FormAngle label={'Maximum ' + state1.lonName} width={8} name='lonMax' 
                  type={state1.cooSys != 'E' ? 'longitude' : 'hms'} />
                <FormAngle label={'Maximum ' + state1.latName} width={8} name='latMax' 
                  type='latitude' />
              </Form.Group>

              <Button style={{ width: "110px" }} icon='left arrow' labelPosition='left' content='Back'
                onClick={handleBack} />
              <ClearButton />
              <Button primary style={{ width: "110px" }} icon='right arrow' labelPosition='right' content='Next'
                onClick={handleNext} />
            </Form>
          </Grid.Column>
        </Grid>
      </Dimmer.Dimmable>
    </Container>);
});

