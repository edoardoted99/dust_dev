// @ts-check
'use strict';

import React from 'react'

import _ from 'lodash'
import { configure } from 'mobx'
import { observer } from "mobx-react"
import { Button } from 'semantic-ui-react'
import samp from './samp.js'

configure({ enforceActions: 'observed' });

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

const DownloadProducts = observer((props) => {
  const [sampActive, setSampActive] = React.useState(false);
  const connector = React.useRef(new samp.samp.Connector("Sender"));

  React.useEffect(() => {
    let interval = connector.current.onHubAvailability(hubRunning => setSampActive(hubRunning), 2000);
    return ((my_interval) =>
    (() => {
      my_interval && clearInterval(my_interval);
    }))(interval);
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
    'XNICER map': { text: 'XNICER map', filename: 'ext_map.fits', color: 'blue' },
    'XNICER inverse variance': { text: 'XNICER ivar', filename: 'ext_ivar.fits', color: 'red' },
    'XNICEST map': { text: 'NICER map', filename: 'xext_map.fits', color: 'violet' },
    'XNICEST inverse variance': { text: 'NICER ivar', filename: 'xext_ivar.fits', color: 'pink' },
    'Star density': { text: 'Density', filename: 'density.fits', color: 'grey' }
  };

  const js9options = { scale: 'sqrt' };
  return (
    <div>
      {_.map(props.products, name => (
        <span key={name}>
          <Button.Group>
            <Button animated='vertical' color={products[name].color}
              href={'/app/download?filename=' + products[name].filename}>
              <Button.Content hidden content='Download' />
              <Button.Content visible content={products[name].text} />
            </Button>
            <Button color={products[name].color} basic icon={{ name: 'eye' }}
              onClick={() => {
                // @ts-ignore
                JS9.Load('/app/download?filename=' + products[name].filename, js9options);
              }} />
            <Button color={products[name].color} basic icon={{ name: 'feed', className: 'faa-flash' }}
              disabled={!sampActive} onClick={e => loadSampImage(e, products[name].filename)} />
          </Button.Group>
          {' '}
        </span>
      ))}
    </div>
  );
});

export { DownloadProducts as default }
