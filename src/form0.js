// @ts-check
'use strict';

import React from 'react'

import './css/sql.css'
import _ from 'lodash'
import { observable, computed, configure, action } from 'mobx'
import { observer } from 'mobx-react'
import { Container, Loader, Dimmer, Grid, Form, Header, Button, Accordion } from 'semantic-ui-react'
import { serversDict, datasetsDict, colorDict } from './datasets.js'
import { FormState } from './formstate.js'
import { OpenSeaDragonViewer } from './openseadragon';

configure({ enforceActions: 'observed' });


export class Form0State extends FormState {
  @observable catalog = '';
  @observable server = '';
  @observable bandlist = [];
  @observable morphclass = '';
  @observable filter = false;

  validators = {
    catalog: x => x === '' && 'Please select a catalog',
    server: x => x === '' && 'Please select a server',
    bandlist: x => (x.length < 2) && 'At least two bands are required'
  }

  catalogs = _.map(datasetsDict,
    (v, k) => ({ text: v.description, value: k, image: v.image })
  );

  @action.bound handleCatalog(e, { value }) {
    if (value) {
      let catalog = datasetsDict[value];
      let allowedServers = catalog.servers;
      if (!allowedServers.includes(this.server))
        this.server = allowedServers[0];
      let bands = catalog.bands;
      if (_.isPlainObject(bands)) bands = bands[this.server];
      this.bandlist = _.map(bands, (v) => v[0]);
      this.morphclass = '';
    }
  }

  @computed({ keepAlive: true }) get mask() {
    if (this.catalog) {
      const source = datasetsDict[this.catalog].mask;
      if (source) return `/static/masks/${source}.dzi`;
      else return 'static/tiles/dust.dzi';
    } else return null;
  }

  @computed({ keepAlive: true }) get servers() {
    return _.map(this.catalog ? datasetsDict[this.catalog].servers : [],
      v => ({ text: serversDict[v].description, value: v, image: serversDict[v].image }));
  }

  @computed({ keepAlive: true }) get coords() {
    let result = []
    if (this.catalog && this.server) {
      let coords = datasetsDict[this.catalog].coords;
      if (_.isPlainObject(coords)) coords = coords[this.server];
      result.push(...coords);
      coords = datasetsDict[this.catalog].gal_coords;
      if (coords) {
        if (_.isPlainObject(coords)) coords = coords[this.server];
        if (coords) result.push(...coords);
      }
    }
    return result;
  }

  @computed({ keepAlive: true }) get bandsWithFields() {
    let result1 = [], result2 = {}, result3 = {};
    if (this.catalog && this.server) {
      let allowedBands = datasetsDict[this.catalog].bands, lastColNum = -1;
      if (_.isPlainObject(allowedBands)) allowedBands = allowedBands[this.server];
      for (let [name, mag, err, k] of Object.values(allowedBands).reverse()) {
        let colNum = colorDict.bands[name.toUpperCase().replaceAll("'", '')];
        if (colNum <= lastColNum) colNum = lastColNum + 1;
        result1.push({ text: name, value: name, color: colorDict.colorNames[colNum] });
        result2[name] = [mag, err];
        result3[name] = k;
        lastColNum = colNum;
      }
    }
    return { bands: result1.reverse(), fields: result2, reddeningLaw: result3 };
  }

  @computed({ keepAlive: true }) get bands() {
    return this.bandsWithFields.bands;
  }

  @computed({ keepAlive: true }) get morphclassesWithFields() {
    let result1 = [], result2 = {};
    if (this.catalog && this.server) {
      let allowedClasses = datasetsDict[this.catalog].classes;
      if (_.isPlainObject(allowedClasses)) allowedClasses = allowedClasses[this.server];
      for (let className of allowedClasses) {
        result1.push({ text: className[0], value: className[0] });
        result2[className[0]] = className[1];
      }
    }
    return { morphclasses: result1, fields: result2 };
  }

  @computed({ keepAlive: true }) get morphclasses() {
    return this.morphclassesWithFields.morphclasses;
  }

  @computed({ keepAlive: true }) get reddeningLaw() {
    return _.map(this.bandlist, b => this.bandsWithFields.reddeningLaw[b]);
  }

  @computed({ keepAlive: true }) get adql() {
    let fields = [], extra, conditions = [];
    if (this.catalog && this.server) {
      let catalogQuery = datasetsDict[this.catalog].catalogs;
      if (_.isPlainObject(catalogQuery)) catalogQuery = catalogQuery[this.server];
      if (Array.isArray(catalogQuery)) catalogQuery = catalogQuery.join(', ')
      fields = [].concat(this.coords);
      fields = fields.concat(_.flatMap(this.bandlist, b => this.bandsWithFields.fields[b]));
      if (this.morphclass) fields.push(this.morphclassesWithFields.fields[this.morphclass]);
      extra = datasetsDict[this.catalog].extra;
      if (_.isPlainObject(extra)) extra = extra[this.server];
      conditions.push(...extra);
      if (this.filter) {
        extra = datasetsDict[this.catalog].extra_robust
        if (_.isPlainObject(extra)) extra = extra[this.server];
        conditions.push(...extra);
      }
      return (
        <div>
          <span className="sql-reserved">SELECT </span>
          {fields.map((f) => <span className="sql-field">{f}</span>)
            .reduce((acc, f) => (acc === null) ? f : <>{acc}, {f}</>)}<br />
          <span className="sql-reserved">FROM</span> {catalogQuery}
          {conditions.length ? <><br />
            <span className="sql-reserved">WHERE </span>
            {conditions.map((c, _) => <><span className="sql-field">{c[0]}</span>
              <span className="sql-operator">{c[1]}</span>
              <span className="sql-constant">{c[2]}</span></>)
              .reduce((acc, c) => (acc === null) ? c : <>{acc} <span className="sql-simple-operator">AND</span> {c}</>)}
          </> : <></>}
        </div>);
    } else return (<></>);
  }
}

export const state0 = new Form0State();

const FormCatalog = observer((props) => {
  return (
    <Form.Select fluid width={10} {...state0.props('catalog')} label='Catalog'
      options={state0.catalogs} placeholder='Catalog' {...props} />
  );
});

const FormServer = observer((props) => {
  return (
    <Form.Select fluid width={6} {...state0.props('server')} label='Server'
      options={state0.servers} placeholder='Server' {...props} />
  );
});

const FormBands = observer((props) => {
  return (
    <Form.Dropdown multiple search selection fluid width={10} {...state0.props('bandlist')}
      label='Bands' options={state0.bands} placeholder='Select bands'
      renderLabel={option => ({ color: option.color, content: option.text })} {...props} />
  );
});

const FormMorhClass = observer((props) => {
  return (
    <Form.Dropdown fluid width={6} search selection clearable {...state0.props('morphclass')}
      label='Morphological classification' options={state0.morphclasses} placeholder='No classification'
      {...props} />
  );
});

const FormFilter = observer((props) => {
  return (
    <Form.Checkbox name='filter' checked={state0.filter} label='Filter spurious sources'
      onChange={state0.handleChange} {...props} />
  );
});


const SQLArea = observer(() => {
  const [active, setActive] = React.useState(false);

  return (
    <Accordion fluid styled>
      <Accordion.Title content='ADQL query' active={active} icon='dropdown' onClick={() => setActive(!active)} />
      <Accordion.Content active={active} content={state0.adql} />
    </Accordion>
  );
});

const ClearButton = observer(() => {
  return (
    <Button style={{ width: "110px" }} icon={state0.undo ? 'undo' : 'delete'} content={state0.undo ? 'Undo' : 'Clear'}
      color={state0.undo ? 'green' : 'red'} onClick={state0.resetOrUndo} />
  );
});

const Map = observer(() => {
  if (state0.mask) {
    return (<OpenSeaDragonViewer image={state0.mask} select scalebar />);
  } else return (<></>);
})

export function MyForm0(props) {
  const [wait, setWait] = React.useState(false);

  function handleNext(e) {
    e.preventDefault();
    if (state0.validate()) props.onNext(e);
  }

  return (
    <Container>
      <Dimmer.Dimmable blurring dimmed={Boolean(wait)}>
        <Dimmer active={Boolean(wait)} inverted >
          <Loader inverted indeterminate content={String(wait)} />
        </Dimmer>
        <Grid stackable columns={2}>
          <Grid.Column style={{ flex: "1" }}>
            <Form>
              <Header as='h2'>Dataset query</Header>
              <Header as='h3' dividing>Dataset selection</Header>
              <Form.Group>
                <FormCatalog />
                <FormServer />
              </Form.Group>
              <Form.Group>
                <FormBands />
                <FormMorhClass />
              </Form.Group>
              <Header as='h3' dividing>Filters</Header>
              <FormFilter />
              <Form.Field>
                <SQLArea />
              </Form.Field>
              <Button as="label" htmlFor="file" icon='upload' content='Upload configuration' />
              <input type="file" id="file" hidden onChange={(a) => alert(a)} />
              <ClearButton />
              <Button primary style={{ width: "110px" }} icon='right arrow' labelPosition='right' content='Next'
                onClick={handleNext} />
            </Form>
          </Grid.Column>
          <Grid.Column style={{ width: "400px" }}>
            <Map />
          </Grid.Column>
        </Grid>
      </Dimmer.Dimmable>
    </Container>);
}