// @ts-check
'use strict';

import React from 'react'

import _ from 'lodash'
import { observable, computed, configure, action } from 'mobx'
import { observer } from "mobx-react"
import { Container, Loader, Dimmer, Grid, Form, Header, Button, FormField, Input, Label, Accordion, Icon, Select } from 'semantic-ui-react'
import { InputAngle } from './inputangle.js'
import { FormState } from './formstate.js'
import { Slider } from './slider.js'
// import './css/slider.css'
const WCS = require('./wcs.js')

configure({ enforceActions: 'observed' });

export class Form3State extends FormState {
  @observable products = [];
  @observable naxis1 = '';
  @observable naxis2 = '';
  @observable coosys = 'galactic';
  @observable projection = 'TAN';
  @observable crpix1 = '';
  @observable crpix2 = '';
  @observable crval1 = '';
  @observable crval2 = '';
  @observable scale = '';
  @observable scaleUnit = 60;
  @observable scaleArcsec = 0;
  @observable scaleLoocked = true;
  @observable crota2 = '';
  @observable lonpole = '';
  @observable latpole = '';
  @observable pv2 = ['', '', '', ''];
  @observable smoothpar = '2';
  @observable clipping = '3.0';
  @observable clipIters = 3;

  validators = {
    products: x => (x.length < 1) && 'Select at least one product',
    naxis1: x => !(x > 0 && x < 10000 && _.isInteger(x)) && 'Please enter a positive integer',
    naxis2: x => !(x > 0 && x < 10000 && _.isInteger(x)) && 'Please enter a positive integer',
    crpix1: x => !(_.isNumber(x)) && 'Please enter a valid number',
    crpix2: x => !(_.isNumber(x)) && 'Please enter a valid number',
    crval1: x => !(_.isNumber(x)) && 'Please enter a valid number',
    crval2: x => !(_.isNumber(x)) && 'Please enter a valid number',
    scale: x => !(_.isNumber(x) && x > 0) && 'Please enter a valid number',
    rot: x => !(x >= -180 && x <= 360) && 'Please enter a valid rotation',
    lonpole: x => !(x >= -180 && x <= 360) && 'Please enter a valid longitude',
    latpole: x => !(x >= -90 && x <= 90) && 'Please enter a valid latitude',
    spoothpar: x => !(_.isNumber(x)) && 'Please enter a valid number',
    clipping: x => !(_.isNumber(x)) && 'Please enter a valid number',
  }

  setScaleArcsec(scaleArcsec) {
    this.scaleArcsec = scaleArcsec;
    if (_.isFinite(this.scaleArcsec))
      this.scale = (this.scaleArcsec / (3600 / this.scaleUnit)).toFixed(7).replace(/\.?0*$/, '');
    else
      this.scale = '';

  }

  setScale(scale) {
    this.scale = scale;
    if (_.isString(scale))
      this.scaleArcsec = parseFloat(scale) * 3600 / this.scaleUnit;
    else if (_.isFinite(scale))
      this.scaleArcsec = scale * 3600 / this.scaleUnit;
    else this.scaleArcsec = 0;
  }

  handleScale(e, { value }) {
    this.scaleArcsec = parseFloat(value) * 3600 / this.scaleUnit;
  }

  @action.bound handleScaleUnit(e, { value }) {
    this.scaleUnit = value;
    this.setScaleArcsec(this.scaleArcsec * value / this.scaleUnit);
    this.undo = false;
    e.preventDefault();
  }

  @computed({ keepAlive: true }) get starsPerPixel() {
    // FIXME: density -> state1.density
    const scale = this.scaleArcsec / 3600, density = 1e6;
    return density * scale * scale;
  }

  set starsPerPixel(value) {
    // FIXME: density -> state1.density
    const oldScaleArcsec = this.scaleArcsec, density = 1e6;

    if (this.scaleLoocked) {
      const goodScales = [
        5 * 3600, 4 * 3600, 3 * 3600,
        2.5 * 3600, 2 * 3600, 1.5 * 3600,
        75 * 60, 60 * 60, 45 * 60,
        40 * 60, 30 * 60, 24 * 60,
        20 * 60, 15 * 60, 12 * 60,
        10 * 60, 7.5 * 60, 6 * 60,
        5 * 60, 4 * 60, 3 * 60,
        2.5 * 60, 2 * 60, 1.5 * 60,
        80, 60, 45,
        40, 30, 24,
        20, 15, 12,
        10, 7.5, 6,
        5, 4, 3];
      this.setScaleArcsec(_.minBy(goodScales, x => Math.abs(value * 3600 * 3600 - density * x * x)));
    } else {
      this.setScaleArcsec(Math.sqrt(value / density) * 3600);
    }
    const factor = oldScaleArcsec / this.scaleArcsec;
    for (let field of ['naxis1', 'naxis2', 'crpix1', 'crpix2']) {
      let fieldValue = parseFloat(this[field]);
      if (_.isFinite(fieldValue)) this[field] = (fieldValue * factor).toFixed(0);
    }
  }

  handleProjection(e, { value }) {
    const PVs = defaultPVs[value] || [], latpole = defaultLatpoles[value] || [];
    for (let n = 0; n < 4; n++) {
      this.pv2[n] = (PVs[n] >= 0) ? ['0', '1', '', '0', '90', ''][PVs[n]] : '';
    }
    this.latpole = (latpole >= 0) ? ['0', '1', '', '0', '90', ''][latpole] : '';
  }

  @computed({ keepAlive: true }) get header() {
    const types = this.coosys === 'galactic' ? ['GLON', 'GLAT'] : ['RA--', 'DEC-'];
    let header;
    header = {
      'SIMPLE': 'T',
      'BITPIX': -32,
      'NAXIS': 2,
      'NAXIS1': parseInt(this.naxis1),
      'NAXIS2': parseInt(this.naxis2),
      'CTYPE1': types[0] + '-' + this.projection,
      'CRPIX1': parseInt(this.crpix1),
      'CDELT1': -this.scaleArcsec / 3600.0,
      'CRVAL1': parseFloat(this.crval1),
      'CTYPE2': types[1] + '-' + this.projection,
      'CRPIX2': parseInt(this.crpix2),
      'CDELT2': this.scaleArcsec / 3600.0,
      'CRVAL2': parseFloat(this.crval2),
      'EQUINOX': 2000.0
    };
    for (let name of ['lonpole', 'latpole', 'crota2'])
      if (this[name]) header[name] = parseFloat(this[name]);
    for (let n = 0; n < 4; n++)
      if (this.pv2[n]) header['PV2_' + n] = parseFloat(this.pv2[n]);
    return header
  }

  @action.bound guessWCS(state1) {
    let lonMin = state1.lonMinAngle.degrees, lonMax = state1.lonMaxAngle.degrees,
      latMin = state1.latMinAngle.degrees, latMax = state1.latMaxAngle.degrees;
    let crval1, crval2, scale, naxis1, naxis2
    if (lonMin > lonMax) lonMin -= 360;
    crval1 = (lonMin + lonMax) * 0.5;
    if (crval1 < 0) crval1 += 360;
    crval2 = (latMin + latMax) * 0.5;
    let c = Math.cos(crval2 * Math.PI / 180.0);
    let aspect = (lonMax - lonMin) * c / (latMax - latMin);
    // scale = _.minBy(goodScales, x => Math.abs(this.starsPerPixel - state1.density * x * x / 3600));
    scale = this.scaleArcsec / 3600;
    naxis1 = Math.ceil((Math.floor(Math.sqrt(state1.area * aspect) / scale * 1.1) + 20) / 10) * 10;
    naxis2 = Math.ceil((Math.floor(Math.sqrt(state1.area / aspect) / scale * 1.1) + 20) / 10) * 10;
    // Reasonable parameters found: now improve them
    let header = {
      SIMPLE: "T", BITPIX: -32, NAXIS: 2,
      NAXIS1: naxis1, NAXIS2: naxis2,
      CRPIX1: naxis1 / 2.0, CRPIX2: naxis2 / 2.0,
      CTYPE1: "GLON-TAN", CTYPE2: "GLAT-TAN",
      CRVAL1: Math.round(crval1 * 1e6) / 1e6, CRVAL2: Math.round(crval2 * 1e6) / 1e6,
      CDELT1: -scale, CDELT2: scale,
      CROTA2: 0.0, EQUINOX: 2000.0 
    };
    console.log(header);
    return this.improveWCS(state1, header);
  }

  @action.bound improveWCS(state1, header) {
    let lonMin = state1.lonMinAngle.degrees, lonMax = state1.lonMaxAngle.degrees,
      latMin = state1.latMinAngle.degrees, latMax = state1.latMaxAngle.degrees;
    const wcs = new WCS();
    const npts = 3, lonStep = (lonMax - lonMin) / (npts - 1), latStep = (latMax - latMin) / (npts - 1);
    const xs = _.range(lonMin, lonMax + lonStep, lonStep), ys = _.range(latMin, latMax + latStep, latStep);
    let xy = [_.flatten(_.times(npts, _.constant(xs))), _.flatten(_.map(ys, y => _.times(npts, _.constant(y))))];
    wcs.init(header);
    for (let n = 0; n < xy[0].length; n++)
      [xy[0][n], xy[1][n]] = wcs.sky2pix(xy[0][n], xy[1][n]);
    // Fix the header
    const border = 10
    const xMin = _.min(xy[0]), yMin = _.min(xy[1]), xMax = _.max(xy[0]), yMax = _.max(xy[1]);
    header.CRPIX1 -= xMin;
    header.CRPIX2 += yMax - header.NAXIS2;
    header.CRPIX1 = Math.round(header.CRPIX1) + border;
    header.CRPIX2 = Math.round(header.CRPIX2) + border;
    header.NAXIS1 = Math.ceil(xMax - xMin) + 2 * border;
    header.NAXIS2 = Math.ceil(yMax - yMin) + 2 * border;
    // Update the fields
    this.coosys = (header.CTYPE1[0] === 'G') ? 'galactic' : 'equatorial';
    this.projection = header.CTYPE1.substr(5);
    this.crota2 = (header.CROTA2 === undefined) ? '0' : header.CROTA2;
    this.naxis1 = String(header.NAXIS1);
    this.naxis2 = String(header.NAXIS2);
    this.crpix1 = String(header.CRPIX1);
    this.crpix2 = String(header.CRPIX2);
    this.crval1 = String(header.CRVAL1);
    this.crval2 = String(header.CRVAL2);
    // this.scaleArcsec = header.CDELT * 3600;
    // this.scale = String(header.CDELT2);
    this.crota2 = String(header.CROTA2);
    return header;
  }
}

export const state3 = new Form3State();

const FormProducts = observer((props) => {
  const options = [
    { text: 'XNICER map', value: 'XNICER map', color: 'blue' },
    { text: 'XNICER inverse variance', value: 'XNICER inverse variance', color: 'red' },
    { text: 'XNICEST map', value: 'XNICEST map', color: 'violet' },
    { text: 'XNICEST inverse variance', value: 'XNICEST inverse variance', color: 'pink' },
    { text: 'Star density', value: 'Star density', color: 'grey' }
  ];
  return (
    <Form.Dropdown multiple search selection fluid width={16} {...state3.props('products')}
      options={options} placeholder='Select products'
      renderLabel={option => ({ color: option.color, content: option.text })} {...props} />
  );
});

const FormDensity = observer(() => {
  const handleClick = action((e, value) => {
    state3.starsPerPixel = value;
  });

  return (
    <Form.Field width={8}>
      <div>
        Target density: {state3.starsPerPixel.toFixed(1)} stars/px
        <Slider min={1} max={20} value={state3.starsPerPixel} onChange={handleClick}
          size='tiny' color={state3.starsPerPixel < 20 ? 'blue' : 'red'} />
      </div>
    </Form.Field>
  )
});

const InputUnit = observer((props) => {
  const { name, label, unit } = props;
  // We cannot use directly state3.props below: the error appears in different components
  const { value, error, onChange } = state3.props(name);
  return (
    <FormField error={Boolean(error)} disabled={props.disabled} width={props.width}>
      {label ? <label>{label}</label> : <></>}
      <Input name={name} value={value} onChange={onChange}
        label={unit ? { basic: true, content: unit } : null}
        labelPosition={unit ? 'right' : null}
        {..._.omit(props, ['name', 'value', 'label', 'unit', 'width'])} />
      {error ? <Label prompt pointing role='alert'>{error}</Label> : <></>}
    </FormField>);
});

const projectionTypes = [
  { value: 'AZP', text: 'AZP: zenithal/azimuthal perspective' },
  { value: 'SZP', text: 'SZP: slant zenithal perspective' },
  { value: 'TAN', text: 'TAN: gnomonic' },
  { value: 'STG', text: 'STG: stereographic' },
  { value: 'SIN', text: 'SIN: orthographic/synthesis' },
  { value: 'ARC', text: 'ARC: zenithal/azimuthal equidistant' },
  { value: 'ZPN', text: 'ZPN: zenithal/azimuthal polynomial' },
  { value: 'ZEA', text: 'ZEA: zenithal/azimuthal equal area' },
  { value: 'AIR', text: 'AIR: Airy’s projection' },
  { value: 'CYP', text: 'CYP: cylindrical perspective' },
  { value: 'CEA', text: 'CEA: cylindrical equal area' },
  { value: 'CAR', text: 'CAR: plate carrée' },
  { value: 'MER', text: 'MER: Mercator\'s projection' },
  { value: 'COP', text: 'COP: conic perspective' },
  { value: 'COE', text: 'COE: conic equal area' },
  { value: 'COD', text: 'COD: conic equidistant' },
  { value: 'COO', text: 'COO: conic orthomorphic' },
  { value: 'SFL', text: 'SFL: Sanson-Flamsteed ("global sinusoid")' },
  { value: 'PAR', text: 'PAR: parabolic' },
  { value: 'MOL', text: 'MOL: Mollweide\'s projection' },
  { value: 'AIT', text: 'AIT: Hammer-Aitoff' },
  { value: 'BON', text: 'BON: Bonne\'s projection' },
  { value: 'PCO', text: 'PCO: polyconic' },
  { value: 'TSC', text: 'TSC: tangential spherical cube' },
  { value: 'CSC', text: 'CSC: COBE quadrilateralized spherical cube' },
  { value: 'QSC', text: 'QSC: quadrilateralized spherical cube' },
  { value: 'HPX', text: 'HPX: HEALPix' },
  { value: 'HPH', text: 'XPH: HEALPix polar, aka "butterfly"' }];

const FormProjection = observer((props) => {
  return (
    <Form.Dropdown selection search fluid width={4} {...state3.props('projection')}
      label='Projection' options={projectionTypes} placeholder='projection' {...props} />
  );
});
  
const FormCoosys = observer((props) => {
  const options = [
    { value: 'galactic', text: 'Galactic coordinates' },
    { value: 'equatorial', text: 'Equatorial coordinates' }
  ]
  return (
    <Form.Dropdown selection fluid width={4} {...state3.props('coosys')}
      label='Coordinate system' options={options} placeholder='coordinate system' {...props} />
  );
});

const FormScale = observer((props) => {
  const toggleLock = action(() => {
    state3.scaleLoocked = !state3.scaleLoocked;
    if (state3.scaleLoocked) state3.starsPerPixel = state3.starsPerPixel;
  });
  const options = [
    { key: 'deg', text: <b>°/px</b>, value: 1 },
    { key: 'arcmin', text: <b>'/px</b>, value: 60 },
    { key: 'arcsec', text: <b>"/px</b>, value: 3600 }
  ];
  // We cannot use directly state3.props below: the error appears in different components
  const { name, value, error, onChange } = state3.props('scale');
  const handleBlur = (e, { value }) => {
    state3.scaleArcsec = state3.scaleArcsec;
  };
  return (
    <FormField error={Boolean(error)} width={props.width}>
      <label>Pixel scale</label>
      <Input name={name} value={value} placeholder='scale' action iconPosition='left'
        onChange={onChange}>
        <Icon name={state3.scaleLoocked ? 'lock' : 'lock open'} link onClick={toggleLock} />
        <input />
        {error ? <Label prompt pointing role='alert'>{error}</Label> : <></>}
        <Select compact options={options} {..._.omit(state3.props('scaleUnit'), ['error'])} />
      </Input>
    </FormField>);
});

const FormIterations = observer((props) => {
  const options = _.map(_.range(1,6), n => ({ text: n, value: n }))
  return (
    <Form.Dropdown selection fluid width={4} {...state3.props('clipIters')}
      label='Iterations' options={options} placeholder='# iterations' {...props} />
  );
})

// Defaults values for projections parameters PVn, starting from n=1
// The numbers are: -1=unused, 0=0, 1=1, 2=?, 3=0°, 4=90°, 5=?°
const defaultPVs = {
  AZP: [-1, 0, 3], SZP: [-1, 0, 3, 4], SIN: [-1, 0, 0], ZPN: [0, 1, 0, 0],
  AIR: [-1, 4], CYP: [-1, 1, 1], CEA: [-1, 1], COP: [-1, 5, 3],
  COE: [-1, 5, 3], COD: [-1, 5, 3], COO: [-1, 5, 3], BON: [-1, 5]
};
const defaultLatpoles = {
  AZP: 4, SZP: 4, TAN: 4, STG: 4, SIN: 4, ARC: 4,
  ZPN: 4, ZEA: 4, AIR: 4, COP: 5, COE: 5, COD: 5, COO: 5
};

const FormPV = observer((props) => {
  const n = props.n;
  const proj = state3.projection
  const values = (defaultPVs[proj] === undefined) ? [] : defaultPVs[proj];
  const disabled = !(values[n] >= 0);
  const unit = (values[n] >= 3) ? '°' : '';
  return (
    <InputUnit label={`PV2_${n}`} disabled={disabled} placeholder={`pv2_${n}`} name={`pv2[${n}]`} unit={unit} width={4} />
  );
});

const ClearButton = observer(() => {
  return (
    <Button style={{ width: "110px" }} icon={state3.undo ? 'undo' : 'delete'} content={state3.undo ? 'Undo' : 'Clear'}
      color={state3.undo ? 'green' : 'red'} onClick={state3.resetOrUndo} />
  );
});

export function MyForm3(props) {
  const [wait, setWait] = React.useState(false);
  const [advanced, setAdvanced] = React.useState(false);

  function handleNext(e) {
    e.preventDefault();
    if (state3.validate()) props.onNext(e);
  }

  function handleBack(e) {
    e.preventDefault();
    props.onBack(e);
  }

  const handleMagic = action((e) => {
    let header = state3.guessWCS(props.state1);
  });

  const FormAngle = observer((props) => {
    const labels = {
      'galactic': { 'longitude': 'Galactic longitude', 'latitude': 'Galactic latitude' },
      'equatorial': { 'longitude': 'Right Ascension', 'latitude': 'Declination'}
    }
    const label = `${labels[state3.coosys][props.type]} of reference pixel`;
    const name = props.name;
    return (
      <InputAngle {...state3.props(props.name)} label={label} {...props} />
    );
  });

  return (
    <Container>
      <Dimmer.Dimmable blurring dimmed={Boolean(wait)}>
        <Dimmer active={Boolean(wait)} inverted >
          <Loader inverted indeterminate content={String(wait)} />
        </Dimmer>
        <Grid stackable columns={2}>
          <Grid.Column style={{ flex: "1" }}>
            <Form>
              <Header as='h2'>Map generation</Header>
              <Header as='h3' dividing>Selection of final products</Header>
              <Form.Group>
                <FormProducts />
              </Form.Group>
              <Header as='h3' dividing>Map parameters</Header>

              <Form.Group>
                <Form.Field width={8}>
                  <Button content='Guess parameters' icon='magic' labelPosition='left' basic size='small' 
                    onClick={handleMagic} />
                </Form.Field>
                <FormDensity />
              </Form.Group>
              <Header as='h4' dividing>Image coordinate system</Header>
              <Form.Group>
                <InputUnit label='Image width' placeholder='naxis1'
                  name='naxis1' unit='px' width={8} />
                <InputUnit label='Image height' placeholder='naxis2'
                  name='naxis2' unit='px' width={8} />
              </Form.Group>

              <Form.Group>
                <InputUnit label='X of reference pixel' placeholder='crpix1'
                  name='crpix1' unit='px' width={8} />
                <InputUnit label='Y of reference pixel' placeholder='crpix2'
                  name='crpix2' unit='px' width={8} />
              </Form.Group>
              <Form.Group>
                <FormAngle width={8} placeholder='crval1' name='crval1' type='longitude' />
                <FormAngle width={8} placeholder='crval2' name='crval2' type='latitude' />
              </Form.Group>
              <Form.Group>
                <FormScale width={8} />
                <InputUnit label='Rotation angle' placeholder='rot'
                  name='crota2' unit='°' width={8} />
              </Form.Group>
              <Form.Group>
                <FormProjection width={8} />
                <FormCoosys width={8} />
              </Form.Group>

              <Accordion as='h4'>
                <Accordion.Title active={advanced} className='h4' onClick={() => setAdvanced(!advanced)} >
                  <Header as='h4' dividing={advanced}>
                    <Icon name='dropdown' />Advanced Image coordinate system parameters
                  </Header>
                </Accordion.Title>
                <Accordion.Content active={advanced} >
                  <Form.Group>
                    <InputUnit label='Native longitude of celestial pole' placeholder='lonpole'
                      name='lonpole' unit='°' width={8} />
                    <InputUnit label='Native latitude of celestial pole' placeholder='latpole'
                      name='latpole' unit='°' width={8} />
                  </Form.Group>
                  <Form.Group>
                    <FormPV n={0} />
                    <FormPV n={1} />
                    <FormPV n={2} />
                    <FormPV n={3} />
                  </Form.Group>
                </Accordion.Content>
              </Accordion>

              <Header as='h4' dividing>Smoothing algorithm</Header>
              <Form.Group>
                <InputUnit label='Smoothing FWHM' placeholder='resolution'
                  name='smoothpar' unit='px' width={8} />
                <InputUnit label='Clipping' placeholder='clipping'
                  name='clipping' unit='σ' width={4} />
                <FormIterations />
              </Form.Group>

              <Button style={{ width: "110px" }} icon='left arrow' labelPosition='left' content='Back'
                onClick={handleBack} />
              <ClearButton />
              <Button primary style={{ width: "110px" }} icon='right arrow' labelPosition='right' content='Next'
                onClick={handleNext} />
            </Form>
          </Grid.Column>
          <Grid.Column style={{ width: "400px" }}>
          </Grid.Column>
        </Grid>
      </Dimmer.Dimmable>
    </Container>);
}
