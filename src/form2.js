// @ts-check
'use strict';

import React from 'react'

import './css/sql.css'
import _ from 'lodash'
import { observable, computed, configure, action } from 'mobx'
import { observer } from "mobx-react"
import { Container, Loader, Dimmer, Grid, Form, Header, Button, FormField, Input, Label } from 'semantic-ui-react'
import { InputAngle } from './inputangle.js'
import { CooFormState } from './cooform.js'

configure({ enforceActions: 'observed' });

export class Form2State extends CooFormState {
  @observable mask = '';
  @observable areaFraction = 50;
  @observable starFraction = 50;
  @observable reddeningLaw = [1.0];
  @observable bands = ['Ks'];
  @observable numComponents = 1;
  @observable maxExtinction = 3.0;
  @observable extinctionSteps = 5;
  @observable extinctionSubsteps = 5;

  validators = {
    lonCtr: x => x === '' && 'Please enter a valid coordinate',
    latCtr: x => x === '' && 'Please enter a valid coordinate',
    lonWdt: x => x === '' && 'Please enter a valid width',
    latWdt: x => x === '' && 'Please enter a valid width',
    lonMin: x => x === '' && 'Please enter a valid coordinate',
    latMin: x => x === '' && 'Please enter a valid coordinate',
    lonMax: x => x === '' && 'Please enter a valid coordinate',
    latMax: x => x === '' && 'Please enter a valid coordinate',
    areaFraction: x => !(x > 1 && x < 100) && 'The percentage must be between 1 and 100',
    starFraction: x => !(x > 1 && x < 100) && 'The percentage must be between 1 and 100',
    maxExtinction: x => !(x > 0 && x < 10) && 'The maximum extinction must be between 0 and 10'
  }
}

export const state2 = new Form2State();

const FormCooSys = observer((props) => {
  return (
    <Form.Group inline>
      <Form.Radio label='Galatic' name='cooSys' value='G'
        checked={state2.cooSys === 'G'} {...props} />
      <Form.Radio label='Equatorial (hms)' name='cooSys' value='E'
        checked={state2.cooSys === 'E'} {...props} />
      <Form.Radio label='Equatorial (degrees)' name='cooSys' value='D'
        checked={state2.cooSys === 'D'} {...props} />
    </Form.Group>
  );
});

const FormSymbad = observer((props) => {
  return (
    <Form.Input label='Object name (Simbad resolved)' action='Search' placeholder='object name' width={16}
      onKeyPress={(e) => ((e.keyCode || e.which || e.charCode || 0) === 13) && state2.handleSimbad()}
      {...state2.props('object')} onBlur={state2.handleSimbad} {...props} />);
});

const FormAngle = observer((props) => {
  return (
    <InputAngle value={state2[props.name]} onChange={state2.handleLinkedChange}
      error={state2.errors[props.name]} {...props} />
  );
});

const InputUnit = observer((props) => {
  const { name, label, unit } = props;
  // We cannot use directly state2.props below: the error appears in different components
  const { value, error, onChange } = state2.props(name);
  return (
    <FormField error={Boolean(error)} width={props.width}>
      {label ? <label>{label}</label> : <></>}
      <Input name={name} value={value} onChange={onChange}
        label={unit ? { basic: true, content: unit } : null}
        labelPosition={unit ? 'right' : null}
        {..._.omit(props, ['name', 'value', 'label', 'unit', 'width'])} />
      {error ? <Label prompt pointing role='alert'>{error}</Label> : <></>}
    </FormField>);
});

const NumComponents = observer((props) => {
  return (
    <Form.Dropdown selection {...state2.props('numComponents')} label='Number of components'
      options={_.map(_.range(1, 6), n => ({ text: String(n), value: n }))} placeholder='# components'
      {...props} />
  );
});

const ExtinctionSteps = observer((props) => {
  return (
    <Form.Dropdown selection {...state2.props('extinctionSteps')} label='Extinction steps'
      options={_.map(_.range(1, 9), n => ({ text: String(n), value: n }))} placeholder='# steps'
      {...props} />
  );
});

const ExtinctionSubsteps = observer((props) => {
  return (
    <Form.Dropdown selection {...state2.props('extinctionSubsteps')} label='Extinction substeps'
      options={_.map(_.range(1, 6), n => ({ text: String(n), value: n }))} placeholder='# subteps'
      {...props} />
  );
});

const ReddeningLaw = observer((props) => {
  return (
    <Form.Group widths='equal'>
      {_.map(state2.bands, (name, i) =>
        (<InputUnit fluid label={<>A<sub>{name}</sub> / A<sub>ref</sub></>}
          name={'reddeningLaw[' + i + ']'} key={name} />))}
    </Form.Group>
  )
});


const ClearButton = observer(() => {
  return (
    <Button style={{ width: "110px" }} icon={state2.undo ? 'undo' : 'delete'} content={state2.undo ? 'Undo' : 'Clear'}
      color={state2.undo ? 'green' : 'red'} onClick={state2.resetOrUndo} />
  );
});

export const MyForm2 = observer((props) => {
  const [wait] = React.useState(false);

  const handleChange = state2.handleChange;

  function handleNext(e) {
    e.preventDefault();
    state2.validate();
    // if (state2.validate()) props.onNext(e);
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
              <Header as='h2'>Control field</Header>
                  Ideally, the area selected for the control field should be as close as possible 
                  to the science field, but with as little as possible extinction.
                  <br/>
                  All coordinates can be entered in the format <i>dd:mm:ss.cc</i>, <i>dd:mm.ccc</i>
                  , or <i>dd.cccc</i>; alternatively, you can specify the area in map to the left
                  using the selection button (the square).
                <Header as='h3' dividing>Coordinate system</Header>
              <FormCooSys onChange={handleChange} />
              <Header as='h3' dividing>Rectangular selection: center and widths</Header>
              <FormSymbad />

              <Form.Group>
                <FormAngle label={'Center ' + state2.lonName} width={8} name='lonCtr' 
                  type={state2.cooSys != 'E' ? 'longitude' : 'hms'} />
                <FormAngle label={'Center ' + state2.latName} width={8} name='latCtr'
                  type='latitude' />
              </Form.Group>
              <Form.Group>
                <FormAngle label='Width' width={8} name='lonWdt' 
                  type={state2.cooSys != 'E' ? 'longitude' : 'hms'}
                  />
                <FormAngle label='Height' width={8} name='latWdt' 
                  type='longitude' />
              </Form.Group>
              <Header as='h3' dividing>Rectangular selection: corners</Header>
              <Form.Group>
                <FormAngle label={'Minimum ' + state2.lonName} width={8} name='lonMin' 
                  type={state2.cooSys != 'E' ? 'longitude' : 'hms'} />
                <FormAngle label={'Minimum ' + state2.latName} width={8} name='latMin' 
                  type='latitude' />
              </Form.Group>
              <Form.Group>
                <FormAngle label={'Maximum ' + state2.lonName} width={8} name='lonMax' 
                  type={state2.cooSys != 'E' ? 'longitude' : 'hms'} />
                <FormAngle label={'Maximum ' + state2.latName} width={8} name='latMax' 
                  type='latitude' />
              </Form.Group>

              <Header as='h2'>Calibration parameters</Header>
              <Header as='h3' dividing>Star selection</Header>
              The algorithm selects, within the control field, a region with low extinction and,
              within this region, stars with low extinction. Specify here the fractional area of
              the selected region and the fraction of the selected stars.
              <p />
              <Form.Group>
                <InputUnit label='Fraction of area to use' placeholder='Fractional area'
                  name='areaFraction' unit='%' width={8} />
                <InputUnit label='Fraction of stars to use' placeholder='Fractional stars'
                  name='starFraction' unit='%' width={8} />
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
                    name='maxExtinction' unit='mag' width={4} />
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
            </Form>
          </Grid.Column>
        </Grid>
      </Dimmer.Dimmable>
    </Container>);
});

