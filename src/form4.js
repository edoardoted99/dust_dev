// @ts-check
'use strict';

import React from 'react'

import _ from 'lodash'
import { observable, configure, action } from 'mobx'
import { observer } from "mobx-react"
import { Message, Divider, Button, Progress, Accordion, Modal, Header, Icon } from 'semantic-ui-react'
// import samp from './samp.js'

configure({ enforceActions: 'observed' });

export class State4 {
  /**
   * The state of the computation
   * @type {'wait'|'run'|'warning'|'error'|'end'|'abort'}
   * @memberof FormState4
   */
  @observable state = 'wait';
  
  /**
   * @type {null|object}
   * @memberof State4
   */
  @observable fitsFile = null;
}

export const state4 = new State4();

const DownloadProducts = React.lazy(() => import('./DownloadProducts.js'));

const LogArea = observer((props) => {
  const [active, setActive] = React.useState(false);
  function formatTime(time) {
    let t = Math.round(time);
    const seconds = t % 60;
    t = Math.floor(t / 60);
    const minutes = t % 60;
    t = Math.floor(t / 60);
    const hours = t % 100;
    return `${(hours < 10 ? '0' : '') + hours}:${(minutes < 10 ? '0' : '') + minutes}:${(seconds < 10 ? '0' : '') + seconds}`
  }
  function mapLinks(message) {
    const urlRegexp = /((?:http|ftp|https):\/\/(?:[\w_-]+(?:(?:\.[\w_-]+)+))(?:[\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-]))/g;
    let parts = message.split(urlRegexp), output = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 == 1)
        output.push(<a key={i} href={parts[i]} target='_blank'>{parts[i]}</a>);
      else
        output.push(<span key={i}>{parts[i]}</span>);
    }
    return output;
  }
  return (
    <Accordion fluid styled>
      <Accordion.Title content='Operation log' active={active} icon='dropdown' onClick={() => setActive(!active)} />
      <Accordion.Content active={active}>
        {props.log.filter(item => item.message[0] !== '%').map((item, idx) =>
          <div key={idx}>
            <i>{formatTime(item.time)}</i> - {mapLinks(item.message)}<br />
          </div>)}
      </Accordion.Content>
      {(props.percent > 0 && props.percent < 100) ?
        <Progress percent={props.percent} size='small' color='grey' attached='bottom' hidden />
        : <></>}
    </Accordion>
  );
});

export const FitsPanel = (props) => {
  const [sync, setSync] = React.useState(false);
  const colormaps = ['grey', 'heat', 'cool', 'turbo', 'viridis', 'magma', 'sls', 'a', 'b', 'bb'];
  const scales = ['linear', 'log', 'histeq', 'power', 'sqrt', 'squared', 'asinh', 'sinh'];
  // @ts-ignore
  const JS9 = window.JS9;

  return (
    <div hidden={props.hidden}>
      <div style={{ paddingBottom: '0.2em' }}>
        <Button.Group basic>
          <Button icon='home' onClick={() => {
            let data = JS9.GetImageData();
            JS9.SetZoom(1);
            JS9.SetPan(data.width / 2, data.height / 2);
          }} />
          <Button icon='zoom in' onClick={() => JS9.SetZoom('in')} />
          <Button icon='zoom out' onClick={() => JS9.SetZoom('out')} />
          <Button icon='expand arrows alternate' onClick={() => {
            let data = JS9.GetImageData();
            JS9.SetZoom('toFit')
            JS9.SetPan(data.width / 2, data.height / 2);
          }} />
        </Button.Group>
        {' '}
        <Button.Group basic>
          <Button icon='angle left' onClick={() => {
            JS9.SyncImages(['zoom', 'pan']);
            JS9.DisplayNextImage(-1)
          }} />
          <Button icon='angle right' onClick={() => {
            JS9.SyncImages(['zoom', 'pan']);
            JS9.DisplayNextImage(1)
          }} />
        </Button.Group>
        {' '}
        <Button.Group basic>
          <Button icon='tint' onClick={() => {
            let colormap = JS9.GetColormap().colormap;
            let c = colormaps.indexOf(colormap);
            if (c >= 0) JS9.SetColormap(colormaps[(c + 1) % colormaps.length]);
            else JS9.SetColormap(colormaps[0]);
          }} />
          <Button icon='sliders horizontal' onClick={() => {
            let scale = JS9.GetScale().scale;
            let s = scales.indexOf(scale);
            if (s >= 0) JS9.SetScale(scales[(s + 1) % scales.length]);
            else JS9.SetScale(scales[0]);
          }} />
        </Button.Group>
        {' '}
        <Button.Group basic>
          <Button icon={{ name: 'trash', color: 'red' }} onClick={() => JS9.CloseImage()} />
        </Button.Group>
      </div>
      <div className="JS9" id='JS9' data-width="400px" data-height="400px"></div>
      <div style={{ marginTop: '0.2em' }}></div>
      <div className="JS9Statusbar" data-width="400px"></div>
    </div>
  );
}


const ConfirmButton = (props) => {
  const [open, setOpen] = React.useState(false);

  return <Modal basic onClose={() => setOpen(false)} onOpen={() => setOpen(true)}
    open={open} size='small' trigger={props.trigger}>
    <Header icon>
      <Icon name={props.icon} />{props.header}</Header>
    <Modal.Content>
      <p>
        {props.message}
      </p>
    </Modal.Content>
    <Modal.Actions>
      <Button basic color='green' inverted onClick={() => setOpen(false)}>
        <Icon name='remove' /> No
      </Button>
      <Button color='red' inverted onClick={(e) => { props.action(e); setOpen(false); }}>
        <Icon name='checkmark' /> Yes
      </Button>
    </Modal.Actions>
  </Modal>
};

export const MyForm4 = observer((props) => {
  const [log, setLog] = React.useState([]);

  const handleAbort = action((e) => {
    const axios = require('axios').default;
    e.preventDefault();
    props.onAbort();
  });

  const handleRetry = action((e) => {
    const axios = require('axios').default;
    e.preventDefault();
    axios
      .post('/app/process', {}, { timeout: 30000 })
      .then(action(response => {
      }))
      .catch(action(error => {
        console.log(error);
        state4.state = 'warning';
      }));
  });

  const handleStop = action((e) => {
    const axios = require('axios').default;
    e.preventDefault();
    axios
      .post('/app/stop_process', {}, { timeout: 30000 })
      .then(action(response => {
      }))
      .catch(action(error => {
        console.log(error);
        state4.state = 'warning';
      }));
  });

  React.useEffect(() => {
    const axios = require('axios').default;
    let interval = setInterval(() => {
      axios
        .post('/app/monitor', {})
        .then(action(response => {
          if (response.data.success) {
            setLog(response.data.log);
            let state;
            if (response.data.log.length === 0) 
              state = 'run';
            else
              state = response.data.log[response.data.log.length - 1].state;
            state4.state = state;
            if (state === 'end') {
              clearInterval(interval);
              interval = null;
            }
          } else state4.state = 'warning';
        }))
        .catch(action(error => {
          console.log(error);
          state4.state = 'warning';
        }));
    }, 1000);
    return ((my_interval) =>
      (() => {
        my_interval && clearInterval(my_interval);
      }))(interval);
  }, []);

  let step = 0, message = '', subpercent = 100;
  if (log.length > 0) {
    let last = log[log.length - 1];
    step = last.step;
    message = last.message;
    if (message !== '' && message[0] === '%') {
      subpercent = parseFloat(message.substr(1));
      if (log.length > 1) {
        last = log[log.length - 2];
        step = last.step;
        message = last.message;
      } else {
        step = 0;
        message = '';
      }
    }
  }
  if (state4.state === 'warning') message = 'Network error';
  return (
    <>
      <Header as='h2'>Pipeline results</Header>

`      <Message>
        <Message.Header>Thank you for using this service!</Message.Header>
        <p></p>
        {state4.state !== 'end' ?
          <>
            <p>The products requested are now being processed.</p>
            <p>Please do not close this page: as soon as the processing is concluded, the
              products you requested will be available here for you to download.</p>
          </> :
          <>
            <p>The products are ready: you can download them using the button below.</p>
            <p>All images can also be displayed in the right panel using
              the <a href="https://js9.si.edu" target="_blank">JS9 viewer</a> or in your
              desktop with
              a <a href="https://www.ivoa.net/documents/SAMP/" target="_blank">SAMP</a>-enabled
              application (such as
              the <a href="https://aladin.u-strasbg.fr" target="_blank">Aladin</a> sky viewer).
            </p>
          </>}
        <Progress active={step >= 0 && state4.state === 'run'} value={step > 0 ? step : 0} total='12'
          progress={state4.state === 'run' ? 'ratio' : false} success={state4.state === 'end'}
          warning={state4.state === 'warning'} error={state4.state === 'error'} color='blue' >
          {message}
        </Progress>
        <LogArea log={log} percent={subpercent}/>
        {state4.state === 'end' ? 
          <>
            <Divider horizontal>Products</Divider>
            <React.Suspense fallback={<div>Loading...</div>}>
              <DownloadProducts products={props.products} coosys={props.coosys} />
            </React.Suspense>
          </> : <></>}
        <Divider horizontal>Actions</Divider>
        {(state4.state === 'error' || state4.state === 'abort') ?
          <>
            <ConfirmButton action={handleAbort} header='Abort computation' icon='eject'
              message={'This will abort all calculations and will delete all database queries ' +
                'performed. Do you confirm this operation?'}
              trigger={<Button negative content='Abort' icon='eject' labelPosition='left' />} />
            <Button primary content='Retry' icon='play' labelPosition='left' onClick={handleRetry} />
          </> : 
          (state4.state === 'run' || state4.state === 'warning') ?
            <ConfirmButton action={handleStop} header='Stop computation' icon='stop circle outline'
              message={'This will interrupt all calculations: you will be able to restart them ' +
                'without performing new database queries, but all computations will be discarded. ' +
                'Do you confirm this operation?'}
              trigger={<Button negative content='Stop' icon='stop' labelPosition='left' />} />
            :
            <Button primary content='Restart' icon='undo' labelPosition='left' onClick={handleAbort} />
          }
      </Message>
    </>
  );
});
