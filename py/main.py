#! /usr/bin/env python
"""Python server"""

from typing import Any, Optional, Union, Tuple, Sequence, cast, TYPE_CHECKING
import logging
import os
import time
import uuid
import math
import pickle
import re
from io import BytesIO
import numpy as np
import healpy as hp
import pyvo as vo
import cherrypy
import sqlite3
from astropy.io import fits
from astropy.table import Table, vstack
from astropy.coordinates import SkyCoord, Angle
from mocpy import MOC
from astroquery.vizier import Vizier
from spatial_index import SpatialIndex
from ADQL.adql import ADQL
import multiprocessing as mp
import astropy.wcs
from xnicer import XNicer, XDGaussianMixture, guess_wcs, make_maps
from xnicer.catalogs import PhotometricCatalogue, AstrometricCatalogue
from xnicer.kde import KDE

###############################################################################
# FIXME: this is a patch for astroquery.vizier.
# Once it is accepted, the code between this box can be deleted entirely.

from astroquery.utils import commons
from astroquery.vizier import VizierClass
import astropy.coordinates as coord
import six
import astropy.units as u


def _parse_angle(angle):
    """
    Returns the Vizier-formatted units and values for box/radius
    dimensions in case of region queries.

    Parameters
    ----------
    angle : convertible to `astropy.coordinates.Angle`

    Returns
    -------
    (unit, value) : tuple
        formatted for Vizier.
    """
    angle = coord.Angle(angle)
    if angle.unit == u.arcsec:
        unit, value = 's', angle.value
    elif angle.unit == u.arcmin:
        unit, value = 'm', angle.value
    else:
        unit, value = 'd', angle.to(u.deg).value
    return unit, value


def query_region_async(self, coordinates, radius=None, inner_radius=None,
                        width=None, height=None, catalog=None,
                        get_query_payload=False, frame='fk5', cache=True,
                        return_type='votable', column_filters={}):
    """
    Serves the same purpose as `query_region` but only
    returns the HTTP response rather than the parsed result.

    Parameters
    ----------
    coordinates : str, `astropy.coordinates` object, or `~astropy.table.Table`
        The target around which to search. It may be specified as a
        string in which case it is resolved using online services or as
        the appropriate `astropy.coordinates` object. ICRS coordinates
        may also be entered as a string.  If a table is used, each of
        its rows will be queried, as long as it contains two columns
        named ``_RAJ2000`` and ``_DEJ2000`` with proper angular units.
    radius : convertible to `~astropy.coordinates.Angle`
        The radius of the circular region to query.
    inner_radius : convertible to `~astropy.coordinates.Angle`
        When set in addition to ``radius``, the queried region becomes
        annular, with outer radius ``radius`` and inner radius
        ``inner_radius``.
    width : convertible to `~astropy.coordinates.Angle`
        The width of the square region to query.
    height : convertible to `~astropy.coordinates.Angle`
        When set in addition to ``width``, the queried region becomes
        rectangular, with the specified ``width`` and ``height``.
    catalog : str or list, optional
        The catalog(s) which must be searched for this identifier.
        If not specified, all matching catalogs will be searched.
    frame : str, optional
        The frame to use for the request: can be 'galactic' or 'fk5'.
        It influences the orientation of box requests.
    column_filters: dict, optional
        Constraints on columns of the result. The dictionary contains
        the column name as keys, and the constraints as values.

    Returns
    -------
    response : `requests.Response`
        The response of the HTTP request.

    """
    catalog = VizierClass._schema_catalog.validate(catalog)
    center = {}
    columns = []

    # Process coordinates
    if isinstance(coordinates, (commons.CoordClasses,) + six.string_types):
        c = commons.parse_coordinates(coordinates).transform_to(frame)

        if not c.isscalar:
            center["-c"] = []
            for pos in c:
                if frame == 'galactic':
                    glon_deg = pos.l.to_string(unit="deg", decimal=True,
                                               precision=8)
                    glat_deg = pos.b.to_string(unit="deg", decimal=True,
                                               precision=8, alwayssign=True)
                    center["-c"] += ["B{}{}".format(glon_deg, glat_deg)]
                else:
                    ra_deg = pos.ra.to_string(unit="deg", decimal=True,
                                              precision=8)
                    dec_deg = pos.dec.to_string(unit="deg", decimal=True,
                                                precision=8, alwayssign=True)
                    center["-c"] += ["{}{}".format(ra_deg, dec_deg)]
            columns += ["_q"]  # Always request reference to input table
        else:
            if frame == 'galactic':
                glon = c.l.to_string(unit='deg', decimal=True, precision=8)
                glat = c.b.to_string(unit="deg", decimal=True, precision=8,
                                     alwayssign=True)
                center["-c"] = "G{glon}{glat}".format(glon=glon, glat=glat)
            else:
                ra = c.ra.to_string(unit='deg', decimal=True, precision=8)
                dec = c.dec.to_string(unit="deg", decimal=True, precision=8,
                                      alwayssign=True)
                center["-c"] = "{ra}{dec}".format(ra=ra, dec=dec)
    elif isinstance(coordinates, tbl.Table):
        if (("_RAJ2000" in coordinates.keys()) and ("_DEJ2000" in
                                                    coordinates.keys())):
            center["-c"] = []
            sky_coord = coord.SkyCoord(coordinates["_RAJ2000"],
                                        coordinates["_DEJ2000"],
                                        unit=(coordinates["_RAJ2000"].unit,
                                                coordinates["_DEJ2000"].unit))
            for (ra, dec) in zip(sky_coord.ra, sky_coord.dec):
                ra_deg = ra.to_string(unit="deg", decimal=True,
                                        precision=8)
                dec_deg = dec.to_string(unit="deg", decimal=True,
                                        precision=8, alwayssign=True)
                center["-c"] += ["{}{}".format(ra_deg, dec_deg)]
            columns += ["_q"]  # Always request reference to input table
        else:
            raise ValueError("Table must contain '_RAJ2000' and "
                                "'_DEJ2000' columns!")
    else:
        raise TypeError("Coordinates must be one of: string, astropy "
                        "coordinates, or table containing coordinates!")

    # decide whether box or radius
    if radius is not None:
        # is radius a disk or an annulus?
        if inner_radius is None:
            radius = coord.Angle(radius)
            unit, value = _parse_angle(radius)
            key = "-c.r" + unit
            center[key] = value
        else:
            i_radius = coord.Angle(inner_radius)
            o_radius = coord.Angle(radius)
            if i_radius.unit != o_radius.unit:
                o_radius = o_radius.to(i_radius.unit)
            i_unit, i_value = _parse_angle(i_radius)
            o_unit, o_value = _parse_angle(o_radius)
            key = "-c.r" + i_unit
            center[key] = ",".join([str(i_value), str(o_value)])
    elif width is not None:
        # is box a rectangle or square?
        if height is None:
            width = coord.Angle(width)
            unit, value = _parse_angle(width)
            key = "-c.b" + unit
            center[key] = "x".join([str(value)] * 2)
        else:
            w_box = coord.Angle(width)
            h_box = coord.Angle(height)
            if w_box.unit != h_box.unit:
                h_box = h_box.to(w_box.unit)
            w_unit, w_value = _parse_angle(w_box)
            h_unit, h_value = _parse_angle(h_box)
            key = "-c.b" + w_unit
            center[key] = "x".join([str(w_value), str(h_value)])
    else:
        raise Exception(
            "At least one of radius, width/height must be specified")

    # Prepare payload
    data_payload = self._args_to_payload(center=center, columns=columns,
                                            catalog=catalog, column_filters=column_filters)

    if get_query_payload:
        return data_payload

    response = self._request(
        method='POST', url=self._server_to_url(return_type=return_type),
        data=data_payload, timeout=self.TIMEOUT, cache=cache)
    return response
###############################################################################


# Development mode: influence the directories used
DEVEL = True

# Cache: It true, locally saves results of old queries to speed new computations
USE_CACHE = True

# Path for the static files
STATIC_PATH = './src/static'

# Maximum number of objects that can be downloaded from a catalog
MAX_OBJS = 10**7

# Minimum number of objects for the pipeline to run
MIN_OBJS = 50

# TAP timeout in seconds
TAP_TIMEOUT = 120

# TAP queries are re-tried at most this number of times
TAP_MAX_FAILS = 5

# TAP return type: can be either 'votable' (slow) or 'fits' (fast)
TAP_RETURN_TYPE = 'fits'

# VizieR timeout in seconds
VIZIER_TIMEOUT = 600

# Vizier return type: can be either 'votable' (slow) or 'asu-binfits' (fast)
VIZIER_RETURN_TYPE = 'asu-binfits'

# Local database parameters
LOCAL_MOC_ORDER = 8
LOCAL_HPX_ORDER = 8
LOCAL_ADQL_ORDER = 8
LOCAL_ADQL_MODE = SpatialIndex.HTM

# Grace time for cached files in hours
GRACE_TIME = 24

# Last run of the clean_old_files
LAST_CLEAN_RUN = None

def getSession():
    id = cherrypy.session.get('ID')
    if not id:
        cherrypy.session['ID'] = str(uuid.uuid4())
        # FIXME: this really disabled the uuid4 sheme
        cherrypy.session['ID'] = cherrypy.session.id
        cherrypy.session['step'] = 0
    return cherrypy.session


class StaticServer:
    pass

import requests

class ProxyServer:
    @cherrypy.expose
    def index(self, url):
        # modify the url base and return the data/headers processed by another web server
        response = requests.get(url)
        # cherrypy.response.headers.update(response.headers)
        cherrypy.response.headers['Content-Type'] = response.headers['Content-Type']
        return response.text

class AppServer:
    """Main app server class."""
    
    def __init__(self, nprocs: int = 3):
        # self.pool = mp.Pool(nprocs)
        pass
    
    def _cp_dispatch(self, vpath):
        if len(vpath) == 3 and vpath[0] == 'products':
            cherrypy.request.params['filename'] = vpath.pop()
            cherrypy.request.params['id'] = vpath.pop()
            vpath[0] = 'download'
            return self
    
    @cherrypy.expose
    def index(self):
        return "Hello world!"

    def wait(self, s: int):
        c = 1.0
        c = 1.0
        for n in range(s*10**7):
            c = math.cos(c*c - 1)
        return c

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def ping_server(self):
        """Contact the server with a dummy query.

        Uses the provided server and catalogs and tries to retrieve the first
        line of each catalog to ensure the server is online and the catalog
        is available.
        """
        getSession()
        data = cherrypy.request.json
        try:
            if data['server'] == 'vizier':
                my_vizier = Vizier(columns=data['fields'])
                my_vizier.ROW_LIMIT = 3
                constraints = {}
                for field, sign, value in data['conditions']:
                    if field not in constraints:
                        constraints[field] = f'{sign}{value}'
                    else:
                        constraints[field] = f'{constraints[field]} & {sign}{value}'
                for catalog in data['catalogs']:
                    result = my_vizier.query_constraints(catalog=catalog, **constraints)
                    if len(result) == 0:
                        raise ValueError
            else:
                service = vo.dal.TAPService(data['server'])
                for catalog in data['catalogs']:
                    query = f"SELECT TOP 1 {', '.join(data['fields'])}\nFROM {catalog}"
                    if len(data['conditions']) > 0:
                        query += f"\nWHERE {' AND '.join([c[0] + c[1] + c[2] for c in data['conditions']])}"
                    result = service.search(query, maxrec=3)
            return {'success': True, 'header': 'Server checked',
                    'content': 'The server is responding and the catalog is available.'}
        except (vo.dal.DALQueryError, ValueError):
            return {'error': True, 'header': 'Catalog unavailable',
                    'content': 'The catalog is not available in the selected server.'}
        except Exception:
            return {'error': True, 'header': 'Server down',
                    'content': 'The server is not responding: please select a different server.'}

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def discover_table(self):
        """Contact the server and find out the available columns.

        Uses the provided server and catalogs and tries to retrieve the first
        line of each catalog.
        """
        getSession()
        data = cherrypy.request.json
        try:
            if data['server'] == 'vizier':
                my_vizier = Vizier()
                my_vizier.ROW_LIMIT = 1
                result = my_vizier.query_constraints(catalog=data['catalogs'][0])
                if len(result) == 0:
                    raise ValueError
                result = result[0]
            else:
                service = vo.dal.TAPService(data['server'])
                query = f"SELECT TOP 1 *\nFROM {data['catalogs'][0]}"
                result = service.search(query, maxrec=3).to_table()
            columns=[]
            for name, col in result.columns.items():
                columns.append((col.name, str(col.dtype),
                                str(col.unit), col.description))
            return {'success': True, 'columns': columns}
        except (vo.dal.DALQueryError, ValueError):
            return {'error': True, 'header': 'Catalog unavailable',
                    'content': 'The catalog is not available in the selected server.'}
        except Exception:
            return {'error': True, 'header': 'Server down',
                    'content': 'The server is not responding: please select a different server.'}

    @cherrypy.expose
    @cherrypy.tools.json_out()
    def upload_file(self, file):
        """Upload a local file

        Parameters
        ----------
        file : A file object, as returned by the JavaScript File interface
            The object is used to obtain the sequences of bytes. The data are
            saved in the cache directory using the session id in the filename.
            The table is supposed to be in a format that can automatically
            recognized by the astropy Table read interface. These include FITS,
            CSV, HDF5, and VOTable filles.
        """
        try:
            getSession()
            filetype = file.content_type.value
            filename = file.filename
            data = file.file.read()
            path = f"local_cache/data-{cherrypy.session['ID']}.dat"
            f = open(path, 'w+b')
            f.write(data)
            f.close()
            table = Table.read(path)
            # Create an empty VOTable with all columns
            from astropy.io.votable import from_table
            votable = from_table(table[:0])
            if votable.description is None:
                votable.description = ''
            # Add the UCD, if present in the meta dictionary
            first = votable.get_first_table()
            if first.description is None:
                first.description = ''
            for n, field in enumerate(first.fields):
                if field.description is None:
                    field.description = ''
                if f'UCD__{n + 1}' in table.meta:
                    field.ucd = table.meta[f'UCD__{n + 1}']
                elif f'UCD_{n + 1}' in table.meta:
                    field.ucd = table.meta[f'UCD_{n + 1}']
            out = BytesIO()
            votable.to_xml(out)
            out.seek(0)
            return {'success': True, 'votable': out.read()}
        except Exception as e:
            try:
                os.unlink(path)
            except Exception:
                pass
            return {'error': True, 'message': 'The data cannot be parsed as a catalog' } 
        
    @cherrypy.expose
    def clean_local_files(self):
        getSession()
        datapath = f"local_cache/data-{cherrypy.session['ID']}.dat"
        dbpath = f"local_cache/db-{cherrypy.session['ID']}.db"
        hpxpath = f"local_cache/densityMap-{cherrypy.session['ID']}.hpx"
        paths = [datapath, dbpath, hpxpath]
        for path in paths:
            if os.path.isfile(path):
                try:
                    os.unlink(path)
                except Exception as e:
                    pass
                
    @cherrypy.expose
    def clean_old_files(self):
        import glob
        global LAST_CLEAN_RUN
        now = time.time()
        grace_time = GRACE_TIME * 3600
        if LAST_CLEAN_RUN is None or now - LAST_CLEAN_RUN > grace_time:
            for path in glob.glob('local_cache/*'):
                try:
                    stat = os.stat(path)
                    if now - stat.st_ctime > grace_time:
                        os.unlink(path)
                except Exception:
                    pass
            for path in glob.glob('processes/*'):
                try:
                    stat = os.stat(path)
                    if now - stat.st_ctime > grace_time:
                        os.unlink(path)
                except Exception:
                    pass
            LAST_CLEAN_RUN = now

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def get_moc(self):
        """Return the MOC of a database.
        
        The MOC is available only for VizieR catalogs (downloaded from the
        VizieR MOC database) or for local tables (built on-the-fly).
        """
        getSession()
        data = cherrypy.request.json
        try:
            if data['server'].lower() == 'vizier':
                catalog = data['catalog'].strip()
                url = f"static/mocs/{catalog.replace('/', '_')}.fits"
                path = f'../src/{url}'
                neg_url = f"static/mocs/_{catalog.replace('/', '_')}.fits"
                neg_path = f'../src/{neg_url}'
                if not os.path.exists(path) and not os.path.exists(neg_path):
                    try:
                        moc = MOC.from_vizier_table(catalog, nside=512)
                        if not moc.empty():
                            negative = moc.sky_fraction > 0.5
                            if negative:
                                moc = moc.complement()
                                path = neg_path
                                url = neg_url
                            moc.write(path, overwrite=True)
                        else:
                            return {'success': True, 'url': ''}
                    except:
                        return {'error': True, 'message': 'MOC does not exists'}
                else:
                    if not os.path.exists(path):
                        path = neg_path
                        url = neg_url
                    moc = MOC.from_fits(path)
                return {'success': True, 'url': url}
            elif data['server'] == 'local':
                path = f"local_cache/data-{cherrypy.session['ID']}.dat"
                table = Table.read(path)
                # Find the equatorial coords
                coords = [(c[1], c[2]) for c in data['coords'] if c[0] == 'E']
                if len(coords) == 0:
                    return {'error': True, 'message': 'Equatorial coordinates needed'}
                coords = coords[0]
                moc = MOC.from_lonlat(astropy.units.Quantity(table[coords[0]]), 
                                      astropy.units.Quantity(table[coords[1]]), LOCAL_MOC_ORDER)
                url = f"static/mocs/session-{cherrypy.session['ID']}.fits"
                path = f'../src/{url}'
                moc.write(path, overwrite=True)
                return {'success': True, 'url': url}
        except Exception as e:
            raise

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def ingest_database(self):
        """Perform a sqlite3 ingestion of a local database.
        
        The ingesion is carried out including columns for ADQL constraints,
        as requested by the ADQL library. The original table is supposed to be
        already present in the cache directory; there the database will also
        be saved.
        """
        getSession()
        data = cherrypy.request.json
        try:
            if data['server'] == 'local':
                path = f"local_cache/data-{cherrypy.session['ID']}.dat"
                table = Table.read(path)
                # Find the equatorial coords
                coords = [(c[1], c[2]) for c in data['coords'] if c[0] == 'E']
                if len(coords) == 0:
                    return {'error': True, 'message': 'Equatorial coordinates needed'}
                coords = coords[0]
                ra = table[coords[0]]
                dec = table[coords[1]]
                zs = np.sin(np.deg2rad(dec))
                cos_dec = np.cos(np.deg2rad(dec))
                xs = cos_dec * np.cos(np.deg2rad(ra))
                ys = cos_dec * np.sin(np.deg2rad(ra))
                # Compute the indices
                si = SpatialIndex()
                idx = si.index(ra, dec, mode=LOCAL_ADQL_MODE, level=LOCAL_ADQL_ORDER)
                # Enlarge the table
                table['__ra'] = ra
                table['__dec'] = dec
                table['__x'] = xs
                table['__y'] = ys
                table['__z'] = zs
                table['__idx'] = idx
                # SQLITE3 database commands
                dbpath = f"local_cache/db-{cherrypy.session['ID']}.db"
                con = sqlite3.connect(dbpath)
                fields = []
                sql_fields = []
                for c in range(len(table.columns)):
                    column = table.columns[c]
                    name = column.name
                    if isinstance(column[0], (int, np.integer)):
                        sql_fields.append(f'"{column.name}" INTEGER')
                        fields.append((int, table[name].data))
                    elif isinstance(column[0], (float, np.floating)):
                        sql_fields.append(f'"{column.name}" REAL')
                        fields.append((float, table[name].data))
                    else:
                        sql_fields.append(f'"{column.name}" TEXT')
                        fields.append((str, table[name].data))
                con.execute('DROP TABLE IF EXISTS main')
                con.execute(f'CREATE TABLE main ({",".join(sql_fields)})')
                command = f'INSERT INTO main VALUES ({",".join(["?"]*len(sql_fields))})'
                table_gen = (tuple(f(v[i]) for f, v in fields) for i in range(len(table)))
                con.executemany(command, table_gen)
                con.commit()
                con.close()
                # Compute the density map
                hpxpath = f"local_cache/densityMap-{cherrypy.session['ID']}.hpx"
                order = LOCAL_HPX_ORDER
                nside = hp.order2nside(order)
                npix = hp.nside2npix(nside)
                idx = si.index(ra, dec, mode=si.HPX, level=order)
                data = np.bincount(idx.astype(np.int64), minlength=npix)
                hpx = Table()
                hpx.meta['PIXTYPE'] = 'HEALPIX'
                hpx.meta['NSIDE'] = nside
                hpx.meta['ORDERING'] = 'NESTED'
                hpx.meta['COORDSYS'] = 'C'
                hpx.meta['TDMIN'] = np.min(data)
                hpx.meta['TDMAX'] = np.max(data)
                hpx['densityMap'] = data.astype(np.float64)
                hpx.write(hpxpath, format='fits', overwrite=True)
                return {'success': True}
            return {'success': True}
        except Exception as e:
            return {'error': True}

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def count_stars(self):
        """Count the approximate number of stars for a query.

        Uses the provided boundaries in galactic coordinates and the specified
        dataset. The estimate is performed using a density map in healpy format.
        
        The data are taken from 
        """
        getSession()
        self.clean_old_files()
        data = cherrypy.request.json
        nest = False
        if data['server'] == 'local':
            hpxpath = f"local_cache/densityMap-{cherrypy.session['ID']}.hpx"
            try:
                rho, header = hp.read_map(hpxpath, h=True, nest=nest, verbose=False)
            except:
                return {'error': True, 'header': 'Missing data',
                        'content': 'Could not load the healpix file with the density map'}
        else:
            if False:
                rho, header = hp.read_map(
                    f'../{STATIC_PATH}/hips/{data["dataset"]}.hpx', h=True, 
                    verbose=False)
            else:
                catname = data["catalogs"][0].replace('/', '_').replace('+','%2B').replace('"', '')
                basename = 'http://alasky.u-strasbg.fr/footprints/tables/vizier'
                header = None
                for nside in [256, 128, 64]:
                    url = f'{basename}/{catname}/densityMap?nside={nside}'
                    try:
                        rho, header = hp.read_map(url, h=True, nest=nest, 
                                                  verbose=False)
                        break
                    except:
                        pass
                if header is None:
                    res = {'error': True, 'header': 'Missing data',
                        'content': f'We could not find any density Healpix file for this dataset'}
                    return res
        header = dict(header)
        nside = header['NSIDE']
        coo_sys = 'G' if data['coo_sys'] == 'G' else 'C'
        inclusive = True
        if data['shape'] == 'B':
            corners = data['corners']
            xs = np.radians([c[0] for c in corners])
            ys = np.pi/2 - np.radians([c[1] for c in corners])
            vecs = hp.ang2vec(ys, xs)
            mask = hp.query_polygon(nside, vecs,
                                    inclusive=inclusive, nest=nest)
            # Change the coordinate system if necessary
            if header['COORDSYS'] != coo_sys:
                r = hp.Rotator(coord=[coo_sys, header['COORDSYS']])
                mask = hp.vec2pix(nside, 
                                  *r(hp.pix2vec(nside, mask, nest=nest)), 
                                  nest=nest)
        else:
            vec = hp.ang2vec(np.radians(90.0 - data['lat_ctr']),
                             np.radians(data['lon_ctr']))
            if header['COORDSYS'] != coo_sys:
                r = hp.Rotator(coord=[coo_sys, header['COORDSYS']])
                vec = r(vec)
            mask = hp.query_disc(nside, vec, np.radians(data['radius']), 
                                 inclusive=inclusive, nest=nest)
        nstars = np.sum(rho[mask])
        if (nstars < 200):
            star_number = f'~{int(nstars)}'
        elif (nstars < 2000):
            star_number = f'~{(nstars // 10) / 10} hundends'
        elif (nstars < 200000):
            star_number = f'~{(nstars // 100) / 10} thousands'
        else:
            star_number = f'~{(nstars // 100000) / 10} millions'
        if nstars < MAX_OBJS and data['start_query']:
            if data['server'] == 'vizier':
                job_urls = self.start_vizier_query()
            else:
                job_urls = self.start_tap_query()
        else:
            job_urls = []
        if nstars > MAX_OBJS:
            res = {'error': True, 'header': 'Area checked',
                   'content': f'The area contains too many stars ({star_number}): try reducing the boundaries.'}
        elif nstars < MIN_OBJS:
            res = {'error': True, 'header': 'Area checked',
                   'content': f'The area contains too few stars ({star_number}): try enlarging the boundaries.'}
        else:
            res = {'success': True, 'header': 'Area checked',
                   'content': f'The area contains an appropriate number of stars ({star_number}).'}
        return {'message': res, 'nstars': nstars, 'job_urls': job_urls}

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def start_tap_query(self):
        """Initiate a TAP query.

        The query is based on the provided query string, with added geometric
        constraints.
        
        The query is repeated for all catalogs indicated in the FROM part of the
        query.
        """
        data = cherrypy.request.json
        step = data['step']
        session = getSession()
        coords = {c[0]: c[1:] for c in data['coords']}
        coo_sys = data['coo_sys']
        shape = data['shape']
        # Tries to work with equatorial coordinates if possibile
        coo_codes = {'E': 'ICRS', 'G': 'GALACTIC'}
        if data['server'] == 'local':
            coordinate = 'E'
            lon_name = '__ra'
            lat_name = '__dec'
        else:
            coordinate = 'E' if 'E' in coords else list(coords.keys())[0]
            lon_name = coords[coordinate][0]
            lat_name = coords[coordinate][1]
        if shape == 'B':
            corners = data['corners']
            if coo_sys != coordinate:
                for n in range(len(corners)):
                    point = SkyCoord(corners[n][0], corners[n][1], 
                                     frame=coo_codes[coo_sys].lower(), unit='deg')
                    if coordinate == 'E':
                        corners[n][0] = point.icrs.ra.value
                        corners[n][1] = point.icrs.dec.value
                    else:
                        corners[n][0] = point.galactic.l.value
                        corners[n][1] = point.galactic.b.value
            polygon = [f'{corner[0]},{corner[1]}' for corner in corners]
            constraints = f"1=CONTAINS(POINT('{coo_codes[coordinate]}', {lon_name}, {lat_name}), " + \
                f"POLYGON('{coo_codes[coordinate]}', {', '.join(polygon)}))"
        else:
            lon_ctr = data['lon_ctr']
            lat_ctr = data['lat_ctr']
            radius = data['radius']
            if coo_sys != coordinate:
                center = SkyCoord(lon_ctr, lat_ctr, 
                                  frame=coo_codes[coo_sys].lower(), unit='deg')
                if coordinate == 'E':
                    lon_ctr = center.icrs.ra.value
                    lat_ctr = center.icrs.dec.value
                else:
                    lon_ctr = center.galactic.l.value
                    lat_ctr = center.galacrtic.b.value
            constraints = f"1=CONTAINS(POINT('{coo_codes[coordinate]}', {lon_name}, {lat_name}), " + \
                f"CIRCLE('{coo_codes[coordinate]}', {lon_ctr}, {lat_ctr}, {radius}))"
        if len(data['conditions']) > 0:
            if data['server'] == 'vizier':
                for field, sign, value in data['conditions']:
                    if field not in constraints:
                        constraints[field] = f'{sign}{value}'
                    else:
                        constraints[field] = f'{constraints[field]} & {sign}{value}'
            else:
                constraints += f" AND {' AND '.join([c[0] + c[1] + c[2] for c in data['conditions']])}"
        job_urls = self.execute_tap_query(step, data['server'], data['catalogs'], 
                                          data['fields'], constraints)
        session['step'] = step
        return job_urls

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def start_vizier_query(self):
        """Initiate a VizieR query.

        The query is based on the provided query string, with added geometric
        constraint.
        
        The query is repeated for all catalogs indicated in the FROM part of the
        query.
        """
        data = cherrypy.request.json
        step = data['step']
        session = getSession()
        coords = data['coords']
        coo_sys = data['coo_sys']
        shape = data['shape']
        lon_ctr = data['lon_ctr']
        lat_ctr = data['lat_ctr']
        coo_codes = {'E': 'ICRS', 'G': 'GALACTIC'}
        center = SkyCoord(lon_ctr, lat_ctr, frame=coo_codes[coo_sys].lower(),
                          unit='deg')
        if shape == 'B':
            geometry = {'width': Angle(data['lon_wdt'], 'deg'), 
                        'height': Angle(data['lat_wdt'], 'deg')}
        else:
            geometry = {'radius': Angle(data['radius'], 'deg')}
        constraints = {}
        if len(data['conditions']) > 0:
            for field, sign, value in data['conditions']:
                if field not in constraints:
                    constraints[field] = f'{sign}{value}'
                else:
                    constraints[field] = f'{constraints[field]} & {sign}{value}'
        job_urls = self.execute_vizier_query(step, data['server'], data['catalogs'],
                                             data['fields'], 
                                             center, geometry, constraints)
        session['step'] = step
        return job_urls

    def _process_state(self, session):
        process_log = session.get('process_log')
        if process_log:
            return process_log[-1]['state']
        else:
            return ''

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def process(self):
        session = getSession()
        process_log = session.get('process_log')
        process_state = self._process_state(session)
        res = {'success': True, 'header': 'Connection established',
               'content': 'The server has accepted the connection and has started the pipeline.'}
        if process_state == 'run':
            # Process started already: we stop it!
            self.stop_process()
        try:
            data = cherrypy.request.json
            if 'data' in data:
                session['data_3'] = data['data']
            # FIXME: Here and elsewhere I use session.id; what is the difference with session['ID']?
            # Which is more stable? Which one is reset with a page reload (Command-R)?
            with open(f'processes/process_{session.id}.dat', 'wb') as f:
                pickle.dump(session.id, f)
                pickle.dump(session['data_3'], f)
            session['process_log'] = process_log = manager.list([])
            proc = pool.apply_async(
                self.do_process, 
                (session.id, process_log, session['data_3']))
            session['process'] = proc
        except Exception as e:
            res = {'error': True, 'header': 'Pipeline error',
                    'content':
                        f'Error {"re" if process_state else ""}starting the pipeline for session ID {session.id}:\n{e}'}
            logging.exception('Fatal error during process %s', 
                                'restart' if process_state else 'creation')
        return {'message': res, 'logs': list(process_log)}

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def stop_process(self):
        session = getSession()
        process_log = session.get('process_log')
        process_state = self._process_state(session)
        if process_state == 'run':
            message = f'Stopping process for session ID {session.id}'
            logging.info('%s', message)
            if len(process_log) > 0:
                time = process_log[-1]['time']
                step = process_log[-1]['step']
            else:
                time = 0.0
                step = 0
            process_log.append(
                {'time': time,
                 'state': 'abort',
                 'step': step,
                 'message': message})
            res = {'success': True, 'header': 'Aborting', 'content': message}
        else:
            res = {'error': True, 'header': 'Error',
                   'content':
                       f'Could not find running process for session ID {session.id}:'}
            logging.exception('Fatal error during process abort')
        return {'message': res, 'logs': list(process_log)}

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def abort_process(self, silent=False):
        session = getSession()
        process_log = session.get('process_log')
        process_state = self._process_state(session)
        if process_state == 'run':
            self.stop_process()
        process_state = self._process_state(session)
        if process_state:
            message = f'Aborting process for session ID {session.id}'
            logging.info('%s', message)
            # Stop the previous queries if present
            self.abort_query(1)
            self.abort_query(2)
            # Remove all process files
            for ext in ('dat', 'log', 'fits'):
                try:
                    logging.info(f'Unlinking process_{session.id}.{ext}')
                    os.unlink(f'processes/process_{session.id}.{ext}')
                except FileNotFoundError:
                    pass
            # Fix a few session variables
            for var in ('data_3', 'URLs_1', 'URLs_2', 'process_log'):
                try:
                    del session[var]
                except KeyError:
                    pass
            session['step'] = 0
            res = {'success': True, 'header': 'Aborting', 'content': message}
        else:
            res = {'error': True, 'header': 'Error',
                   'content':
                       f'Could not find any process for session ID {session.id}:'}
            if not silent:
                logging.exception('Fatal error during process full abort')
        return {'message': res, 'logs': list(process_log)}

    @classmethod
    def do_abort_queries(cls, job_urls):
        for job_url in job_urls:
            if job_url[:9] == 'vizier://':
                continue
            try:
                job = vo.dal.tap.AsyncTAPJob(job_url)
                job.delete()
            except Exception:
                pass

    @classmethod
    def do_process(cls, id, process_log, data_pr):
        if process_log is None:
            process_log = []
            logging.basicConfig(level=logging.INFO)
            interactive_mode = True
        else:
            logging.basicConfig(filename=f'processes/process_{id}.log', 
                                level=logging.DEBUG)
            interactive_mode = False
        t0 = time.perf_counter()

        def info(step, message, state='run'):
            if len(message) and message[0] == '%':
                if len(process_log) > 0 and process_log[-1]['message'][0] == '%':
                    process_log.pop()
            else:
                logging.info('%s', message)
            if len(process_log) > 0 and process_log[-1]['state'] == 'abort':
                raise KeyboardInterrupt
            if step < 0:
                if len(process_log) > 0:
                    step = process_log[-1]['step']
                else:
                    step = 0
            return process_log.append(
                {'time': time.perf_counter() - t0,
                 'state': state,
                 'step': step,
                 'message': message})
        try:
            info(1, f'Starting (session id: {id})')
            info(1, f'Retrieving control field data: expecting {data_pr["nstars_cf"]:,.0f} objects')
            cf_data = cls.retrieve_data(id, 2, data_pr['urls_cf'], 
                                        logger=lambda message: info(2, message),
                                        expected=data_pr["nstars_cf"])
            info(3, f'{len(cf_data):,.0f} objects found')
            info(3, 'Converting photometric data')
            phot_c = PhotometricCatalogue.from_table(
                cf_data, data_pr['mags'], data_pr['magErrs'],
                reddening_law=data_pr['reddeningLaw'],
                class_names=[
                    'obj1', 'obj2'] if data_pr['morphclass'] else None,
                class_prob_names=data_pr['morphclass'],
                log_class_probs=False, dtype=np.float64)
            phot_c.add_log_probs()
            info(4, f'{len(phot_c):,.0f} objects with two or more bands')
            info(4, 'Fitting number counts and uncertainties')
            phot_c.fit_number_counts()
            phot_c.fit_phot_uncertainties()
            # Check wich coordinates to use
            wcs = data_pr['wcs']
            data_coords = {v[0]: (v[1], v[2]) for v in data_pr['coords']}
            if wcs['coosys'] == 'galactic':
                wcs_frame = 'galactic'
                if 'G' in data_coords:
                    frame = 'galactic'
                    coords = data_coords['G']
                else:
                    frame = 'icrs'
                    coords = data_coords['E']
            else:
                wcs_frame = 'icrs'
                if 'E' in data_coords:
                    frame = 'icrs'
                    coords = data_coords['E']
                else:
                    frame = 'galactic'
                    coords = data_coords['G']
            info(5, f'Using coordinates in the {frame} frame')
            if data_pr['starFraction'] < 100 or data_pr['areaFraction'] < 100:
                info(5, f'Selection of control field objects')
                # We model control field data with a single Gaussian blob
                xd0 = XDGaussianMixture(n_components=1, n_classes=1)
                xnicer0 = XNicer(xd0, [0.0])
                xnicer0.fit(phot_c)
                # Finding the control field extinctions
                ext_c0 = xnicer0.predict(phot_c.get_colors())
                # and the control field cooordinates
                coord_c0 = AstrometricCatalogue.from_table(
                    cf_data, coords, unit='deg', frame=frame)
                # Guessing the control field WCS
                coord_c1 = getattr(coord_c0, wcs_frame)
                w0 = guess_wcs(coord_c1, 
                               nobjs=len(ext_c0), target_density=5.0)
                smoother0 = KDE(tuple(reversed(w0.pixel_shape)), max_power=2,
                                bandwidth=2.0)
                hdu0 = make_maps(coord_c1, ext_c0, w0,
                                 smoother0, n_iters=3, tolerance=3.0, use_xnicest=False)
                cmap0 = hdu0.data[0, :, :]
                civar0 = hdu0.data[1, :, :]
                mask = np.zeros_like(cmap0, dtype=np.uint8)
                sel1 = np.where(cmap0 != 0)
                median = np.median(civar0[sel1])
                sel2 = np.where(civar0 > median / 3)  # Areas with err < 9*median[err]
                srt1 = np.argsort(cmap0[sel2])
                sel3 = srt1[0:int(len(srt1) * data_pr['areaFraction'])]
                mask[sel2[0][sel3], sel2[1][sel3]] = 1
                names = list(
                    coord_c1.frame.representation_component_names.keys())
                coord_c2 = coord_c1[phot_c['idx']]
                xy = w0.all_world2pix(
                    getattr(coord_c2, names[0]).deg,
                    getattr(coord_c2, names[1]).deg, 0)
                sel4 = np.where(mask[(np.round(xy[1])).astype(int), (np.round(xy[0])).astype(int)])
                phot_c = phot_c[sel4]
                ext_c0 = ext_c0[sel4]
                info(5, f'Selected {len(phot_c):,.0f} objects from the control field extinction map')
                srt2 = np.argsort(ext_c0['mean_A'])
                sel5 = srt2[0:int(len(phot_c) * data_pr['starFraction'])]
                phot_c = phot_c[sel5]
                info(5, f'Selected {len(phot_c):,.0f} objects from individual extinctions')
            info(5, 'Performing the extreme deconvolution')
            xd = XDGaussianMixture(n_components=data_pr['numComponents'], 
                                   n_classes=2 if data_pr['morphclass'] else 1)
            xnicer = XNicer(xd, np.linspace(0.0, data_pr['maxExtinction'], 
                                            data_pr['extinctionSteps']))
            xnicer.fit(phot_c)
            info(6, 'Performing the control field a-posteriori calibration')
            xnicer.calibrate(phot_c, 
                             np.linspace(
                                -1.0, data_pr['maxExtinction'], 
                                data_pr['extinctionSteps']*data_pr['extinctionSubsteps']),
                             update_errors=False)
            info(7, 'Control field analysis')
            # Compute the extinction from the color catalogue
            ext_c = xnicer.predict(phot_c.get_colors())
            # Compute the weights as the inverse of each extinction measurement
            weight_c = 1.0 / ext_c['variance_A']
            # We normalize the weight_c so that its mean is unity: this simplifies
            # some of the equations below
            weight_c /= np.mean(weight_c)
            # The bias is the weighted sum of the extinction measurements
            bias_c = np.mean(ext_c['mean_A'] * weight_c)
            # The mean squared error is computed below
            mse_c = np.sqrt(np.mean((ext_c['mean_A'] * weight_c) ** 2))
            # Average estimated variance: should be close to the MSE
            err_c = np.sqrt(np.mean(ext_c['variance_A'] * weight_c**2))
            # We also make an histogram plot with the next line, but we don't here!
            # plt.hist(ext_c['mean_A'], bins=200, range=[-1, 1])
            info(7, f'Bias = {bias_c:.3f}, MSE = {mse_c:.3f}, Err = {err_c:.3f}')
            info(7, 
                 f'Retrieving science field data: expecting {data_pr["nstars_sf"]:,.0f} objects')
            sf_data = cls.retrieve_data(id, 1, data_pr['urls_sf'],
                                        logger=lambda message: info(8, message),
                                        expected=data_pr["nstars_sf"])
            info(9, f'{len(sf_data):,.0f} objects found')
            info(9, 'Converting photometric data')
            phot_s = PhotometricCatalogue.from_table(
                sf_data, data_pr['mags'], data_pr['magErrs'],
                reddening_law=data_pr['reddeningLaw'],
                class_names=[
                    'obj1', 'obj2'] if data_pr['morphclass'] else None,
                class_prob_names=data_pr['morphclass'],
                log_class_probs=False, dtype=np.float64)
            info(9, f'{len(phot_s)} objects with two or more bands')
            phot_s.add_log_probs()
            info(9, 'Computing extinctions')
            ext_s = xnicer.predict(phot_s.get_colors())
            coord_s = AstrometricCatalogue.from_table(
                sf_data, coords, unit='deg', frame=frame)
            info(10, 'Map making')
            w = astropy.wcs.WCS(naxis=2)
            w.pixel_shape = (wcs['naxis1'], wcs['naxis2'])
            w.wcs.crpix = [wcs['crpix1'], wcs['crpix2']]
            if wcs_frame == 'galactic':
                w.wcs.ctype = [f'GLON-{wcs["projection"]}', 
                               f'GLAT-{wcs["projection"]}']
            else:
                w.wcs.ctype = [f'RA---{wcs["projection"]}',
                               f'DEC--{wcs["projection"]}']
            w.wcs.crval = [wcs['crval1'], wcs['crval2']]
            w.wcs.cdelt = [-wcs['scale'] / 3600.0, wcs['scale'] / 3600.0]
            w.wcs.crota = [0.0, wcs['crota2']]
            if isinstance(wcs['lonpole'], (int, float)) and \
                wcs['lonpole'] == wcs['lonpole']:
                w.wcs.lonpole = wcs['lonpole']
            if isinstance(wcs['latpole'], (int, float)) and \
                    wcs['latpole'] == wcs['latpole']:
                w.wcs.latpole = wcs['latpole']
            if coord_s.equinox:
                w.wcs.equinox = np.round(coord_s.equinox.decimalyear)
            smoother = KDE(tuple(reversed(w.pixel_shape)), max_power=2,
                           bandwidth=data_pr['smoothpar'])
            use_xnicest = bool(
                {'XNICEST map', 'XNICEST inverse variance'} & set(data_pr['products']))
            hdu = make_maps(getattr(coord_s, wcs_frame), ext_s, w,
                            smoother, n_iters=data_pr['clipIters'], 
                            tolerance=data_pr['clipping'], use_xnicest=use_xnicest)
            info(11, 'Saving results')
            hdu.writeto(f'processes/process_{id}.fits', overwrite=True, 
                        checksum=True)
            info(12, 'Process completed', state='end')
        except KeyboardInterrupt:
            logging.info('Keyboard Interrupt')
        except Exception as ex:
            import traceback
            logging.exception('Fatal error during process execution')
            info(-1, f'Error: {ex.__class__.__name__}\n{ex.args}', state='error')
            # info(-1, traceback.format_exc())
            if interactive_mode:
                raise

    @cherrypy.expose
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def monitor(self):
        session = getSession()
        process_log = session.get('process_log')
        if process_log:
            return {'success': True, 'log': list(process_log)}
        else:
            return {'success': False, 'log': []}

    @cherrypy.expose
    def download(self, filename, id=None):
        # Find the right plane
        planes = ['ext_map.fits', 'ext_ivar.fits', 'weight.fits', 'density.fits', 
                  'xext_map.fits', 'xext_ivar.fits', 'xweight.fits']
        try:
            idx = planes.index(filename)
        except ValueError:
            return ''
        # Load the FITS cube
        if not id:
            session = getSession()
            id = session.id
        hdu = fits.open(f'processes/process_{id}.fits')
        # DEBUG ONLY: hdu = fits.open(f'test.fits')
        header = hdu[0].header
        # Extract the data
        data = hdu[0].data[idx, :, :]
        # Fix the header
        card = header.cards[header.index(f'PLANE{idx+1}')]
        for p in range(1, 8):
            try:
                del header[f'PLANE{p}']
            except KeyError:
                pass
        header['NAXIS'] = 2
        del header['NAXIS3']
        del header['CHECKSUM']
        del header['DATASUM']
        if len(card) > 2:
            # Unit present in the description?
            m = re.match(r'\[.*\]', card[2])
            if m:
                header['BUNIT'] = m.group(0)[1:-1]
        # Make a new FITS file using the new header and data
        stream = BytesIO()
        newhdu = fits.PrimaryHDU(data, header)
        newhdu.writeto(stream)
        stream.seek(0)
        return cherrypy.lib.static.serve_fileobj(
            stream, 'application/x-download', 'attachment', filename)

    # Data handling

    def execute_tap_query(self, step: int, server: str, catalogs: Sequence[str], 
                      fields: Sequence[str], constraints: Union[str, dict]):
        session = getSession()
        # Check if the query has changed
        querydata = (server, catalogs, fields, constraints)
        try:
            if session.get(f'querydata_{step}', ()) == querydata:
                return session[f'URLs_{step}']
        except TypeError:
            # This catches a comparison error in the SkyCoords in case of
            # different frames: we will just conside the cooordinates different!
            pass
        job_urls = []
        try:
            self.abort_query(step)
            if self._process_state(session):
                self.abort_process()
            if server == 'local':
                adql = ADQL(dbms='sqlite3', level=LOCAL_ADQL_ORDER, debugfile=None,
                            racol='__ra', deccol='__dec', xcol='__x', ycol='__y', zcol='__z', indxcol='__idx',
                            mode=LOCAL_ADQL_MODE)
                adql_query = f"SELECT {', '.join(fields)}\nFROM main" + \
                        f"\nWHERE {constraints}"
                sql_query = adql.sql(adql_query)
                job_urls = ['local://' + sql_query]
            else:
                service = vo.dal.TAPService(server)
                # Now start the new jobs and saves the URLs in the session
                for catalog in catalogs:
                    if catalog[0] != '"':
                        catalog = '"' + catalog + '"'
                    query = f"SELECT {', '.join(fields)}\nFROM {catalog}" + \
                        f"\nWHERE {constraints}"
                    job = service.submit_job(query, maxrec=MAX_OBJS, 
                                             format=TAP_RETURN_TYPE)
                    job.run()
                    job_urls.append(job.url)
        except Exception:
            return []
        # Save the URLs
        session = getSession()
        session[f'URLs_{step}'] = job_urls
        session[f'querydata_{step}'] = querydata
        return job_urls

    def execute_vizier_query(self, step: int, server: str, catalogs: Sequence[str],
                             fields: Sequence[str], center: SkyCoord, 
                             geometry: dict, constraints: dict):
        session = getSession()
        # Check if the query has changed
        querydata = (server, catalogs, fields, center, geometry, constraints)
        try:
            if session.get(f'querydata_{step}', ()) == querydata:
                return session[f'URLs_{step}']
        except TypeError:
            # This catches a comparison error in the SkyCoords in case of 
            # different frames: we will just conside the cooordinates different!
            pass
        job_urls = []
        try:
            self.abort_query(step)
            if self._process_state(session):
                self.abort_process()
            my_vizier = Vizier(columns=fields, timeout=VIZIER_TIMEOUT)
            my_vizier.ROW_LIMIT = MAX_OBJS
            for catalog in catalogs:
                request = query_region_async(my_vizier, center, get_query_payload=True,
                    catalog=catalog, column_filters=constraints, frame=center.frame.name, 
                    **geometry)
                job_urls.append('vizier://' + request)
        except Exception:
            return []
        # Save the URLs
        session = getSession()
        session[f'URLs_{step}'] = job_urls
        session[f'querydata_{step}'] = querydata
        return job_urls

    def abort_query(self, step: int):
        session = getSession()
        job_urls = session.get(f'URLs_{step}')
        if job_urls:
            proc = pool.apply_async(self.do_abort_queries, (job_urls,))
        session[f'URLs_{step}'] = None
        session[f'querydata_{step}'] = ()
        cache_path = f'processes/process_{session.id}_cache{step}.fits'
        if USE_CACHE and os.path.isfile(cache_path):
            os.unlink(cache_path)

    @classmethod
    def retrieve_data(cls, id: str, step: int, urls: Sequence[str], 
                      logger=logging.info, expected=None):
        def fetcher(job):
            def reader(n, data):
                result = response.raw.read(n)
                if data[1] <= 0:
                    if expected:
                        reclen = np.median([len(m) for m in re.findall(
                            r'<TR>.*?</TR>', str(result), re.MULTILINE)])
                        data[1] = reclen * expected
                    else:
                        data[1] = len(result) * 50
                if data[0] > abs(data[1]):
                    data[0] = data[0] % abs(data[1])
                logger(f'%{data[0] / abs(data[1]) * 100}')
                return result
            
            # This code is taken from 
            # https://pyvo.readthedocs.io/en/latest/_modules/pyvo/dal/tap.html#AsyncTAPJob.fetch_result
            import functools
            from astropy.io.votable import parse as votableparse
            try:
                response = job._session.get(job.result_uri, stream=True)
                response.raise_for_status()
            except requests.RequestException as ex:
                job._update()
                # we propably got a 404 because query error. raise with error msg
                job.raise_if_error()
                raise vo.DALServiceError.from_except(ex, job.url)
            response.raw.read = functools.partial(
                response.raw.read, decode_content=True)
            file_size = int(response.headers.get('Content-Length', 0))
            data = [0, file_size]
            if TAP_RETURN_TYPE == 'votable':
                return vo.dal.TAPResults(votableparse(lambda n: reader(n, data)),
                                         url=job.result_uri, session=job._session).to_table()
            else:
                content = []
                cur_size = 0
                for block in response.iter_content(None):
                    cur_size += len(block)
                    if file_size <= 0:
                        m1 = re.search(r'NAXIS1 *= *([0-9]+)', str(block))
                        m2 = re.search(r'NAXIS2 *= *([0-9]+)', str(block))
                        if m1 and m2:
                            file_size = int(m1.group(1)) * int(m2.group(1))
                        else:
                            file_size = -len(block) * 500
                    if cur_size > abs(file_size):
                        cur_size = cur_size % abs(file_size)
                    logger(f'%{cur_size / abs(file_size) * 100}')
                    content.append(block)
                logger('Parsing the answer')
                response._content = b''.join(content) or b''
                return Table.read(BytesIO(response._content))                    

        cache_path = f'processes/process_{id}_cache{step}.fits'
        if USE_CACHE and os.path.isfile(cache_path):
            logger('Using cached results')
            return Table.read(cache_path)
        results: Optional[Table] = None
        n_fails = 0
        for job_url in urls:
            if job_url[:9] == 'vizier://':
                logger(f'Retrieving data from VizieR')
                try:
                    payload = job_url[9:]
                    response = Vizier._request(
                        method='POST', url=Vizier._server_to_url(return_type=VIZIER_RETURN_TYPE),
                        data=payload, timeout=VIZIER_TIMEOUT, cache=False, stream=True)
                    file_size = int(response.headers.get('Content-Length', 0))
                    content = []
                    cur_size = 0
                    for block in response.iter_content(None):
                        cur_size += len(block)
                        if file_size <= 0:
                            if VIZIER_RETURN_TYPE == 'votable':
                                if expected:
                                    reclen = np.median([len(m) for m in re.findall(
                                        r'<TR>.*?</TR>', str(block), re.MULTILINE)])
                                    file_size = reclen * expected
                                else:
                                    file_size = len(block) * 50                            
                            else:
                                m1 = re.search(r'NAXIS1 *= *([0-9]+)', str(block))
                                m2 = re.search(r'NAXIS2 *= *([0-9]+)', str(block))
                                if m1 and m2:
                                    file_size = int(m1.group(1)) * int(m2.group(1))
                                else:
                                    file_size = -len(block) * 500
                        if cur_size > abs(file_size):
                            cur_size = cur_size % abs(file_size)
                        logger(f'%{cur_size / abs(file_size) * 100}')
                        content.append(block)
                    logger('Parsing the answer')
                    response._content = b''.join(content) or b''
                    if VIZIER_RETURN_TYPE == 'votable':
                        result = Vizier._parse_result(response)
                        if len(result) > 0:
                            result = result[0]
                        else:
                            result = None
                    else:
                        result = Table.read(BytesIO(response._content))
                except Exception:
                    logger('Cannot retrieve the data: giving up')
                    raise
            elif job_url[:8] == 'local://':
                sql_query = job_url[8:]
                dbpath = f"local_cache/db-{id}.db"
                con = sqlite3.connect(dbpath)
                con.row_factory = sqlite3.Row
                cur = con.execute(sql_query)
                table = cur.fetchall()
                con.close()
                # Convert invalid values to NaNs
                rows = ((v if v is not None else np.nan for v in line) for line in table)
                # Convert everything into a table
                result = Table(rows=rows, names=table[0].keys())
            else:
                job = vo.dal.tap.AsyncTAPJob(job_url)
                while True:
                    logger(f'Retrieving data from URL {job_url}')
                    try:
                        job.wait(['COMPLETED', 'ERROR', 'ABORTED'], timeout=TAP_TIMEOUT)
                        
                        # result = job.fetch_result().to_table()
                        result = fetcher(job)
                        if job.phase == 'COMPLETED':
                            break
                        else:
                            logger(f'Unexpected job phase: {job.phase}')
                            raise vo.DALQueryError(f'Unexpected job phase: {job.phase}')
                    except Exception as e:
                        n_fails += 1
                        if n_fails < TAP_MAX_FAILS:
                            if job.phase == 'COMPLETED':
                                logger(f'Error: {e}')
                            else:
                                logger(f'Job still in phase {job.phase}: trying again')
                        else:
                            logger(f'Cannot retrieve the data after {n_fails} tries: giving up')
                            raise
            if result:
                if results:
                    results = np.vstack((results, result))
                else:
                    results = result
        if USE_CACHE and results:
            if 'description' in results.meta:
                # Remove this keyword: too long...
                del results.meta['description']
            results.write(cache_path)
        if results:
            return results
        else:
            logger('Cannot retrieve the data: giving up')
            raise ValueError


if __name__ == '__main__':
    # Check if we have arguments
    import sys
    os.chdir('py')
    # sqlite stuff
    sqlite3.register_adapter(np.int64, int)
    sqlite3.register_adapter(np.uint64, int)
    sqlite3.register_adapter(np.int32, int)
    sqlite3.register_adapter(np.uint64, int)
    sqlite3.register_adapter(np.int16, int)
    sqlite3.register_adapter(np.uint16, int)
    sqlite3.register_adapter(np.int8, int)
    sqlite3.register_adapter(np.uint8, int)
    sqlite3.register_adapter(np.float128, float)
    sqlite3.register_adapter(np.float64, float)
    sqlite3.register_adapter(np.float32, float)
    sqlite3.register_adapter(np.float16, float)
    # sys.argv.append('process_b9d7dbf80665f444334e11ffd0fb027560c7b760.dat')
    if len(sys.argv) > 1:
        # Interpret the 1st argument as a session id
        filename = sys.argv[1]
        with open(filename, 'rb') as f:
            session_id = pickle.load(f)
            data_pr = pickle.load(f)
            process_log = None
            AppServer.do_process(session_id, process_log, data_pr)
    else:
        # Standard server mode...
        # Set the multiprocessing stuff
        mp.set_start_method('spawn')
        manager = mp.Manager()
        pool = mp.Pool(2)
        # CherryPy global configuration
        cherrypy.config.update({'server.socket_host': '127.0.0.1', # '192.168.1.39',
                                'server.socket_port': 8080,
                                'server.max_request_body_size': 524288000
                                })
        # CherryPy configuration
        static_conf = {
            '/': {
                'tools.staticdir.root': os.path.abspath('..'),
                'tools.staticdir.on': True,
                'tools.staticdir.dir': './dist' if DEVEL else './build',
                'tools.staticdir.index': 'index.html',
                'tools.gzip.on': True,
                'tools.gzip.mime_types': ['text/*', 'application/*']
            },
            '/static': {
                'tools.staticdir.on': True,
                'tools.staticdir.dir': STATIC_PATH,
                'tools.staticdir.content_types': {'fits': 'application/octet-stream'},
                'tools.gzip.on': True,
                'tools.gzip.mime_types': ['text/*', 'application/*']
            }
        }
        if DEVEL:
            static_conf['/__parcel_source_root'] = {
                'tools.staticdir.on': True,
                'tools.staticdir.dir': '.'
            }
        app_conf = {
            '/': {
                'tools.sessions.on': True,
                # 'tools.sessions.locking': 'explicit',
                # 'tools.sessions.storage_class': cherrypy.lib.sessions.FileSession,
                'tools.sessions.storage_path': './sessions',
                'tools.sessions.timeout': 480
            }
        }
        cherrypy.tree.mount(StaticServer(), '/', static_conf)
        cherrypy.tree.mount(AppServer(), '/app', app_conf)
        cherrypy.tree.mount(ProxyServer(), '/proxy', {})
        cherrypy.engine.start()
        cherrypy.engine.block()
