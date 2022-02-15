// @ts-check
'use strict';

import React from 'react'

import _ from 'lodash'
import { observable, action, configure } from 'mobx'
import { observer } from 'mobx-react'
import { Container, Message, Form, Header, Button, Divider } from 'semantic-ui-react'
import { CooFormState, CooForm } from './cooform.js'
import { InputUnit } from './inputunit.js'
import { Helper, HelperButton } from './helper.js';

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
    lonWdt: x => (this.shape === 'B' && x.length <= 1) && 'Please enter a valid width',
    latWdt: x => (this.shape === 'B' && x.length <= 1) && 'Please enter a valid width',
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
    const starsPerPixel = 10;
    let crval1 = this.lonCtrAngle.degrees, crval2 = this.latCtrAngle.degrees;
    let lonRad = (this.shape === 'C') ? this.radiusAngle.degrees : this.lonWdtAngle.degrees / 2;
    let latRad = (this.shape === 'C') ? this.radiusAngle.degrees : this.latWdtAngle.degrees / 2;
    if (crval1 < 0) crval1 += 360;
    const aspect = lonRad / latRad;
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
    <Helper wide content='The number of Gaussian distributions to use in the mixture probability that describes 
    the colors of stars. Use a small number for fast calculations. Large values (generally) can capture better
    substructures in the color distribution, resulting in slightly reduced errors.'>
      <Form.Dropdown selection fluid {...state2.props('numComponents')} label='Number of components'
        options={_.map(_.range(1, 6), n => ({ text: String(n), value: n }))} placeholder='# components'
        {...props} />
    </Helper>
  );
});

const ExtinctionSteps = observer((props) => {
  return (
    <Helper wide content='The algorithm is able to simulate the effects of extinction on the population of control 
    field stars and to perform a new training. This is useful, e.g., when the original background population is composed of
    different classes of objects with different intrinsic colors, with one class fainter than the other (for example, stars
    and galaxies). When extinction occurs, the fainter objects are missing and the distribution of observed colors changes'>
      <Form.Dropdown selection fluid {...state2.props('extinctionSteps')} label='Extinction steps'
        options={_.map(_.range(1, 9), n => ({ text: String(n), value: n }))} placeholder='# steps'
        {...props} />
    </Helper>
  );
});

const ExtinctionSubsteps = observer((props) => {
  return (
    <Helper wide content='On top of the extinction steps of the previous input, the algorithm can also perform a-posteriori
    calibration at various extinction substeps. This helps to remove any form of bias which might be still left'>
      <Form.Dropdown selection fluid {...state2.props('extinctionSubsteps')} label='Extinction substeps'
        options={_.map(_.range(1, 6), n => ({ text: String(n), value: n }))} placeholder='# subteps'
        {...props} />
    </Helper>
  );
});

const ReddeningLaw = observer((props) => {
  return (
    <Helper wide='very' position='top center' content='The reddening law for the various bands can be modified, if necessary, 
    here'>
      <Form.Group widths='equal'>
        {_.map(state2.bands, (name, i) =>
        (<InputUnit fluid label={<>A<sub>{name}</sub> / A<sub>ref</sub></>}
          name={'reddeningLaw[' + i + ']'} key={name} state={state2} />))}
      </Form.Group>
    </Helper>
  )
});

const ClearButton = observer(() => {
  return (
    <Helper content={state2.undo ? 'Undo the last operation' : 'Cancel all fields and restore default values'}>
      <Button style={{ width: "110px" }} icon={state2.undo ? 'undo' : 'delete'} content={state2.undo ? 'Undo' : 'Clear'}
        color={state2.undo ? 'green' : 'red'} onClick={state2.resetOrUndo} />
    </Helper>
  );
});

const FormMessage = observer(() => {
  return (state2.messageType === null) ? <></> : <Message {...state2.messageProps} />
});

export const MyForm2 = observer((props) => {
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
      <Form autoComplete='off'>
        <Header as='h2'>Control field</Header>
        Ideally, the area selected for the control field should be as close as possible
        to the science field, but with as little as possible extinction.
        <br />
        All coordinates can be entered in the format <i>dd:mm:ss.cc</i>, <i>dd:mm.ccc</i>
        , or <i>dd.cccc</i>; alternatively, you can specify the area in map to the left
        using the selection button (the square).
        <p></p>
        <Helper wide='very' content='Use this button to copy the entire science field parameters here. This is a quick way to 
          start the analysis, but is generally not recommended, as the science field is clearly affected by extinction.'>
          <Button content='Copy science field area' icon='clone outline' labelPosition='left' basic size='small'
            onClick={handleCopy} />
        </Helper>
        <Divider hidden />
        <CooForm cooform={state2} />

        <Header as='h2'>Calibration parameters</Header>
        <Header as='h3' dividing>Star selection</Header>
            The algorithm selects, within the control field, a region with low extinction and,
            within this region, stars with low extinction. Specify here the fractional area of
            the selected region and the fraction of the selected stars.
            <p />
        <Form.Group>
          <Helper wide content='The algorithm will perform a first extinction map of the control field, and then will select 
          for the calibration of the science fields only stars in the control field contained in the lower extinction regions.
          This parameter sets the fraction of the area of the control field to use: for example, 70% will discard the 30%
          regions in the control field with the largest extinction.'>
            <InputUnit label='Fraction of area to use' placeholder='Fractional area'
              name='areaFraction' unit='%' width={8} state={state2} />
          </Helper>
          <Helper wide content='The algorithm will only use the specified fraction of control field stars with the lowest star 
          extinction. For example, entering 70% here will discard the 30% most extinguished stars in the control field.'>
            <InputUnit label='Fraction of stars to use' placeholder='Fractional stars'
              name='starFraction' unit='%' width={8} state={state2} />
          </Helper>
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
          <Helper wide content='The maximum extinction to consider in the entire calibration process. Do not exceed here: a very 
          large extinction would break the algorithm, since no stars would be observable then!'>
            <InputUnit label='Max extinction' placeholder='max extinction'
              name='maxExtinction' unit='mag' width={4} state={state2} />
          </Helper>
          <ExtinctionSteps width={4} />
          <ExtinctionSubsteps width={4} />
        </Form.Group>

        <Header as='h3' dividing>Reddening law</Header>
        <ReddeningLaw reddeningLaw={props.reddeningLaw} />

        <Helper content='Click to go back to the previous page'>
          <Button style={{ width: "110px" }} icon='left arrow' labelPosition='left' content='Back'
            onClick={handleBack} />
        </Helper>
        <ClearButton />
        <Helper content='When ready, click to proceed to the next page'>
          <Button primary style={{ width: "110px" }} icon='right arrow' labelPosition='right' content='Next'
            onClick={handleNext} />
        </Helper>
        <HelperButton />
        <Helper wide position='top right' content='Download the a (partial) configuration:
          the file can then be used on the first page to restore the parameters entered so far'>
          <Button icon='download' floated='right' onClick={props.downloader} />
        </Helper>
      </Form>
      <FormMessage />
    </Container>);
});

