// @ts-check
'use strict';

import React, { useState } from 'react'

import './css/sql.css'
import _ from 'lodash'
import { observable, computed, configure, action } from 'mobx'
import { observer } from 'mobx-react'
import {
  Loader, Dimmer, Form, Header, Button, Accordion, Message,
  FormField, Input, Label, Popup, Icon, Progress, Dropdown
} from 'semantic-ui-react'
import { serversDict, datasetsDict, colorDict } from './datasets.js'
import { FormState } from './formstate.js'
import { InputUnit } from './inputunit.js'
import { InputVOField, inputVOValidator } from './inputvofield'
import { ModalTapSearch } from './modalcat.js'
import { queryTable, testServerQuery, parseVOTable } from './tap.js'

const axios = require('axios').default;

configure({ enforceActions: 'observed' });

/**
 * A band specification: name, magnitude column name, magnitude error column name,
 * extinction law.
 * @typedef { [string, string, string, number] } bandSpec
 */

/**
 * A coordinate specificiation: coordinate type, longitude name, latitude name.
 * @typedef { ['E'|'G', string, string] } coordSpec
 */

/**
 * A database column specification
 * @typedef columnSpec
 * @property { string } name - The column name
 * @property { string } datatype - The column data type
 * @property { string } [default] - For VizieR queries, true if the column is part of the default set
 * @property { string } description - The description of the field
 * @property { boolean } indexed - True if the column is indexed in the database
 * @property { number } [notid] - For VizieR queries, the note id
 * @property { string } ucd - The column UCD
 * @property { string } unit - The column unit
 */

/**
 * @typedef catalogProperties
 * @property { coordSpec[] } coords - List of known coordinate specifications
 * @property { bandSpec[] } bandlist - List of known catalog bands with errors
 * @property { columnSpec[] } columns - Full list of catalog columns with their properties
 * @property { string } [morphclass] - Optional morphological classification column name
 * @property { number } [catid] - Optional catalog id (only for VizieR queries)
 * @property { number } [tabid] - Optional table id (only for VizieR queries)
 */

/**
 * Table 3 from Rieke & Lebovsky (1985), ApJ 288, 618: ratio A_lambda / A_V.
 * @type {{ [band: string]: number }}
 */
const RIEKE_LEBOVSKY_REDDENING = {
  'U': 1.531,
  'B': 1.324,
  'V': 1.000,
  'R': 0.748,
  'I': 0.482,
  'J': 0.282,
  'H': 0.175,
  'K': 0.112,
  'Ks': 0.112,
  '3-4um': 0.058,
  'W1': 0.058,
  '4-8um': 0.023,
  'W2': 0.023
};


export class Form0State extends FormState {
  /**
   * The query type: Standard query, Custom query, or Local file
   * @type { 'S' | 'C' | 'L' }
   * @memberof Form0State
   */
  @observable queryType = 'S';

  /**
   * The catalog name, in case `queryType` === 'S'.
   * @type { string }
   * @memberof Form0State
   */
  @observable standardCatalog = '';

  /**
   * The catalog full name, in case `queryType` === 'C'.
   * @type { string }
   * @memberof Form0State
   */
  @observable customCatalog = '';

  /**
   * The name of the current custom configuration, used in case `queryType` === 'C'.
   * @type { string }
   * @memberof Form0State
   */
  @observable currentConfiguration = '';

  /**
   * The list of the custom configurations, used in case `queryType` === 'C'.
   * @type { object }
   * @memberof Form0State
   */
  @observable _customConfigurations = {};

  /**
   * The server name, in case `queryType` === 'S' or 'C'.
   * @type { string }
   * @memberof Form0State
   */
  @observable server = '';

  /**
   * The local file uploaded, if `queryType` === 'L'.
   * @type { null | File }
   * @memberof Form0State
   */
  @observable localfile = null;

  /**
   * The list of the band names to use (at least two bands are required).
   * @type { string[] }
   * @memberof Form0State
   */
  @observable bandselection = [];

  /**
   * The name of the morphological classification to use (use an empty string to ignore).
   * @type { string }
   * @memberof Form0State
   */
  @observable smorphclass = '';

  /**
   * The filtering to use: No filtering, Standard one (only for certain cases of 
   * `queryType` === 'S'), or Custom one.
   * @type { 'N' | 'S' | 'C' }
   * @memberof Form0State
   */
  @observable filter = 'N';

  /**
   * A list of advanced filters to use in the selection. Each filter is specified by a
   * column name, a minimum string (which includes an operator, as in `> 0`) and a 
   * maximum string (also including an operator, as in `<= 3`). Both the minimum and the
   * maximum string can be empty; also, in case of a non-numerical field, possibly only
   * the first string is used.
   * @type { {'name': string, 'min': string, 'max': string}[] }
   * @memberof Form0State
   */
  @observable advFilters = [];

  /**
   *
   * type { { 'coords': coordSpec[], 'bandlist': bandSpec[], 'columns': columnSpec[], morphclass: string }}
   * @type { catalogProperties }
   * @property { coordSpec } coords
   * @memberof Form0State
   */
  @observable catalogProperties = { coords: [], bandlist: [], columns: [], morphclass: '' };
  @observable mocs = [];
  @observable helper = false;


  @computed({ keepAlive: true }) get usedBandList() {
    return _.map(this.catalogProperties.bandlist, 1).concat(_.map(this.catalogProperties.bandlist, 2));
  }
  
  @computed({ keepAlive: true }) get usedFilterList() {
    return _.map(this.advFilters, 'name');
  }

  validators = {
    standardCatalog: x => (this.queryType === 'S' && x === '') && 'Please select a catalog',
    customCatalog: x => (this.queryType === 'C' && x === '') && 'Please enter a catalog',
    server: x => (this.queryType !== 'L' && x === '') && 'Please select a server',
    localfile: x => (this.queryType === 'L' && x === null) && 'Please load a file containing a valid VOTable',
    bandselection: x => (this.queryType === 'S' && x.length < 2) && 'At least two bands are required',
    catalogProperties: x => ({ 
      coords: 
        _.map(x.coords, c => ([
          c[0] !== 'E' && c[0] !== 'G' && 'Unknown coordinate type',
          inputVOValidator(c[1], { votable: this.catalogProperties.columns, disabledFields: [c[2]] }),
          inputVOValidator(c[2], { votable: this.catalogProperties.columns, disabledFields: [c[1]] })
        ])),
      bandlist:
        _.map(x.bandlist, b => ([
          b[0].length === 0 && 'Band name required',
          inputVOValidator(b[1], { votable: this.catalogProperties.columns, disabledFields: this.usedBandList }),
          inputVOValidator(b[2], { votable: this.catalogProperties.columns, disabledFields: this.usedBandList }),
          !(b[3] > 0) && 'Enter a positive value'
        ])),
      columns: _.map(x.columns, c => false),
      morphclass: x.morphclass !== '' &&
        inputVOValidator(x.morphclass, { votable: this.catalogProperties.columns, disabledFields: this.usedBandList })
    }),
    // Empty validators
    currentConfiguration: x => false,
    queryType: x => false,
    smorphclass: x => false,
    filter: x => false,
    advFilters: x => false,
    helper: x => false
  }

  @computed({ keepAlive: true }) get catalog() {
    return this.queryType === 'S' ? this.standardCatalog : this.customCatalog;
  }

  set catalog(value) {
    if (this.queryType === 'S') this.standardCatalog = value;
    else this.customCatalog = value;
  }

  @computed({ keepAlive: true }) get filled() {
    return ((this.queryType === 'L' && this.localfile) || (this.catalog && this.server));
  }

  @computed({ keepAlive: true }) get bandlist() {
    let sbandlist = this.bandselection, cbandlist = _.map(this.catalogProperties.bandlist, 0);
    return this.queryType === 'S' ? sbandlist : cbandlist;
  }

  set bandlist(values) {
    if (this.queryType === 'S') this.bandselection = values;
  }

  @computed({ keepAlive: true }) get morphclass() {
    let smorphclass = this.smorphclass, cmorphclass = this.catalogProperties.morphclass;
    return this.queryType === 'S' ? smorphclass : cmorphclass;
  }

  set morphclass(value) {
    if (this.queryType === 'S') this.smorphclass = value;
  }

  standardCatalogs = _.map(datasetsDict,
    (v, k) => ({ text: v.description, value: k, image: v.image })
  );

  @action.bound handleQueryType(e, { value }) {
    // We need to compute "by hand" the catalog, sunce the catalog getter 
    // still uses the old value for queryType.
    if (value === 'L') {
      this.localfile = null;
      this.updateCatalogProperties('', 'local', value);
    } else {
      let catalog = (value === 'S') ? this.standardCatalog : this.customCatalog;
      this.updateCatalogProperties(catalog, this.server, value);
    }
  }

  @action.bound handleStandardCatalog(e, { value }) {
    this.messageType = null;
    if (value) {
      let catalog = datasetsDict[value];
      let allowedServers = catalog.servers;
      if (!allowedServers.includes(this.server))
        this.server = allowedServers[0];
      let bands = catalog.bands;
      if (_.isPlainObject(bands)) bands = bands[this.server];
      this.bandselection = _.map(bands, 0);
      this.updateCatalogProperties(value, this.server, this.queryType);
    }
  }

  @action.bound handleServer(e, { value }) {
    this.messageType = null;
    this.updateCatalogProperties(this.catalog, value, this.queryType);
  }

  @action.bound updateCatalogProperties(catalog, server, queryType) {
    if (catalog && server) {
      let serverURL = (queryType === 'L') ? 'local' : serversDict[server].server;
      if (queryType === 'S') {
        // If a standard query, the catalog is in reality a mnnemonic and 
        // not the real catalog name: convert it
        catalog = datasetsDict[catalog].catalogs;
        if (_.isPlainObject(catalog)) catalog = catalog[server];
        if (Array.isArray(catalog)) catalog = catalog[0];
      }
      this.messageType = 'info';
      this.messageHeader = (queryType === 'L') ? 'Parsing catalog' : 'Querying server';
      this.messageContent = 'Retriving catalog properties...';
      this.catalogProperties.coords = [];
      this.catalogProperties.bandlist = [];
      this.catalogProperties.columns = [];
      this.catalogProperties.morphclass = '';
      this.mocs = [];
      queryTable(serverURL, catalog)
        .then(action(result => {
          this.messageType = null;
          this.catalogProperties.coords = result.coords;
          if (result.bandlist.length > 0) 
            this.catalogProperties.bandlist = result.bandlist;
          else
            // @ts-ignore
            this.catalogProperties.bandlist = [['', '', '', '']];
          this.catalogProperties.columns = result.columns;
          this.catalogProperties.catid = result.catid;
          this.catalogProperties.tabid = result.tabid;
          this.advFilters = [{ name: '', min: '', max: '' }];
          // Find the MOCS
          if (this.queryType === 'S') {
            const mocs = datasetsDict[this.catalog].mocs || [];
            if (_.isArray(mocs)) this.mocs = mocs;
            else this.mocs = [mocs];
          } else {
            // return [`http://alasky.u-strasbg.fr/footprints/tables/vizier/${this.customCatalog.replaceAll('/', '_')}/MOC`]
            let server = (queryType === 'L') ? 'local' : serversDict[this.server].server;
            if ((server === 'vizier' || server === 'local') && catalog) {
              axios
                .post('/app/get_moc', {
                  server: server,
                  catalog: catalog,
                  coords: result.coords
                }, { timeout: 30000 })
                .then(action(response => {
                  if (response.data.success) {
                    this.mocs = [response.data.url];
                  }
                }))
                .catch(error => {
                  console.log(error);
                });
              axios
                .post('/app/ingest_database', {
                  server: server,
                  catalog: catalog,
                  coords: result.coords
                }, { timeout: 600000 })
                .then(response => {
                  console.log(response);
                });
            }
          }
        }))
        .catch(action(error => {
          this.messageType = 'error';
          this.messageHeader = 'Error';
          this.messageContent = error.toString();
          this.catalogProperties = { coords: [], bandlist: [], columns: [], morphclass: '' };
          if (this.queryType === 'L') this.localfile = null;
        }));
    } else {
      this.catalogProperties = { coords: [], bandlist: [], columns: [], morphclass: '' };
      this.messageType = null;
      this.messageType = null;
      this.mocs = [];
    }
  }

  @computed({ keepAlive: true }) get servers() {
    if (this.queryType === 'S') {
      return _.map(this.catalog ? datasetsDict[this.catalog].servers : [],
        v => ({ text: serversDict[v].description, value: v, image: serversDict[v].image }));
    } else {
      return _.map(serversDict, (s, k) => ({ text: s.description, value: k, image: s.image }));
    }
  }

  @computed({ keepAlive: true }) get coords() {
    if (this.filled) {
      let coords;
      if (this.queryType === 'S') coords = datasetsDict[this.catalog].coords;
      else coords = this.catalogProperties.coords || [];
      if (_.isPlainObject(coords)) coords = coords[this.server];
      return coords;
    } else return [];
  }

  @computed({ keepAlive: true }) get bandsWithFields() {
    let result1 = [], result2 = {}, result3 = {};
    if (this.filled) {
      let allowedBands, lastColNum = -1;
      if (this.queryType === 'S')
        allowedBands = datasetsDict[this.catalog].bands;
      else
        allowedBands = this.catalogProperties.bandlist || [];
      if (_.isPlainObject(allowedBands)) allowedBands = allowedBands[this.server];
      for (let [name, mag, err, k] of Object.values(allowedBands).reverse()) {
        let colNum = Math.trunc(colorDict.bands[name.toUpperCase().replaceAll("'", '')]);
        if (colNum <= lastColNum && colNum < colorDict.colorNames.length - 1) colNum = lastColNum + 1;
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
    if (this.filled) {
      if (this.queryType === 'S') {
        let allowedClasses = datasetsDict[this.catalog].classes;
        if (_.isPlainObject(allowedClasses)) allowedClasses = allowedClasses[this.server];
        for (let className of allowedClasses) {
          result1.push({ text: className[0], value: className[0] });
          result2[className[0]] = className[1];
        }
      } else {
        let morphclass = this.catalogProperties.morphclass;
        result1 = [{ text: morphclass, value: morphclass }];
        result2[morphclass] = morphclass;
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

  @computed({ keepAlive: true }) get filterDisabled() {
    if (this.catalog && this.server && this.queryType === 'S') {
      let extra = datasetsDict[this.catalog].extra_robust
      if (_.isPlainObject(extra)) extra = extra[this.server];
      return extra.length === 0;
    } else return true;
  }

  @computed({ keepAlive: true }) get adqlComponents() {
    let fields = [], mags = [], magErrs = [], morphclass = null, extra, conditions = [];
    if ((this.queryType === 'L' && this.localfile) || (this.catalog && this.server)) {
      let server = this.server, dataset = this.catalog, coords = this.coords;
      let catalogs = (this.queryType === 'S') ? datasetsDict[dataset].catalogs : dataset;
      if (_.isPlainObject(catalogs)) catalogs = catalogs[server];
      if (!Array.isArray(catalogs)) catalogs = [catalogs];
      if (this.queryType !== 'L' && server !== 'VizieR')
        catalogs = catalogs.map(cat => '"' + cat + '"')
      fields = [].concat(..._.map(coords, c => [c[1], c[2]]));
      let selectedMags = _.pick(this.bandsWithFields.fields, this.bandlist);
      mags = _.map(selectedMags, 0);
      magErrs = _.map(selectedMags, 1);
      fields = fields.concat(_.flatMap(selectedMags));
      if (this.morphclass) {
        morphclass = this.morphclassesWithFields.fields[this.morphclass];
        fields.push(morphclass);
      }
      extra = (this.queryType === 'S') ? datasetsDict[dataset].extra : [];
      if (_.isPlainObject(extra)) extra = extra[server];
      conditions.push(...extra);
      if (this.filter === 'S') {
        extra = (this.queryType === 'S') ? datasetsDict[dataset].extra_robust : [];
        if (_.isPlainObject(extra)) extra = extra[server];
        conditions.push(...extra);
      } else if (this.filter === 'C') {
        extra = [];
        for (let f of this.advFilters) {
          let col = _.find(this.catalogProperties.columns, ['name', f.name]);
          let name = f.name;
          if (!col) continue;
          if (!name.match(/^[A-Za-z_]+[A-Za-z0-9_]*/)) name = `"${name}"`;
          if (col.datatype.substr(0, 4) !== 'CHAR') {
            const m1 = f.min.match(/^\s*[-+]?[0-9]+\.?[0-9]*$/), m2 = f.max.match(/^\s*[-+]?[0-9]+\.?[0-9]*$/);
            const o1 = m1 ? '>=' : '', o2 = m2 ? '<=' : '', s1 = f.min.trim(), s2 = f.max.trim();
            if (this.server === 'VizieR') {
              if (s1 && s2) extra.push([name, ' ', `${o1}${s1} & ${o2}${s2}`]);
              else if (s1) extra.push([name, o1, s1]);
              else if (s2) extra.push([name, o2, s2]);
            } else {
              if (s1) extra.push([name, o1, s1]);
              if (s2) extra.push([name, o2, s2]);
            }
          } else {
            const m1 = f.min.match(/^\s*[A-Za-z0-9_]+$/), s1 = f.min.trim();
            if (s1 === '') continue;
            if (this.server === 'VizieR') {
              if (m1) extra.push([name, '==', `"${s1}"`]);
              else extra.push(name, ' ', s1);
            } else {
              if (m1) extra.push([name, '=', `'${s1}'`]);
              else extra.push([name, ' ', s1]);
            }
          }
        }
        conditions.push(...extra);
      }
      let serverURL = (this.queryType === 'L') ? 'local' : serversDict[server].server;
      return { server: serverURL, dataset, catalogs, fields, conditions, coords, mags, magErrs, morphclass };
    } else return null;
  }

  @computed({ keepAlive: true }) get adql() {
    if (this.catalog && this.server) {
      let { fields, catalogs, conditions } = this.adqlComponents;
      if (fields.length === 0 || catalogs.length === 0) return <></>;
      return (
        <div>
          <span className="sql-reserved">SELECT </span>
          {fields.map((f) => <span className="sql-field">{f}</span>)
            .reduce((acc, f) => (acc === null) ? f : <>{acc}, {f}</>)}<br />
          <span className="sql-reserved">FROM</span> {catalogs.join(', ')}
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

const FormQueryType = observer((props) => {
  const handleChange = (e, d) => {
    if (!state0.localfile) state0.handleChange(e, d);
    else alert('Please remove the uploaded file first');
  }

  return (
    <Popup disabled={!state0.helper} content='The query type: standard preset queries or fully custom ones.'
      trigger={
        <Form.Group inline>
          <Form.Radio label='Standard query' name='queryType' value='S'
            checked={state0.queryType === 'S'} onChange={handleChange} {...props} />
          <Form.Radio label='Custom query' name='queryType' value='C'
            checked={state0.queryType === 'C'} onChange={handleChange} {...props} />
          <Form.Radio label='Local file' name='queryType' value='L'
            checked={state0.queryType === 'L'} onChange={handleChange} {...props} />
        </Form.Group>} />
  );
});


const FormCatalog = observer((props) => {
  const [catalog, setCatalog] = React.useState('');
  const modalClick = action((e, name) => {
    state0.customCatalog = name;
    state0.updateCatalogProperties(name, state0.server, state0.queryType)
  });

  if (state0.queryType === 'S') {
    return (
      <Popup disabled={!state0.helper} wide content='The catalog to use for the full entire analysis'
        trigger={<Form.Select fluid width={10} {...state0.props('standardCatalog')} label='Catalog'
          options={state0.standardCatalogs} placeholder='Catalog' {...props} />} />
    );
  } else {
    let error = state0.props('customCatalog').error || '';
    return (
      <Popup disabled={!state0.helper} wide
        content='The full name of the catalog to use for the full entire analysis (use the button to the right to search)'
        trigger={
          <FormField error={Boolean(error)} width={10}>
            <label>Catalog</label>
            <Input type='text' {...state0.props('customCatalog')}
              onFocus={() => setCatalog(state0.catalog)}
              onBlur={() => {
                if (catalog !== state0.catalog) {
                  state0.updateCatalogProperties(state0.catalog, state0.server, state0.queryType);
                  setCatalog(state0.catalog);
                }
              }}
              action={<ModalTapSearch server={state0.server} formServer={FormServer} onClick={modalClick} />}
              placeholder='Catalog full name' />
            {error ? <Label prompt pointing role='alert'>{error}</Label> : <></>}
          </FormField>} />
    );
  }
});

const FormServer = observer((props) => {
  return (
    <Popup disabled={!state0.helper} content='The astronomical server where the data will be retrieved'
      trigger={<Form.Select fluid width={6} {...state0.props('server')} label='Server'
        options={state0.servers} placeholder='Server' {...props} />} />
  );
});

const FormBands = observer((props) => {
  return (
    <Popup disabled={!state0.helper} wide
      content='The list of the bands to use for the extinction (make sure you select at least two bands)'
      trigger={<Form.Dropdown multiple search selection fluid width={10} {...state0.props('bandselection')}
        label='Bands' options={state0.bands} placeholder='Select bands'
        renderLabel={option => ({ color: option.color, content: option.text })} {...props} />} />
  );
});

const FormAdvCoords = observer((props) => {
  let units = { '': '' }, descriptions = { '': '' }, numtypes = { '': '' };
  for (let col of state0.catalogProperties.columns) {
    units[col.name] = col.unit === 'deg' ? '°' : col.unit === undefined ? '' : col.unit;
    descriptions[col.name] = col.description || '';
    numtypes[col.name] = col.datatype.substr(0, 4) !== 'CHAR';
  }

  const lineMaker = (filter, idx) => {
    const coords = state0.catalogProperties.coords;
    const line = (
      <Form.Group key={idx}>
        <Form.Select fluid width={6} label='Coordinate system'
          options={[
            { value: 'E', text: 'Equatorial', disabled: coords.length > 1 && coords[1 - idx] && coords[1 - idx][0] === 'E' },
            { value: 'G', text: 'Galactic', disabled: coords.length > 1 && coords[1 - idx] && coords[1 - idx][0] === 'G' }]}
          {...state0.props(`catalogProperties.coords[${idx}][0]`)} placeholder='name' />
        <InputVOField width={4}
          label={coords[idx][0] === 'E' ? 'Right ascension' : 'Galactic longitude'}
          {...state0.props(`catalogProperties.coords[${idx}][1]`)}
          votable={state0.catalogProperties.columns} catid={state0.catalogProperties.catid}
          disabledFields={state0.usedBandList} placeholder='column name' />
        <InputVOField width={4} 
          label={coords[idx][0] === 'E' ? 'Declination' : 'Galactic latitude'}
          {...state0.props(`catalogProperties.coords[${idx}][2]`)}
          votable={state0.catalogProperties.columns} catid={state0.catalogProperties.catid}
          disabledFields={state0.usedBandList} placeholder='column name' />
        <Form.Field width={2}>
          <label>&nbsp;</label>
          <Button.Group size='mini' basic style={{ marginTop: '4px' }}>
            <Button icon='minus' disabled={idx === 0 && state0.catalogProperties.coords.length == 1}
              onClick={action(e => state0.catalogProperties.coords.splice(idx, 1))} />
            <Button icon='plus' disabled={state0.catalogProperties.coords.length == 2}
              // @ts-ignore
              onClick={action(e => state0.catalogProperties.coords.splice(idx + 1, 0, ['', '', '']))} />
          </Button.Group>
        </Form.Field>
      </Form.Group>
    );
    return line;
  }

  return (
    <>
      <Header as='h4'>Coordinate system(s)</Header>
      { _.map(state0.catalogProperties.coords, lineMaker)}
    </>
  );
});

const FormAdvBands = observer((props) => {
  let units = { '': '' }, descriptions = { '': '' }, numtypes = { '': '' };
  for (let col of state0.catalogProperties.columns) {
    units[col.name] = col.unit === 'deg' ? '°' : col.unit === undefined ? '' : col.unit;
    descriptions[col.name] = col.description || '';
    numtypes[col.name] = col.datatype.substr(0, 4) !== 'CHAR';
  }

  const lineMaker = (filter, idx) => {
    const line = (
      <Form.Group key={idx}>
        <Form.Input width={2} type='text' label={idx === 0 ? 'Name' : false}
          {...state0.props(`catalogProperties.bandlist[${idx}][0]`)} placeholder='name' />
        <InputVOField width={4} label={idx === 0 ? 'Magnitude' : false}
          {...state0.props(`catalogProperties.bandlist[${idx}][1]`)}
          votable={state0.catalogProperties.columns} catid={state0.catalogProperties.catid}
          disabledFields={state0.usedBandList} placeholder='magnitude' />
        <InputVOField width={4} label={idx === 0 ? 'Magnitude error' : false}
          {...state0.props(`catalogProperties.bandlist[${idx}][2]`)}
          votable={state0.catalogProperties.columns} catid={state0.catalogProperties.catid}
          disabledFields={state0.usedBandList} placeholder='magnitude error' />
        <Form.Input width={4} label={idx === 0 ? (<label>A<sub>mag</sub> / A<sub>ref</sub></label>) : false}
          {...state0.props(`catalogProperties.bandlist[${idx}][3]`)} placeholder='reddening law' type='text'
          action={{
            icon: 'magic', basic: true,
            onClick: action(() => {
              let name = state0.catalogProperties.bandlist[idx][0];
              if (name in RIEKE_LEBOVSKY_REDDENING) 
                state0.catalogProperties.bandlist[idx][3] = RIEKE_LEBOVSKY_REDDENING[name];
            })
          }} />
        <Form.Field width={2}>
          {idx === 0 ? <label>&nbsp;</label> : ''}
          <Button.Group size='mini' basic style={{ marginTop: '4px' }}>
            <Button icon='minus' disabled={idx === 0 && state0.catalogProperties.bandlist.length == 1}
              onClick={action(e => state0.catalogProperties.bandlist.splice(idx, 1))} />
            <Button icon='plus'
              // @ts-ignore
              onClick={action(e => state0.catalogProperties.bandlist.splice(idx + 1, 0, ['', '', '', '']))} />
          </Button.Group>
        </Form.Field>
      </Form.Group>
    );
    return line;
  }

  return (
    <>
      <Header as='h4'>Bands</Header>
      { _.map(state0.catalogProperties.bandlist, lineMaker)}
      <Header as='h4'>Morphological class selection</Header>
      <Form.Group>
        <InputVOField width={6} label='Morphological class (optional)' disabledFields={state0.usedBandList}
          placeholder='Morphological class' {...state0.props(`catalogProperties.morphclass`)}
          votable={state0.catalogProperties.columns} catid={state0.catalogProperties.catid}
        />
      </Form.Group>
    </>
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
    <>
      <Form.Group inline>
        <Form.Radio label='No filter' name='filter' value='N'
          checked={state0.filter === 'N'} onChange={state0.handleChange} {...props} />
        <Form.Radio label='Remove purious sources' name='filter' value='S'
          checked={state0.filter === 'S'} onChange={state0.handleChange} disabled={state0.filterDisabled} {...props} />
        <Form.Radio label='Custom filter' name='filter' value='C'
          checked={state0.filter === 'C'} onChange={state0.handleChange} {...props} />
      </Form.Group>
      { state0.filter === 'C' ? <FormAdvFilters {...props} /> : <></>}
    </>
  );
});

const FormAdvFilters = observer((props) => {
  let units = { '': '' }, descriptions = { '': '' }, numtypes = { '': '' };
  for (let col of state0.catalogProperties.columns) {
    units[col.name] = col.unit === 'deg' ? '°' : col.unit === undefined ? '' : col.unit;
    descriptions[col.name] = col.description || '';
    numtypes[col.name] = col.datatype.substr(0, 4) !== 'CHAR';
  }

  const lineMaker = (filter, idx) => {
    const name = state0.advFilters[idx].name;
    const doubleEntry = numtypes[name] &&
      (state0.advFilters[idx].min.match(/^\s*(>|>=|)\s*[-+]?[0-9]*(\.[0-9]*)?\s*$/) ||
        state0.advFilters[idx].max.trim() !== '');
    const line = (
      <Form.Group key={`advFilter${idx}`}>
        <InputVOField width={6} {...state0.props(`advFilters[${idx}].name`)} votable={state0.catalogProperties.columns}
          missingMessage='warn' catid={state0.catalogProperties.catid} disabledFields={state0.usedFilterList} /> 
       {name === '' ?
          <></> :
          <>
            <InputUnit fluid width={doubleEntry ? 4 : 8} name={`advFilters[${idx}].min`}
              placeholder={doubleEntry ? '> min value' : 'condition'}
              unit={units[name]} state={state0} />
            {doubleEntry ?
              <InputUnit fluid width={4} name={`advFilters[${idx}].max`} placeholder='< max value'
                unit={units[name]} state={state0} />
              : <></>
            }
          </>
        }
        <div style={{ alignItems: 'center', display: 'flex', marginLeft: '10px' }}>
          <Button.Group size='mini' basic>
            <Button icon='minus' disabled={idx == 0 && state0.advFilters.length == 1}
              onClick={action(e => state0.advFilters.splice(idx, 1))} />
            <Button icon='plus' disabled={name === '' ||
              state0.advFilters.length == state0.catalogProperties.columns.length}
              onClick={action(e => state0.advFilters.splice(idx + 1, 0, { name: '', min: '', max: '' }))} />
          </Button.Group>
        </div>
      </Form.Group>
    );
    return line;
  }

  return (
    <>
      { _.map(state0.advFilters, lineMaker)}
    </>
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

const ClearButton = observer((props) => {
  return (
    <Button style={{ width: "110px" }} icon={state0.undo ? 'undo' : 'delete'} content={state0.undo ? 'Undo' : 'Clear'}
      color={state0.undo ? 'green' : 'red'} onClick={state0.resetOrUndo} {...props} />
  );
});

const FormMessage = observer(() => {
  return (state0.messageType === null) ? <></> : <Message {...state0.messageProps} />;
});

const FormCustomConfiguration = observer((props) => {
  const omits = ['currentConfiguration', '_customConfigurations', '_orig', 'undo', 'validators',
    'messageContent', 'messageHeader', 'messageType', 'errors', 'mocs', 'helper'];

  const storage = React.useEffect(action(() => {
    const data = window.localStorage.getItem('customConfigurations')
    if (data)
      state0._customConfigurations = JSON.parse(data);
    return action(() => {
      window.localStorage.setItem('customConfigurations', JSON.stringify(state0._customConfigurations));
    });
  }), []);

  const onAddItem = action((e, { value }) => {
    state0.currentConfiguration = value;
    state0._customConfigurations[value] = _.omit(state0.pull(), omits);
  });

  const onCancelItem = action((e) => {
    if (state0.currentConfiguration in state0._customConfigurations) {
      state0.undo = {
        _customConfigurations: _.cloneDeep(state0._customConfigurations),
        currentConfiguration: state0.currentConfiguration
      };
      delete state0._customConfigurations[state0.currentConfiguration];
      state0.currentConfiguration = '';
    }
  });

  const onUpdateItem = action((e) => {
    state0.undo = { _customConfigurations: _.clone(state0._customConfigurations) };
    state0._customConfigurations[state0.currentConfiguration] = _.cloneDeep(_.omit(state0.pull(), omits));
  });

  const onUpdateFields = action((e) => {
    state0.undo = _.omit(state0.pull(), omits);
    state0.push(_.cloneDeep(state0._customConfigurations[state0.currentConfiguration]));
    // state0.updateCatalogProperties(state0.catalog, state0.server, state0.queryType);
  })

  let options = _.sortBy(
    _.map(state0._customConfigurations, (k, v) => { return { text: v, value: v } }),
    o => o.value.toUpperCase()
  );

  const present = (state0.currentConfiguration in state0._customConfigurations);
  // let errors = _.clone(state0.errors);
  // state0.validate();
  // state0.errors = errors;
  return (
    <Form.Input label='Custom configuration' fluid type='text' action actionPosition='left' icon>
      <Dropdown placeholder='Saved or new configuration name' options={options}
        search selection allowAdditions fluid {...state0.props('currentConfiguration')}
        onAddItem={onAddItem} additionLabel='Add new configuration '/>
      <Button icon disabled={!present}
        onClick={onUpdateFields}>
        <Icon color='green' name='sign-out' rotated='counterclockwise'/>
      </Button>
      <Button icon disabled={!present} onClick={onCancelItem}>
        <Icon color='red' name='cancel' />
      </Button>
      <Button icon disabled={!present}
        style={{ borderRadius: '0 4px 4px 0' }} onClick={onUpdateItem}>
        <Icon color='green' name='sign-in' rotated='clockwise'/>
      </Button>
    </Form.Input>
  );
});

const UploadButton = observer((props) => {
  const [percent, setPercent] = React.useState(null);
  const [cancel, setCancel] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);

  const dropHandler = event => {
    let file = null;
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      if (event.dataTransfer.items.length == 1 && event.dataTransfer.items[0].kind === 'file') {
        file = event.dataTransfer.items[0].getAsFile();
      }
    } else {
      // Use DataTransfer interface to access the file(s)
      if (event.dataTransfer.files.length == 1) {
        file = event.dataTransfer.files[0];
      }
    }
    if (file) dataUploader({ target: { files: [file] } });
  }

  const dataUploader = action((event) => {
    // TODO: Not sure why I need this, check https://fb.me/react-event-pooling
    if (event.persist) event.persist();
    state0.errors.localfile = null;
    let data = new FormData();
    data.append('file', event.target.files[0]);
    axios
      .post('/app/upload_file', data, {
        timeout: 600000,
        onUploadProgress: (event) => {
          if (event.lengthComputable)
            setPercent(event.loaded / event.total * 100);
        },
        cancelToken: new axios.CancelToken(c => {
          setCancel(() => c);
        })
      })
      .then(action(response => {
        setPercent(null);
        setCancel(null);
        if (response.data.success) {
          state0.localfile = event.target.files[0];
          state0.updateCatalogProperties(response.data.votable, 'local', 'L');
        } else {
          state0.errors.localfile = `${event.target.files[0].name}: ${response.data.message || 'Upload error'}`;
        }
      }))
      .catch(action(error => {
        setPercent(null);
        setCancel(null);
        state0.errors.localfile = 'Upload error';
      }));
    // @@@ state0.handleQueryType(event, { value: 'L' });
  });

  const deleteLocalFile = action((event) => {
    state0.localfile = null;
    state0.errors.localfile = null;
    state0.updateCatalogProperties('', 'local', state0.queryType);
    if (cancel) cancel();
    axios.post('app/clean_local_files');
  })

  const loading = percent !== null;
  let error = state0.errors.localfile;

  return (
    <>
      {state0.localfile == null ?
        <>
          <FormField error={Boolean(error)}>
            <Button fluid onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)}
              onDragOver={(e) => e.preventDefault()} onDrop={dropHandler}
              as='label' htmlFor='dataUpload' icon='upload' content='Data upload' color={dragging ? 'yellow' : null} />
            {(error) ?
              <Label prompt pointing role='alert'>{error}</Label>
              : <></>
            }
          </FormField>
          <input type='file' id='dataUpload' hidden onChange={dataUploader} />
          {loading ?
            <Progress percent={percent} color='yellow' size='tiny' /> : <></>
          }
        </>
        :
        <>
          <FormField error={Boolean(error)}>
            <Button icon basic color={loading ? 'yellow' : (error ? 'red' : 'teal')} labelPosition='right' fluid>
              {`${state0.localfile.name} (${state0.localfile.size + ' bytes'})`}
              <Icon name='delete' link disabled={false} onClick={deleteLocalFile} />
            </Button>
            {error ? <Label prompt pointing role='alert'>{error}</Label> : <></>}
          </FormField>
        </>
      }
    </>);
});

export const MyForm0 = observer((props) => {
  const [wait, setWait] = useState('');

  const checkServer = action((e) => {
    e.preventDefault();
    if (state0.validate()) {
      // Check if the server is responding within 30 seconds
      let comps = state0.adqlComponents;
      state0.messageType = 'info';
      state0.messageHeader = 'Checking...';
      state0.messageContent = 'The server is being contacted and the query checked.';
      testServerQuery(serversDict[state0.server].server, comps.catalogs[0], comps.fields, comps.conditions)
        .then(action(result => {
          state0.messageType = 'success';
          state0.messageHeader = 'Server checked';
          state0.messageContent = 'The server has been contacted: the catalog is present and the query is syntactically correct.';
        }))
        .catch(action(error => {
          state0.messageType = 'error';
          state0.messageHeader = 'Server checked';
          state0.messageContent = error.toString();
          console.log(error);
        }));
    }
  })

  const saveQuery = action((e) => {
    e.preventDefault();
    if (state0.validate()) {
      let name = 'Test', query, server = state0.server;
      if (name in datasetsDict) query = datasetsDict[name];
      else datasetsDict[name] = query = { servers: [], catalogs: {}, coords: {}, bands: {}, classes: {}, extra: {}, extra_robust: {}};
      query.description = name;
      query.servers.push(server);
      query.catalogs[server] = state0.customCatalog;
      query.coords[server] = state0.coords;
      query.bands[server] = state0.catalogProperties.bandlist;
      if (state0.morphclass)
        query.classes[server] = [state0.morphclass, state0.morphclass, 'class1', 'class2'];
      if (state0.filter === 'C')
        query.extra_robust[server] = state0.advFilters;
    }
  })

  const handleNext = action((e) => {
    e.preventDefault();
    if (state0.validate()) props.onNext(e);
  });

  return (
    <>
      <Dimmer active={Boolean(wait)} page>
        <Header as='h2' inverted>
          <Loader inverted indeterminate content={String(wait)} />
        </Header>
      </Dimmer>
      <Form autoComplete='off'>
        <Header as='h2'>Dataset query</Header>
        <Header as='h3' dividing>Dataset selection</Header>
        <FormQueryType />
        {state0.queryType === 'C' ? <FormCustomConfiguration /> : <></>}
        {state0.queryType !== 'L' ?
          <Form.Group>
            <FormCatalog />
            <FormServer />
          </Form.Group>
          :
          <UploadButton />}
        {state0.queryType === 'S' ?
          <Form.Group>
            <FormBands />
            <FormMorhClass />
          </Form.Group>
          :
          <>
            <Header as='h3' dividing>Catalog properties</Header>
            {state0.catalogProperties.coords.length == 0 ?
              'You will be able to define the fields associated to coordinates, magnitudes, and object classification ' +
              'here after the ' + (state0.queryType === 'L' ? 'VOTable has been uploaded' : 'server has been queried.') :
              <>
                <FormAdvCoords />
                <FormAdvBands />
              </>}
          </>}
        <Header as='h3' dividing>Dataset filters</Header>
        <FormFilter />
        <Form.Field>
          <SQLArea />
        </Form.Field>

        <Button icon='phone' content='Check' onClick={checkServer} disabled={state0.queryType === 'L'} />
        <ClearButton data-tooltip={!state0.helper ? null : 'Click to reset all fields'} />
        <Button primary style={{ width: "110px" }} icon='right arrow' labelPosition='right' content='Next'
          disabled={state0.messageType !== null && state0.messageType !== 'success'} onClick={handleNext} />
        <Button icon='help' toggle active={state0.helper} onClick={action(() => state0.helper = !state0.helper)} floated='right' />
        <Button as='label' htmlFor='file' icon='upload' floated='right' />
        <input type='file' id='file' hidden onChange={props.uploader} />
      </Form>
      <FormMessage />
    </>);
});