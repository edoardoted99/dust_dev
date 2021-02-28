// @ts-check
'use strict';

import React from 'react'

import _ from 'lodash'
import { observable, action, configure } from 'mobx'
import { observer } from 'mobx-react'
import { Container, Icon, Dimmer, Message, Form, Header, Button, Divider } from 'semantic-ui-react'
import { CooFormState, CooForm } from './cooform.js'
import { InputUnit } from './inputunit.js'

configure({ enforceActions: 'observed' });

export class Form2State extends CooFormState {
  @observable areaFraction = 50;
  @observable starFraction = 50;
  @observable reddeningLaw = [1.0];
  @observable bands = ['Ks'];
  @observable numComponents = 1;
  @observable maxExtinction = 3.0;
  @observable extinctionSteps = 5;
  @observable extinctionSubsteps = 5;

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
    areaFraction: x => !(x > 1 && x < 100) && 'The percentage must be between 1 and 100',
    starFraction: x => !(x > 1 && x < 100) && 'The percentage must be between 1 and 100',
    maxExtinction: x => !(x > 0 && x < 10) && 'The maximum extinction must be between 0 and 10',
    reddeningLaw: xs => _.map(xs, x => !(x > 0 && x < 100) && 'The coefficient must be between 0 and 100'),
    // Empty validators
    cooSys: x => false,
    shape: x => false,
    object: x => false,
    lonType: x => false,
    latType: x => false,
    numComponents: x => false,
    extinctionSteps: x => false,
    extinctionSubsteps: x => false
  };

  @action.bound guessWCS() {
    let lonMin = this.lonMinAngle.degrees, lonMax = this.lonMaxAngle.degrees,
      latMin = this.latMinAngle.degrees, latMax = this.latMaxAngle.degrees;
    const starsPerPixel = 10;
    if (lonMin > lonMax) lonMin -= 360;
    let crval1 = (lonMin + lonMax) * 0.5;
    if (crval1 < 0) crval1 += 360;
    let crval2 = (latMin + latMax) * 0.5;
    const aspect = (lonMax - lonMin) * Math.cos(crval2 * Math.PI / 180.0) / (latMax - latMin);
    const scale = Math.sqrt(starsPerPixel / this.density);
    const naxis1 = Math.ceil((Math.floor(Math.sqrt(this.area * aspect) / scale * 1.1) + 20) / 10) * 10;
    const naxis2 = Math.ceil((Math.floor(Math.sqrt(this.area / aspect) / scale * 1.1) + 20) / 10) * 10;
    const ctypes = (this.cooSys === 'G') ? ['GLON-TAN', 'GLAT-TAN'] : ['RA---TAN', 'DEC--TAN'];
    let header = {
      SIMPLE: 'T', BITPIX: -32, NAXIS: 2,
      NAXIS1: naxis1, NAXIS2: naxis2,
      CRPIX1: naxis1 / 2.0, CRPIX2: naxis2 / 2.0,
      CTYPE1: ctypes[0], CTYPE2: ctypes[1],
      CRVAL1: Math.round(crval1 * 1e6) / 1e6, CRVAL2: Math.round(crval2 * 1e6) / 1e6,
      CDELT1: -scale, CDELT2: scale,
      CROTA2: 0.0, EQUINOX: 2000.0
    };
    return header;
  }
}

export const state2 = new Form2State();
state2.step = 2;

const NumComponents = observer((props) => {
  return (
    <Form.Dropdown selection fluid {...state2.props('numComponents')} label='Number of components'
      options={_.map(_.range(1, 6), n => ({ text: String(n), value: n }))} placeholder='# components'
      {...props} />
  );
});

const ExtinctionSteps = observer((props) => {
  return (
    <Form.Dropdown selection fluid {...state2.props('extinctionSteps')} label='Extinction steps'
      options={_.map(_.range(1, 9), n => ({ text: String(n), value: n }))} placeholder='# steps'
      {...props} />
  );
});

const ExtinctionSubsteps = observer((props) => {
  return (
    <Form.Dropdown selection fluid {...state2.props('extinctionSubsteps')} label='Extinction substeps'
      options={_.map(_.range(1, 6), n => ({ text: String(n), value: n }))} placeholder='# subteps'
      {...props} />
  );
});

const ReddeningLaw = observer((props) => {
  return (
    <Form.Group widths='equal'>
      {_.map(state2.bands, (name, i) =>
      (<InputUnit fluid label={<>A<sub>{name}</sub> / A<sub>ref</sub></>}
        name={'reddeningLaw[' + i + ']'} key={name} state={state2} />))}
    </Form.Group>
  )
});

const ClearButton = observer(() => {
  return (
    <Button style={{ width: "110px" }} icon={state2.undo ? 'undo' : 'delete'} content={state2.undo ? 'Undo' : 'Clear'}
      color={state2.undo ? 'green' : 'red'} onClick={state2.resetOrUndo} />
  );
});

const FormMessage = observer(() => {
  return (state2.messageType === null) ? <></> : <Message {...state2.messageProps} />
});

export const MyForm2 = observer((props) => {
  const [wait, setWait] = React.useState('');
  const [waitIcon, setWaitIcon] = React.useState('spinner');

  const handleNext = action((e) => {
    e.preventDefault();
    if (state2.validate()) {
      state2.setMessage(0, true, null, () => {
        props.onNext(e);
      });
    }
  });

  function handleBack(e) {
    e.preventDefault();
    props.onBack(e);
  }

  function handleCopy(e) {
    state2.copyFrom(props.state1);
  }

  return (
    <Container>
      <>
        <Dimmer active={Boolean(wait)} page>
          <Header as='h3' icon inverted>
            <Icon // @ts-ignore
              name={waitIcon} loading={waitIcon === 'spinner'} />
            {String(wait)}
          </Header>
        </Dimmer>
        <Form autoComplete='off'>
          <Header as='h2'>Control field</Header>
              Ideally, the area selected for the control field should be as close as possible
              to the science field, but with as little as possible extinction.
              <br />
              All coordinates can be entered in the format <i>dd:mm:ss.cc</i>, <i>dd:mm.ccc</i>
              , or <i>dd.cccc</i>; alternatively, you can specify the area in map to the left
              using the selection button (the square).
              <p></p>
          <Button content='Copy science field area' icon='clone outline' labelPosition='left' basic size='small'
            onClick={handleCopy} />
          <Divider hidden />
          <CooForm cooform={state2} />

          <Header as='h2'>Calibration parameters</Header>
          <Header as='h3' dividing>Star selection</Header>
              The algorithm selects, within the control field, a region with low extinction and,
              within this region, stars with low extinction. Specify here the fractional area of
              the selected region and the fraction of the selected stars.
              <p />
          <Form.Group>
            <InputUnit label='Fraction of area to use' placeholder='Fractional area'
              name='areaFraction' unit='%' width={8} state={state2} />
            <InputUnit label='Fraction of stars to use' placeholder='Fractional stars'
              name='starFraction' unit='%' width={8} state={state2} />
          </Form.Group>

          <Header as='h3' dividing>Extreme deconvolution</Header>
              The extreme deconvolution algorithm models the intrinsic colors of stars in the
              control field using a Gaussian mixture model with a given number of components.
              Additionally, the algorithm used here, performs deconvolutions at various extinction
              levels to capture the change in the population of background stars induced by the
              extinction.
              <p />
          <Form.Group>
            <NumComponents width={4} />
            <InputUnit label='Max extinction' placeholder='max extinction'
              name='maxExtinction' unit='mag' width={4} state={state2} />
            <ExtinctionSteps width={4} />
            <ExtinctionSubsteps width={4} />
          </Form.Group>

          <Header as='h3' dividing>Reddening law</Header>
          <ReddeningLaw reddeningLaw={props.reddeningLaw} />

          <Button style={{ width: "110px" }} icon='left arrow' labelPosition='left' content='Back'
            onClick={handleBack} />
          <ClearButton />
          <Button primary style={{ width: "110px" }} icon='right arrow' labelPosition='right' content='Next'
            onClick={handleNext} />
          <Button icon='help' toggle floated='right' />
          <Button icon='download' floated='right' onClick={props.downloader} />
        </Form>
        <FormMessage />
      </>
    </Container>);
});

