// @ts-check
'use strict';

import _ from 'lodash'

const axios = require('axios').default;
/**
 * The URL corresponding to the TAP VizieR server
 * @constant {string}
 */
const TAP_VIZIER = 'http://TAPVizieR.u-strasbg.fr/TAPVizieR/tap';
/**
 * The URL corresponding to the VizieR server
 * @constant {string}
 */
const VIZIER_SERVER = 'http://vizier.u-strasbg.fr/viz-bin';

/**
 * @typedef {import('./form0.js').coordSpec} coordSpec
 */

/**
 * @typedef {import('./form0.js').bandSpec} bandSpec
 */

/**
 * @typedef {import('./form0.js').columnSpec} columnSpec
 */

/**
 * @typedef {import('./form0.js').catalogProperties} catalogProperties
 */

/**
 * Table 3 from Rieke & Lebovsky (1985), ApJ 288, 618: ratio A_lambda / A_V.
 * @type {{ [band: string]: number }}
 */
const RIEKE_LEBOVSKY = {
  'em.opt.U': 1.531,
  'em.opt.B': 1.324,
  'em.opt.V': 1.000,
  'em.opt.R': 0.748,
  'em.opt.I': 0.482,
  'em.IR.J': 0.282,
  'em.IR.H': 0.175,
  'em.IR.K': 0.112,
  'em.IR.3-4um': 0.058,
  'em.IR.4-8um': 0.023
};

/**
 * Parses an XML string representing a VOTable and produces a suitable object
 * @param {any} xmldata The XML data, as typically obtained from an XHR request
 * @param {('row'|'column')} [order='row'] The required order of the output
 * @returns {{ 'columns': any[], 'rows': (any[]|null) }} The parsed VOTable
 */
export function parseVOTable(xmldata, order = 'row', nodata = false ) {
  const constructors = {
    'byte': Int8Array, 'short': Int16Array, 'int': Int32Array,
    'long': (typeof BigInt64Array === 'undefined') ? Array : BigInt64Array,
    'unsignedByte': Uint8Array, 'unsignedShort': Uint16Array, 'unsignedInt': Uint16Array,
    'unsighedLong': (typeof BigUint64Array === 'undefined') ? Array : BigUint64Array,
    'float': Float32Array, 'double': Float64Array
  }
  // @ts-ignore
  let votable = new JsVotable.Votable(xmldata);
  let infos = votable.getInfos();
  let queryStatus = _.find(infos, i => i.name() === 'QUERY_STATUS');
  if (queryStatus && queryStatus.value() === 'ERROR')
    throw new Error('Malformed query.\n' + queryStatus.val);
  let resource = votable.getResources()[0];
  let table = resource.getResourcesOrTables()[0];
  let fields = table.getFields();
  let data = nodata ? null : table.getData();
  let trs = [];
  // @ts-ignore
  if (data != null && data.getDataImplementationName() === JsVotable.Constants.TAG.TABLEDATA) {
    let tabledata = data.getData();
    trs = tabledata.getTrs();
  }
  if (order === 'row') {
    const _parsers = {
      'byte': parseInt, 'short': parseInt, 'int': parseInt, 'long': parseInt,
      'unsignedByte': parseInt, 'unsignedShort': parseInt, 'unsignedInt': parseInt, 'unsighedLong': parseInt,
      'float': parseFloat, 'double': parseFloat
    }
    let rows = [], columns = [], parsers = [];
    for (let c = 0; c < fields.length; c++) {
      const attributes = fields[c].getAttributes(), datatype = attributes.datatype;
      columns.push({ ...attributes, description: fields[c].getDescription().value });
      if (datatype in constructors) {
        if (datatype !== 'float' && datatype !== 'double') parsers.push(parseInt);
        else parsers.push(parseFloat);
      } else parsers.push(x => x);
    }
    for (let tr of trs) {
      let row = {}, tds = tr.getTds();
      for (let i = 0; i < tds.length; i++)
        row[fields[i].getAttributes().name] = parsers[i](tds[i].getContent());
      rows.push(row);
    }
    return { columns, rows }
  } else {
    let columns = [];
    const nrows = trs.length;
    for (let c = 0; c < fields.length; c++) {
      let attrs = fields[c].getAttributes(), constructor = constructors[attrs.datatype];
      if (!constructor) constructor = Array;
      columns.push({
        ...attrs, description: fields[c].getDescription().value,
        data: new constructor(nrows)
      });
    }
    for (let r = 0; r < nrows; r++) {
      let tds = trs[r].getTds();
      for (let c = 0; c < tds.length; c++)
        columns[c].data[r] = tds[c].getContent();
    }
    return { columns, rows: null }
  }
}

/**
 * Cache of tables for each server.
 * @type {{ [server: string]: {name: string, title: string}[] }}
 */
let tableServerCache = {};

/**
 * Find a catalog in a TAP server starting from a query string.
 * @param {string} server The server to query
 * @param {string} query The query string. The individual words will be ANDed.
 * @param {'title'|'name'} [searchType='title'] The search type, i.e., where to
 * search for the `query` string: in the catalog title (default) or name.
 * @param {boolean} [caseless=true] If true, the query will be performed ignoring the case
 * @returns {Promise<{name: string, title: string}[]>} The list of matching catalogs, as an array of objects with
 *   `name` and `title` fields.
 * 
 * This function uses the `tap_schema.tables` table of the TAP server. Returns a promise
 * with the list of catalogs.
 */
export async function findTapCatalog(server, query, searchType = 'title', caseless = true) { 
  /**
   * @type { {name: string, title: string}[] }
   */
  let tables;
  let words = query.split(/\\s+/);
  if (tableServerCache[server] === undefined) {
    let response = await axios.get(server + '/sync', {
      params: {
        LANG: 'ADQL', REQUEST: 'doQuery', FORMAT: 'votable',
        QUERY: "SELECT TOP 100000 table_name AS name, description AS title FROM tap_schema.tables " +
          "WHERE schema_name != 'tap_schema' AND schema_name != 'TAP_SCHEMA' ORDER BY table_name",
        crossDomain: true
      },
      timeout: 30000
    });
    tables = parseVOTable(response.data).rows;
    tableServerCache[server] = tables;
  } else tables = tableServerCache[server];
  let regexp = RegExp(words.join('.*'), caseless ? 'i' : ''), result = [], count = 0;
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    if (table[searchType].match(regexp)) {
      result.push(table);
      count++;
      if (count >= 500) break;
    }
  }
  return result;
}

/**
 * Find a VizieR catalog starting from a query string.
 * @param {string} query The query string. The individual words will be ANDed.
 * @param {'title'|'name'} [searchType='title'] The search type, i.e., where to 
 * search for the `query` string: in the catalog title (default) or name.
 * @param {boolean} [caseless=true] If true, the query will be performed ignoring the case.
 * @returns {Promise<any[]>} The list of matching catalogs, as an array of objects with at 
 *   least the following columns:
 *   - `catid` catalog identification
 *   - `name` catalog name
 *   - `title` catalog short title
 *   - `bibcode`bibcode of the associated paper
 *   - `authors` comma-separated list of authors
 *   - `popu` popularity
 */
export async function findVizierCatalog(query, searchType = 'title', caseless=true) {
  let words = query.split(/\\s+/);
  let params = {
    '-source': 'METAcat',
    '-sort': '-popu',
    '-out.max': 500
  };
  params[searchType === 'name' ? 'name' : 'title'] = `${caseless ? '~' : '='}*${words.join('*')}*`;
  let response = await axios.get(VIZIER_SERVER + '/votable', {
    params: params,
    timeout: 30000
  });
  return parseVOTable(response.data).rows;
}

/**
 * List all VizieR tables of a catalog, given the catalog identification.
 * @param {number} catid The catid, as returned by `find_catalog`
 * @returns {Promise<any[]>} The list of tables, as an array of objects with 
 *   at least the following columns:
 *   - `name` full table name
 *   - `catid` catalog identificatin
 *   - `tabid` table identification
 *   - `explain` table description
 *   - `comment` optional comment associated with the table
 *   - `records` number of rows in the table
 */
export async function queryVizierTables(catid) {
  let response = await axios.get(VIZIER_SERVER + '/votable', {
    params: {
      '-source': 'METAtab',
      '-sort': '-records',
      '-out': 'name catid tabid explain comment records',
      '-out.max': 100,
      catid: catid
    },
    timeout: 30000
  });
  return parseVOTable(response.data).rows;
}

/**
 * Find the `catid` and `tabid` associated with a VizieR table name
 * @param {string} name The full table name
 * @returns {Promise<{ catid: number, tabid: number, records: number, title: string, comment: string }>}
 */
export async function findVizierTable(name) {
  let response = await axios.get(VIZIER_SERVER + '/votable', {
    params: {
      '-source': 'METAtab',
      '-out': '**',
      'name': '=' + name
    },
    timeout: 30000
  });
  let rows = parseVOTable(response.data).rows;
  if (rows.length == 0)
    throw new Error(`Table ${name} not found.`);
  return {
    catid: rows[0].catid, tabid: rows[0].tabid, records: rows[0].records,
    title: rows[0].explain, comment: rows[0].comment
  };
}

let vizierUCDCache = null;

export async function preloadVizierUCDs() {
  if (vizierUCDCache === null) {
    vizierUCDCache = {};
    let response = await axios.get(VIZIER_SERVER + '/votable', {
      params: {
        '-source': 'METAucd',
        '-out': 'ucdid name explain',
        '-out.max': 10000
      },
      timeout: 30000
    });
    let rows = parseVOTable(response.data).rows;
    for (let r = 0; r < rows.length; r++) {
      let row = rows[r];
      vizierUCDCache[row.ucdid] = { name: row.name, explain: row.explain };
    }
    return true;
  }
  return false;
}

export function parseVizierUCD(ucdid) {
  if (!vizierUCDCache)
    throw new Error('The function `preloadVizierUCDs` must be called before parsing any UCD.');
  let result = [];
  while (ucdid > 0) {
    let rem = ucdid % 1024;
    result.push(vizierUCDCache[rem].name);
    ucdid = Math.trunc(ucdid / 1024);
  }
  return result.join(';');
}

let vizierTypes = ['int', 'float', 'special', 'null', 'string', 'blob', 'bigint', 'null'];
let vizierSubTypes = {
  'int': { 0: 'int', 1: 'SHORTINT', 2: 'SHORTINT', 4: 'INTEGER', 8: 'BIGINT' },
  'float': { 0: 'float', 2: 'FLOAT', 4: 'FLOAT', 8: 'REAL' }
}

export function parseVizierType(type, size = 0) {
  let basetype = vizierTypes[type % 8];
  if (size) {
    if (basetype === 'int' || basetype === 'float')
      return vizierSubTypes[basetype][size];
    if (basetype === 'bigint') return vizierSubTypes['int'][8];
    if (basetype === 'string') basetype = 'CHAR';
    return `${basetype.toUpperCase()}(${size})`;
  } else return basetype;
}

/**
 * Query a TAP server and interpret the structure of a catalog
 * @param {string} server The server to query
 * @param {string} catalog The name of the catalog
 * @param {number?} catid The catalog identifier (only used if server == 'vizier')
 * @param {number?} tabid The table identifier (only used if server == 'vizier')
 * @returns {Promise<catalogProperties>}
 * The return value has three properties:
 * - `coords`: an object that list, for each coordinate system (Equatorial or Galactic) the names
 *   of the columns that give the coordinates (in order: RA/longitude, DE/latitude)
 * - `bandlist`: a list of tuples of the form [bandname, magnitude_column_name, error_column_name, extinction_law],
 *   where the extinction_law is taken from `RIEKE_LEBOVSKY`
 * - `columns`: the full list of columns, as returned by the `tap_schema.columns` query. Each object contains at 
 *   the fields `name`, `description`, `datatype`, `unit`, `ucd`, `indexed`. If the server is 'vizier',
 *   than the columns will also include the `notid` (note ID) and `default` flag.
 */
export async function queryTable(server, catalog, catid = undefined, tabid = undefined) {
  let columns = [];
  // Remove the quotes if necessary
  if (server !== 'local' && catalog.match(/^".*"$/)) catalog = catalog.substr(1, catalog.length - 2);
  if (server === 'vizier') {
    server = TAP_VIZIER;
    // Vizier queries are somewhat complex. We first need to identify the catalog and table ids...
    if (catid === undefined || tabid === undefined) {
      let tableData = await findVizierTable(catalog);
      catid = tableData.catid;
      tabid = tableData.tabid;
    }
    // We then have to query the special METAcol table
    let response = await axios.get(VIZIER_SERVER + '/votable', {
      params: {
        '-source': 'METAcol',
        '-out': 'name explain notid type length unit ucdid flags',
        '-out.max': 1000,
        'catid': catid,
        'tabid': tabid
      },
      timeout: 30000
    });
    // Finally, we need to parse the reply. The UCDs and datatypes are a little cumbersome.
    await preloadVizierUCDs();
    let vrows = parseVOTable(response.data).rows;
    for (let r = 0; r < vrows.length; r++) {
      const vrow = vrows[r]
      columns.push({
        name: vrow.name,
        description: vrow.explain,
        datatype: parseVizierType(vrow.type, vrow.length),
        unit: vrow.unit,
        ucd: parseVizierUCD(vrow.ucdid),
        indexed: Boolean(vrow.flags & 0x1000),
        default: Boolean(vrow.flags & 0x0001),
        notid: vrow.notid
      })
    }
  } else if (server === 'local') {
    columns = parseVOTable(catalog, 'row', true).columns;
  } else {
    let fields = ['column_name AS name', 'description', 'datatype', 'columns.unit AS unit', 'ucd', 'indexed'];
    let query = `SELECT TOP 1000 ${fields.join(',')} FROM tap_schema.columns WHERE table_name='${catalog}'`;
    let response = await axios.get(server + '/sync',
      {
        params: {
          lang: 'ADQL', request: 'doQuery', format: 'votable', query: query,
          crossDomain: true,
        },
        timeout: 30000
      });
    // Parse the data: since its a column table, each row is a column really!
    columns = parseVOTable(response.data).rows;
  }
  // Now parse the UCDs: this code is common between VizieR and TAP
  let coordDict = { E: [], G: [] };
  /** @type { bandSpec[] } */
  let bandlist = [];
  let partialBands = {}, knownBands = {};
  for (let column of columns) {
    const ucd = column.ucd.split(';'), name = column.name, main = ucd[ucd.length - 1] === 'meta.main';
    if (ucd[0] === 'pos.eq.ra') coordDict.E[0] = name;
    else if (ucd[0] === 'pos.eq.dec') coordDict.E[1] = name;
    if (ucd[0] === 'pos.galactic.lon' || ucd[0] === 'pos.gal.lon') coordDict.G[0] = name;
    else if (ucd[0] === 'pos.galactic.lat' || ucd[0] === 'pos.gal.lat') coordDict.G[1] = name;
    // First scan: check if we have complete 'phot.mag;xxx' + 'stat.error;phot.mag;xxx' UCDs.
    if (ucd[0] === 'phot.mag' && ucd.length >= 2) {
      let band = ucd[1].split('.'), bandname = band[band.length - 1];
      if (bandname in partialBands) {
        if (partialBands[bandname].err && !knownBands[bandname]) {
          bandlist.push([bandname, name, partialBands[bandname].err, RIEKE_LEBOVSKY[ucd[1]] || 0.0]);
          delete partialBands[bandname];
          knownBands[bandname] = true;
        }
      } else partialBands[bandname] = { mag: name, ucd: ucd[1] };
    } else if (ucd[0] === 'stat.error' && ucd[1] === 'phot.mag' && ucd.length >= 3) {
      let band = ucd[2].split('.'), bandname = band[band.length - 1];
      if (bandname in partialBands) {
        if (partialBands[bandname].mag && !knownBands[bandname]) {
          bandlist.push([bandname, partialBands[bandname].mag, name, RIEKE_LEBOVSKY[partialBands[bandname].ucd] || 0.0]);
          delete partialBands[bandname];
          knownBands[bandname] = true;
        }
      } else partialBands[bandname] = [name];
    }
  }
  // Second scan: if we have leftovers in partialBands, use the first 'stat.error;phot.mag' in the catalog.
  let last_band = '';
  for (let column of columns) {
    let ucd = column.ucd.split(';'), name = column.name, main = ucd[ucd.length - 1] === 'meta.main';
    if (ucd[0] === 'phot.mag' && ucd.length >= 2) {
      let band = ucd[1].split('.'), bandname = band[band.length - 1];
      if (bandname in partialBands && partialBands[bandname].mag && !knownBands[bandname]) last_band = bandname;
    } else if (ucd[0] === 'stat.error' && ucd[1] === 'phot.mag' && ucd.length == 2 && last_band && !knownBands[last_band]) {
      bandlist.push([last_band, partialBands[last_band].mag, name, RIEKE_LEBOVSKY[partialBands[last_band].ucd] || 0.0]);
      delete partialBands[last_band];
      knownBands[last_band] = true;
      last_band = '';
    }
  }
  // Finally, sort the colors by wavelengths (blue to red): we use the reddening law for this!
  bandlist.sort((x, y) => y[3] - x[3]);
  // Cleans the missing coordinates
  /** @type { coordSpec[] } */
  let coords = []
  for (let coord in coordDict)
    // @ts-ignore
    if (coordDict[coord].length > 0) coords.push([coord, coordDict[coord][0], coordDict[coord][1]]);
  return { coords, bandlist, columns, catid, tabid };
}

/**
 * Query a TAP server and interpret the structure of a catalog
 * @param {number} catid The catalog identifier
 * @param {number} notid The note identifier
 * @returns {Promise<string>} The note text, as a formatted HTML fragment
 */
export async function queryVizierNote(catid, notid) {
  let response = await axios.get(VIZIER_SERVER + '/votable', {
    params: {
      '-source': 'METAnot',
      '-out': 'text',
      'catid': catid,
      'notid': notid
    },
    timeout: 30000
  });
  // Parse the data: since its a column table, each row is a column really!
  let rows = parseVOTable(response.data).rows, pars = [], par = '';
  for (let r = 0; r < rows.length; r++) {
    let row = new Option(rows[r].text.trim()).innerHTML; // the Option stuff escapes < and >
    if (row === '') {
      if (par !== '') {
        pars.push(par);
        par = '';
      }
    } else {
      par += ' ' + row
        .replace(/\^([^\^ ]+)\^/g, '<sup>$1</sup>')
        .replace(/_([^_ ]+)_/g, '<sub>$1</sub>')
        .replace(/(\\begin|\\end){[^}]*}/g, '');
    }
  }
  if (par !== '') pars.push(par);
  if (pars.length > 0)
    return '<p>' + pars.join('</p>\n<p>') + '</p>';
  else
    return '';
}

export async function testServerQuery(server, table, fields, conditions) {
  let response;
  if (server === 'vizier') {
    let constraints = {};
    for (let c = 0; c < conditions.length; c++) {
      const condition = conditions[c];
      constraints[condition[0]] = condition[1] + condition[2];
    }
    response = await axios.get(VIZIER_SERVER + '/votable', {
      params: {
        '-source': table,
        '-out': fields.join(' '),
        '-out.max': 1,
        ...constraints
      },
      timeout: 30000
    });
  } else {
    let constraints = [];
    for (let c = 0; c < conditions.length; c++) {
      const condition = conditions[c];
      constraints.push(condition[0] + condition[1] + condition[2]);
    }
    let query = `SELECT TOP 1 ${fields.join(',')} FROM "${table}"`;
    if (constraints.length > 0) query += ` WHERE ${ constraints.join(' AND ') }`;
    response = await axios.get(server + '/sync',
      {
        params: {
          lang: 'ADQL', request: 'doQuery', format: 'votable', query: query,
          crossDomain: true,
        },
        timeout: 30000
      });
  }
  return parseVOTable(response.data);
}

/////////////////////////////////////////////////////////////////////////////
import React from 'react'

import { Dropdown } from 'semantic-ui-react'
import { colorDict } from './datasets';


