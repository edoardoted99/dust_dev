// @ts-check
'use strict';

import React from 'react'

import _ from 'lodash'
import { observable, computed, configure, action } from 'mobx'
import { observer } from "mobx-react"
import { Container, Grid, Message, Divider, Button, Progress, Accordion, Modal, Header, Icon } from 'semantic-ui-react'
// import './samp.js'
const samp = require('./samp.js')


configure({ enforceActions: 'observed' });

export class State4 {
  /**
   * The state of the computation
   * @type {'wait'|'run'|'warning'|'error'|'end'|'abort'}
   * @memberof FormState4
   */
  @observable state = 'wait';
}

export const state4 = new State4();

function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

const LogArea = observer((props) => {
  const [active, setActive] = React.useState(true);
  function formatTime(time) {
    let t = Math.round(time);
    const seconds = t % 60;
    t = Math.floor(t / 60);
    const minutes = t % 60;
    t = Math.floor(t / 60);
    const hours = t % 100;
    return `${(hours < 10 ? '0' : '') + hours}:${(minutes < 10 ? '0' : '') + minutes}:${(seconds < 10 ? '0' : '') + seconds}`
  }
  return (
    <Accordion fluid styled>
      <Accordion.Title content='Operation log' active={active} icon='dropdown' onClick={() => setActive(!active)} />
      <Accordion.Content active={active}>
        {props.log.map((item, idx) =>
          <div key={idx}>
            <i>{formatTime(item.time)}</i> - {item.message}<br />
          </div>)}
      </Accordion.Content>
    </Accordion>
  );
});

const DownloadProducts = observer((props) => {
  const [sampActive, setSampActive] = React.useState(false);
  const connector = React.useRef(new samp.samp.Connector("Sender"));

  React.useEffect(() => {
    connector.current.onHubAvailability(hubRunning => setSampActive(hubRunning), 2000);
  }, [])

  const loadSampImage = (e, filename) => {
    const l = window.location;
    const url = l.protocol + '//' + l.hostname + ':' + l.port + '/app/products/' + getCookie('session_id') + '/' + filename;
    connector.current.runWithConnection(function (connection) {
      var msg = new samp.samp.Message('image.load.fits',
        {
          url: url,
          name: filename,
        });
      connection.notifyAll([msg]);
    }, function () {
      alert('Error connecting to SAMP');
    });
  };

  const products = {
    'XNICER map': { filename: 'ext_map.fits', color: 'blue' },
    'XNICER inverse variance': { filename: 'ext_ivar.fits', color: 'red' },
    'XNICEST map': { filename: 'xext_map.fits', color: 'violet' },
    'XNICEST inverse variance': { filename: 'xext_ivar.fits', color: 'pink' },
    'Star density': { filename: 'density.fits', color: 'grey' }
  };
  return (
    <>
      {_.map(props.products, name => (
        <Button.Group key={name}>
          <Button animated='vertical' color={products[name].color}
            href={'/app/download?filename=' + products[name].filename}>
            <Button.Content hidden content='Download' />
            <Button.Content visible content={name} />
          </Button>
          <Button color={products[name].color} basic icon={{name: 'feed', className: 'faa-flash'}}
            disabled={!sampActive} onClick={e => loadSampImage(e, products[name].filename)} />
        </Button.Group>
      ))}
    </>
  );
});

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
    axios
      .post('/app/abort_process', {}, { timeout: 30000 })
      .then(action(response => {
      }))
      .catch(action(error => {
        console.log(error);
        state4.state = 'warning';
      }));
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
    return () => interval && clearInterval(interval);
  }, []);

  let percent = 0, message = '';
  if (log.length > 0) {
    percent = log[log.length - 1].percent;
    message = log[log.length - 1].message;
  }
  if (state4.state === 'warning') message = 'Network error';
  return (
    <Container>
      <Grid>
        <Grid.Column width={2} />
        <Grid.Column width={12}>
          <Message>
            <Message.Header>Thank you for using this service!</Message.Header>
            <p></p>
            <p>The products requested are now being processed.</p>
            <p>Please do not close this page: as soon as the processing is concluded, the
            products you requested will be available here for you to download.</p>
            <Progress percent={percent >= 0 ? percent : 100}
              progress={state4.state === 'run'} success={state4.state === 'end'}
              warning={state4.state === 'warning'} error={state4.state === 'error'} size='small' color='blue' >
              {message}
            </Progress>
            <LogArea log={log} />
            {state4.state === 'end' ? 
              <>
                <Divider horizontal>Products</Divider>
                <DownloadProducts products={props.products} />
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
        </Grid.Column>
        <Grid.Column width={2} />
      </Grid>
    </Container>
  );
});
