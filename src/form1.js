// @ts-check
'use strict';

import React from 'react'

import _ from 'lodash'
import { configure, action } from 'mobx'
import { observer } from "mobx-react"
import { Container, Loader, Dimmer, Message, Form, Header, Button, Icon, IconGroup } from 'semantic-ui-react'
import { InputAngle } from './inputangle.js'
import { CooFormState } from './cooform.js'

configure({ enforceActions: 'observed' });

export const state1 = new CooFormState();
state1.step = 1;

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
    <Form.Input label='Object name (Simbad resolved)' action='Search' placeholder='object name' width={16}
      onKeyPress={(e) => ((e.keyCode || e.which || e.charCode || 0) === 13) && state1.handleSimbad(e)}
      {...state1.props('object')} onBlur={state1.handleSimbad} {...props} />);
});

const FormAngle = observer((props) => {
  return (
    <InputAngle value={state1[props.name]} onChange={state1.handleLinkedChange}
      error={state1.errors[props.name]} {...props} />
  );
});

const ClearButton = observer(() => {
  return (
    <Button style={{ width: "110px" }} icon={state1.undo ? 'undo' : 'delete'} content={state1.undo ? 'Undo' : 'Clear'}
      color={state1.undo ? 'green' : 'red'} onClick={state1.resetOrUndo} />
  );
});

const FormMessage = observer(() => {
  return (state1.messageType === null) ? <></> : <Message {...state1.messageProps} />;
});

export const MyForm1 = observer((props) => {
  const [wait, setWait] = React.useState('');
  const [waitIcon, setWaitIcon] = React.useState('');

  const handleNext = action((e) => {
    e.preventDefault();
    if (state1.validate()) {
      state1.setMessage(0, true, null, () => {
        props.onNext(e);
      });
    }
  });

  function handleBack(e) {
    e.preventDefault();
    props.onBack(e);
  }

  return (
    <Container>
      <>
        <Dimmer active={Boolean(waitIcon)} page
          onClick={(e) => {
            if (waitIcon !== 'spinner') setWaitIcon('');
            if (waitIcon === 'check') props.onNext(e);
          }}>
          <Header as='h3' icon inverted>
            <Icon // @ts-ignore
              name={waitIcon} loading={waitIcon === 'spinner'} />
            {String(wait)}
          </Header>
        </Dimmer>
        <Form autoComplete='off'>
          <Header as='h2'>Area selection</Header>
            All coordinates can be entered in the format <i>dd:mm:ss.cc</i>, <i>dd:mm.ccc</i>
            , or <i>dd.cccc</i>; alternatively, you can specify the area in map to the left
            using the selection button (the square).
          <Header as='h3' dividing>Coordinate system</Header>
          <FormCooSys onChange={state1.handleChange} />
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

          <p></p>
          <Button style={{ width: "110px" }} icon='left arrow' labelPosition='left' content='Back'
            onClick={handleBack} />
          <ClearButton />
          <Button primary style={{ width: "110px" }} icon='right arrow' labelPosition='right' content='Next'
            onClick={handleNext} />
          <Button icon='help' toggle floated='right' />
          <Button icon='download' floated='right' onClick={props.downloader}/>
        </Form>
        <FormMessage />
      </>
    </Container>);
});

