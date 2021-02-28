// @ts-check
'use strict';

import React from 'react'
import { autorun, action } from 'mobx'
import { observer } from 'mobx-react'
import { Button, Divider } from 'semantic-ui-react'
import { galactic2equatorial } from './coordinates.js'
import { sphereLine, sphereCircle } from './spherical.js'
import './css/aladin.css';

const hipsMaps = [

]

export const AladinForm = observer((props) => {
  const aladin = React.useRef(null);
  const surveys = React.useRef([]);
  const constellations = React.useRef([]);
  const overlay = React.useRef(null);
  const fitsFile = React.useRef({ url: null, name: '', coosys: '' });
  const cooformRef = React.useRef(props.cooform);
  cooformRef.current = props.cooform;

  // Main window display
  React.useEffect(() => {
    aladin.current = A.aladin('#aladin-lite-div', {
      cooFrame: 'galactic',
      fov: 180,
      showLayersControl: false,
      showGotoControl: false,
      showZoomControl: false,
      showFullscreenControl: false,
      showFrame: false
    });
    // Surveys found at http://aladin.u-strasbg.fr/hips/list
    // Other possible interesting ones
    // http://alasky.u-strasbg.fr/CO/
    // http://alasky.u-strasbg.fr/unWISE/color-W2-W1W2-W1/
    // http://skies.esac.esa.int/Herschel/SPIRE-color/

    surveys.current.push(
      aladin.current.createImageSurvey('PLANCK HFI-857', 'PLANCK HFI-857',
        'http://skies.esac.esa.int/pla/HFI_SkyMap_857_2048_R3_00_full_HiPS',
        'galactic', 3, { imgFormat: 'png' }));
    surveys.current.push(
      aladin.current.createImageSurvey('WISE WSSA 12um', 'WISE WSSA 12um',
        'http://alasky.u-strasbg.fr/WSSA',
        'equatorial', 7, { imgFormat: 'jpg' }));
    surveys.current.push(
      aladin.current.createImageSurvey('Gaia EDR3 flux map', 'Gaia EDR3 flux map',
        'http://alasky.u-strasbg.fr/ancillary/GaiaEDR3/color-Rp-G-Bp-flux-map',
        'equatorial', 7, { imgFormat: 'jpg' }));
    surveys.current.push(
      aladin.current.createImageSurvey('Mellinger color', 'Mellinger color',
        'http://alasky.u-strasbg.fr/MellingerRGB',
        'galactic', 4, { imgFormat: 'jpg' }));
    constellations.current.push(
      aladin.current.createImageSurvey('CONSTELLATIONS1', 'CONSTELLATIONS1',
        'https://darts.isas.jaxa.jp/pub/judo2/HiPS/Constellations1',
        'equatorial', 6, { imgFormat: 'png' }));
    constellations.current.push(
      aladin.current.createImageSurvey('CONSTELLATIONS2', 'CONSTELLATIONS2',
        'https://darts.isas.jaxa.jp/pub/judo2/HiPS/Constellations2',
        'equatorial', 6, { imgFormat: 'png' }));
    aladin.current.setImageSurvey(surveys.current[0]);
    overlay.current = A.graphicOverlay({ color: '#ffffff', lineWidth: 2 });
    aladin.current.addOverlay(overlay.current);
  }, []);
  // MOCs display
  React.useEffect(() => {
    while (aladin.current.view.mocs.length > 0) {
      aladin.current.view.mocs.pop();
      aladin.current.view.allOverlayLayers.pop();
    }
    for (let mocUrl of props.state0.mocs) {
      let moc = A.MOCFromURL(mocUrl, { opacity: 0.25, color: 'magenta', lineWidth: 1 });
      aladin.current.addMOC(moc);
    }
    // FIXME: next line ignored, why?
    aladin.current.view.requestRedraw();
  }, [props.state0.mocs]);
  // Region display
  const updateSelection = () => {
    overlay.current.overlay_items = [];
    if (cooformRef.current) {
      const cooform = cooformRef.current;
      const aladinFrames = {'G': 'Galactic', 'E': 'J2000', 'D': 'J2000d'}
      aladin.current.setFrame(aladinFrames[cooform.cooSys]);
      if (cooform.cooValidate()) {
        let points = [];
        if (cooform.shape === 'R') {
          const lon_min = cooform.lonCtrAngle.degrees - cooform.lonWdtAngle.degrees / 2,
            lon_max = cooform.lonCtrAngle.degrees + cooform.lonWdtAngle.degrees / 2,
            lat_min = cooform.latMinAngle.degrees,
            lat_max = cooform.latMaxAngle.degrees;
          sphereLine(points, lon_max, lat_min, lon_min, lat_min);
          sphereLine(points, lon_min, lat_min, lon_min, lat_max);
          sphereLine(points, lon_min, lat_max, lon_max, lat_max);
          sphereLine(points, lon_max, lat_max, lon_max, lat_min);
        } else {
          sphereCircle(points, cooform.lonCtrAngle.degrees, cooform.latCtrAngle.degrees, cooform.radiusAngle.degrees);
        }
        if (cooform.cooSys == 'G') {
          for (let n in points)
            points[n] = galactic2equatorial(points[n][0], points[n][1]);
        }
        overlay.current.add(A.polyline(points));
      } else aladin.current.view.requestRedraw();
    } else aladin.current.view.requestRedraw()
  }

  React.useEffect(() => {
    let updateSelectionDestroyer = null;
    if (aladin.current) updateSelectionDestroyer = autorun(updateSelection);
    return () => {
      updateSelectionDestroyer && updateSelectionDestroyer();
    }
  }, [props.cooform]);

  React.useEffect(() => {
    if (props.fitsURL != fitsFile.current.url) {
      if (props.fitsURL) {
        $.ajax({
          url: 'https://alasky.unistra.fr/cgi/fits2HiPS',
          data: { url: props.fitsURL },
          method: 'GET',
          dataType: 'json',
          success: function (response) {
            if (response.status !== 'success') {
              console.error('An error occured: ' + response.message);
              return;
            }
            let label = props.fitsName, meta = response.data.meta;
            aladin.current.setOverlayImageLayer(
              aladin.current.createImageSurvey(label, label, response.data.url, props.fitsCoosys,
                meta.max_norder, { imgFormat: 'png' }));
            aladin.current.getOverlayImageLayer().setAlpha(1.0);
            aladin.current.gotoRaDec(meta.ra, meta.dec);
            aladin.current.setFov(meta.fov);
            fitsFile.current = { url: props.fitsURL, name: props.fitsName, coosys: props.fitsCoosys };
          }
        });
      }
    }
  }, [props.fitsURL]);

  const handleSurvey = () => {
    const i = surveys.current.indexOf(aladin.current.getBaseImageLayer());
    aladin.current.setImageSurvey(surveys.current[(i + 1) % surveys.current.length]);
  };

  const handleConstellation = () => {
    const constellation = aladin.current.getOverlayImageLayer();
    if (constellation) {
      const i = constellations.current.indexOf(constellation);
      if (i === constellations.current.length - 1)
        aladin.current.setOverlayImageLayer();
      else {
        aladin.current.setOverlayImageLayer(constellations.current[i + 1]);
        aladin.current.getOverlayImageLayer().setAlpha(0.5);
      }
    } else {
      aladin.current.setOverlayImageLayer(constellations.current[0]);
      aladin.current.getOverlayImageLayer().setAlpha(0.5);
    }
  };

  const handleColormap = () => {
    const cmaps = ['native', 'cubehelix', 'eosb', 'rainbow', 'grayscale'];
    let cmap = aladin.current.getBaseImageLayer().getColorMap();
    cmap.update(cmaps[(cmaps.indexOf(cmap.mapName) + 1) % cmaps.length]);
  };

  const handleFitsColormap = () => {
    const cmaps = ['native', 'cubehelix', 'eosb', 'rainbow', 'grayscale'];
    let cmap = aladin.current.getOverlayImageLayer().getColorMap();
    cmap.update(cmaps[(cmaps.indexOf(cmap.mapName) + 1) % cmaps.length]);
  };

  const copyPosition = action((e) => {
    let coords = aladin.current.getRaDec();
    if (props.cooform.cooSys === 'G')
      coords = CooConversion.J2000ToGalactic(coords);
    props.cooform.lonCtrAngle.degrees = coords[0];
    props.cooform.handleLinkedChange(e, { name: 'lonCtr', value: props.cooform.lonCtrAngle.angle });
    props.cooform.latCtrAngle.degrees = coords[1];
    props.cooform.handleLinkedChange(e, { name: 'latCtr', value: props.cooform.latCtrAngle.angle });
  });

  props.cooform && props.cooform.cooValidate();
  return (
    <div>
      <div style={{paddingBottom: '0.2em'}}>
        <Button.Group basic>
          <Button icon='home' onClick={() => {
            aladin.current.gotoPosition(0, 0);
            aladin.current.setFov(180);
          }} />
          <Button icon='zoom in' onClick={() => aladin.current.setFov(aladin.current.getFov()[0] / 2)}/>
          <Button icon='zoom out' onClick={() => aladin.current.setFov(Math.min(180, aladin.current.getFov()[0] * 2))}/>
          {props.cooform ?
            <>
            <Button icon='target' disabled={props.cooform.lonCtr.length <= 1 || props.cooform.latCtr.length <= 1}
              onClick={() =>
              aladin.current.gotoPosition(props.cooform.lonCtrAngle.degrees, props.cooform.latCtrAngle.degrees)} />
            <Button icon='crosshairs' onClick={copyPosition} />
            </>
            : <></>
          }
        </Button.Group>
        {' '}
        <Button.Group basic>
          <Button icon='clone outline' onClick={handleSurvey} />
          {props.fitsURL === undefined ?
            <Button icon='star outline' onClick={handleConstellation} />
            :
            <Button icon='tint' onClick={handleFitsColormap} />
          }
          <Button icon='flask' onClick={handleColormap} />
        </Button.Group>
      </div>
      <div id='aladin-lite-div' style={{ width: '400px', height: '400px' }} />
    </div>
  );
});