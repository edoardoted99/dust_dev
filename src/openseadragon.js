// @ts-check
'use strict';

import React, { useEffect, useState, useRef } from 'react'
import { Button, Icon } from 'semantic-ui-react'
import _ from 'lodash'
import OpenSeaDragon from 'openseadragon';
import { action, autorun } from 'mobx'
import { observer } from 'mobx-react'
import './openseadragon-selection/selection.js'
import './openseadragon-scalebar'
import { Angle } from './angle.js'

export const OpenSeaDragonViewer = observer((props) => {
  let { image, select, scalebar } = props;
  const [viewer, setViewer] = useState(null);
  const [selection, setSelection] = useState(null);
  const [activeSelection, setActiveSelection] = useState(false);
  const cooformRef = useRef(props.cooform);

  cooformRef.current = props.cooform;

  const handleSelection = action((rect) => {
    let cooform = cooformRef.current
    if (cooform) {
      const nx = 12000.0, ny = 6000.0
      const center = rect.getCenter(), size = rect.getSize();
      const values = {
        lonCtr: 180.0 - center.x / nx * 360.0,
        latCtr: 90.0 - center.y / ny * 180.0,
        lonWdt: size.x / nx * 360.0,
        latWdt: size.y / ny * 180.0
      };
      for (let k in values) {
        let angle = new Angle(cooform[k] || '0', k === 'latCtr' ? 'latitude' : 'longitude');
        angle.degrees = values[k];
        cooform[k] = angle.angle;
      }
      for (let k of ['lon', 'lat']) {
        let [min, max] = cooform.cw2mm(cooform[k + 'Ctr'], cooform[k + 'Wdt'], k === 'lat' ? 'latitude' : 'longitude');
        cooform[k + 'Type'] = 3;
        cooform[k + 'Min'] = min;
        cooform[k + 'Max'] = max;
      }
      cooform.undo = false;
    }
  });


  useEffect(() => {
    if (image && viewer) {
      viewer.open(image);
    }
  }, [image]);

  useEffect(() => {
    // This is mount function
    viewer && viewer.destroy();
    const osd = OpenSeaDragon({
      id: 'openSeaDragon',
      prefixUrl: "../static/tiles/",
      tileSources: image,
      maxZoomPixelRatio: 8,
      wrapHorizontal: true,
      // overlays: overlays,
      navigatorRotate: false,
      rotationIncrement: 15,
      animationTime: 0.5,
      blendTime: 0.1,
      constrainDuringPan: true,
      minZoomLevel: 1,
      visibilityRatio: 1,
      zoomPerScroll: Math.pow(2, 0.25),
      zoomInButton: 'osd-zoom-in',
      zoomOutButton: 'osd-zoom-out',
      homeButton: 'osd-home',
      fullPageButton: 'osd-expand'
    });
    if (scalebar) {
      // @ts-ignore
      osd.scalebar({
        pixelsPerMeter: 12000 / 1296000.0,
        // @ts-ignore
        type: OpenSeaDragon.ScalebarType.MICROSCOPY,
        minWidth: '50px',
        // @ts-ignore
        location: OpenSeaDragon.ScalebarLocation.BOTTOM_LEFT,
        // @ts-ignore
        sizeAndTextRenderer: OpenSeaDragon.ScalebarSizeAndTextRenderer.STANDARD_ANGLE,
        color: 'rgb(200, 200, 200)',
        fontColor: 'rgb(200, 200, 200)',
        backgroundColor: 'rgba(255, 255, 255, 0.0)',
        fontSize: 'x-small',
        barThickness: 1
      });
    }
    if (select) {
      // @ts-ignore
      let osdsel = osd.selection({
        noUpdate: false,
        keyboardShortcut: null,
        showSelectionControl: false,
        // toggleButton: 'osd-selection',
        showConfirmDenyButtons: false,
        allowRotation: false,
        onChange: handleSelection
        // rect: new OpenSeaDragon.SelectionRect(0.5, 0.5, 0.1, 0.1)
      });
      setSelection(osdsel);
    }
    setViewer(osd);
    return () => {
      if (viewer) {
        viewer.destroy();
        setViewer(null);
      }
    };
  }, []);

  const updateSelection = () => {
    if (cooformRef.current) {
      const { lonCtr, latCtr, lonWdt, latWdt, lonType, latType } = cooformRef.current;
      if (lonType !== 3 || latType !== 3) {
        if (lonCtr && latCtr && lonWdt && latWdt) {
          const aLonCtr = new Angle(lonCtr, 'longitude'), aLatCtr = new Angle(latCtr, 'latitude');
          const aLonWdt = new Angle(lonWdt, 'longitude'), aLatWdt = new Angle(latWdt, 'longitude');
          const x = (180 - aLonCtr.degrees) / 360, y = (90.0 - aLatCtr.degrees) / 360,
            w = aLonWdt.degrees / 360.0, h = aLatWdt.degrees / 360.0;
          // @ts-ignore
          selection.rect = new OpenSeaDragon.SelectionRect(x - Math.floor(x) - w * 0.5, y - h * 0.5, w, h);
          selection.setState(true);
          setActiveSelection(true);
          selection.draw();
        } else {
          if (select) selection.setState(false);
          setActiveSelection(false);
        }
      }
    } else {
      if (select) selection.setState(false);
      setActiveSelection(false);
    }
  }

  useEffect(() => {
    let updateSelectionDestroyer = null;
    if (select && viewer) updateSelectionDestroyer = autorun(updateSelection);
    return () => {
      updateSelectionDestroyer && updateSelectionDestroyer();
    }
  }, [select, props.cooform]);

  return (
    <div>
      <Button.Group basic>
        <Button icon id='osd-home'>
          <Icon name='home' />
        </Button>
        <Button icon id='osd-zoom-in'>
          <Icon name='zoom in' />
        </Button>
        <Button icon id='osd-zoom-out'>
          <Icon name='zoom out' />
        </Button>
        <Button icon id='osd-expand'>
          <Icon name='expand arrows alternate' />
        </Button>
        {select ?
          <Button icon disabled={select === 'disabled'} active={activeSelection} title='Toggle area selection'
            onClick={() => { selection.setState(!activeSelection); setActiveSelection(!activeSelection); }}
            id='osd-selection'>
            <Icon name='crop' />
          </Button>
          : <></>}
      </Button.Group>
      <div id='openSeaDragon' style={{ height: '400px', width: '400px' }} />
    </div>
  );
});