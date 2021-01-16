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
from astropy.io import fits
from astropy.table import Table, vstack
from astropy.coordinates import SkyCoord
from astroquery.vizier import Vizier
import multiprocessing as mp
import astropy.wcs
from xnicer import XNicer, XDGaussianMixture, guess_wcs, make_maps
from xnicer.catalogs import PhotometricCatalogue, AstrometricCatalogue
from xnicer.kde import KDE


DEVEL = True
USE_CACHE = True
STATIC_PATH = './src/static'
MAX_OBJS = 10**7
MIN_OBJS = 500
TAP_TIMEOUT = 120
TAP_MAX_FAILS = 5
VIZIER_TIMEOUT = 600

def getSession():
    id = cherrypy.session.get('ID')
    if not id:
        cherrypy.session['ID'] = str(uuid.uuid4())
        cherrypy.session['step'] = 0
    return cherrypy.session


class StaticServer:
    pass

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
    def count_stars(self):
        """Count the approximate number of stars for a query.

        Uses the provided boundaries in galactic coordinates and the specified
        dataset. The estimate is performed using a density map in healpy format.
        """
        getSession()
        data = cherrypy.request.json
        d2r = np.pi/180.0
        rho, header = hp.read_map(
            f'../{STATIC_PATH}/hips/{data["dataset"]}.hpx', h=True, verbose=False)
        header = dict(header)
        nside = header['NSIDE']
        if data['shape'] == 'R':
            strip = hp.query_strip(nside,
                                (90.0 - data['lat_max']) * d2r,
                                (90.0 - data['lat_min']) * d2r,
                                inclusive=True)
            colat, lon = hp.pix2ang(nside, strip)  # pylint: disable=unused-variable
            if data['lon_min'] > data['lon_max']:
                mask = (lon < data['lon_max']*d2r) | (lon > data['lon_min']*d2r)
            else:
                mask = (lon < data['lon_max']*d2r) & (lon > data['lon_min']*d2r)
            nstars = np.sum(rho[strip[mask]])
        else:
            vec = hp.ang2vec((90 - data['lat_ctr']) * d2r, data['lon_ctr'] * d2r)
            disk = hp.query_disc(nside, vec, data['radius']*d2r, inclusive=True)
            nstars = np.sum(rho[disk])
        if (nstars < 200):
            star_number = f'~{int(nstars)}'
        elif (nstars < 2000):
            star_number = f'~{(nstars // 10) / 10} hundends'
        elif (nstars < 200000):
            star_number = f'~{(nstars // 100) / 10} thousands'
        else:
            star_number = f'~{(nstars // 100000) / 10} millions'
        if nstars < MAX_OBJS and data['start_query']:
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
        constraint. If the database provides galactic coordinates, the query
        uses a simple procedure; otherwise, the BOX ADQL function is used.

        The query is repeated for all catalogs indicated in the FROM part of the
        query.
        """
        data = cherrypy.request.json
        step = data['step']
        session = getSession()
        coords = data['coords']
        coo_sys = data['coo_sys']
        if coo_sys in coords or data['server'] == 'vizier':
            lon_name = coords[coo_sys][0]
            lat_name = coords[coo_sys][1]
            lon_min = data['lon_min']
            lon_max = data['lon_max']
            lat_min = data['lat_min']
            lat_max = data['lat_max']
            if data['server'] == 'vizier':
                constraints = {}
                if lon_min < lon_max:
                    constraints[lon_name] = f'>={lon_min} & <={lon_max}'
                else:
                    constraints[lon_name] = f'>={lon_min} | <={lon_max}'
                constraints[lat_name] = f'>={lat_min} & <={lat_max}'
            else:
                if lon_min < lon_max:
                    constraints = f'{lon_name}>={lon_min} AND {lon_name}<={lon_max} AND ' \
                        f'{lat_name}>={lat_min} AND {lat_name}<={lat_max}'
                else:
                    constraints = f'({lon_name}>={lon_min} OR {lon_name}<={lon_max}) AND ' \
                        f'{lat_name}>={lat_min} AND {lat_name}<={lat_max}'
        else:
            lon_ctr = data['lon_ctr']
            lon_wdt = data['lon_wdt']
            lat_ctr = data['lat_ctr']
            lat_wdt = data['lat_wdt']
            coo_codes = {'E': 'icrs', 'G': 'galactic'}
            k = 'E' if 'E' in coords else list(coords.keys())[0]
            lon_name = coords[k][0]
            lat_name = coords[k][1]
            constraints = f"1=CONTAINS(POINT('{coo_codes[k]}', {lon_name}, {lat_name}), " + \
                f"BOX('{coo_codes[coo_sys]}', {lon_ctr}, {lat_ctr}, {lon_wdt}, {lat_wdt}))"
        if len(data['conditions']) > 0:
            if data['server'] == 'vizier':
                for field, sign, value in data['conditions']:
                    if field not in constraints:
                        constraints[field] = f'{sign}{value}'
                    else:
                        constraints[field] = f'{constraints[field]} & {sign}{value}'
            else:
                constraints += f" AND {' AND '.join([c[0] + c[1] + c[2] for c in data['conditions']])}"
        job_urls = self.execute_query(step, data['server'], data['catalogs'], 
                                      data['fields'], constraints)
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
        if process_state != 'run':
            try:
                if not process_state:
                    # First run: set the data
                    data = cherrypy.request.json
                    session['data_3'] = data['data']
                    with open(f'process_{session.id}.dat', 'wb') as f:
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
        else:
            res = {'error': True, 'header': 'Pipeline error',
                   'content:': 
                       f'Error: sessioon ID {session.id} has already a running process'}
            logging.exception('Fatal error during process creation: process already started')
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
                percent = process_log[-1]['percent']
            else:
                time = 0.0
                percent = 0
            process_log.append(
                {'time': time,
                 'state': 'abort',
                 'percent': percent,
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
                    os.unlink(f'process_{session.id}.{ext}')
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
            logging.basicConfig(filename=f'process_{id}.log', level=logging.DEBUG)
            interactive_mode = False
        t0 = time.perf_counter()

        def info(percent, message, state='run'):
            logging.info('%s', message)
            if len(process_log) > 0 and process_log[-1]['state'] == 'abort':
                raise KeyboardInterrupt
            if percent < 0:
                if len(process_log) > 0:
                    percent = process_log[-1]['percent']
                else:
                    percent = 0
            return process_log.append(
                {'time': time.perf_counter() - t0,
                 'state': state,
                 'percent': percent,
                 'message': message})
        try:
            # FIXME: Remove next line
            print(data_pr)
            info(1, f'Starting (session id: {id})')
            info(2, f'Retrieving control field data: expecting {data_pr["nstars_cf"]:,.0f} objects')
            cf_data = cls.retrieve_data(id, 2, data_pr['urls_cf'], 
                                        logger=lambda message: info(2, message))
            info(8, f'{len(cf_data):,.0f} objects found')
            info(8, 'Converting photometric data')
            phot_c = PhotometricCatalogue.from_table(
                cf_data, data_pr['mags'], data_pr['magErrs'],
                reddening_law=data_pr['reddeningLaw'],
                class_names=[
                    'obj1', 'obj2'] if data_pr['morphclass'] else None,
                class_prob_names=data_pr['morphclass'],
                log_class_probs=False, dtype=np.float64)
            phot_c.add_log_probs()
            info(10, f'{len(phot_c):,.0f} objects with two or more bands')
            info(10, 'Fitting number counts and uncertainties')
            phot_c.fit_number_counts()
            phot_c.fit_phot_uncertainties()
            # Check wich coordinates to use
            wcs = data_pr['wcs']
            if wcs['coosys'] == 'galactic':
                if 'G' in data_pr['coords']:
                    frame = 'galactic'
                    coords = data_pr['coords']['G']
                else:
                    frame = 'icrs'
                    coords = data_pr['coords']['E']
            else:
                if 'E' in data_pr['coords']:
                    frame = 'icrs'
                    coords = data_pr['coords']['E']
                else:
                    frame = 'galactic'
                    coords = data_pr['coords']['G']
            info(11, f'Using coordinates in the {frame} frame')
            if data_pr['starFraction'] < 100 or data_pr['areaFraction'] < 100:
                info(11, f'Selection of control field objects')
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
                w0 = guess_wcs(getattr(coord_c0, wcs['coosys']), 
                               nobjs=len(ext_c0), target_density=5.0)
                smoother0 = KDE(tuple(reversed(w0.pixel_shape)), max_power=2,
                                bandwidth=2.0)
                hdu0 = make_maps(getattr(coord_c0, wcs['coosys']), ext_c0, w0,
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
                    coord_c0.frame.representation_component_names.keys())
                coord_c1 = coord_c0[phot_c['idx']]
                xy = w0.all_world2pix(
                    getattr(coord_c1, names[0]).deg,
                    getattr(coord_c1, names[1]).deg, 0)
                sel4 = np.where(mask[(np.round(xy[1])).astype(int), (np.round(xy[0])).astype(int)])
                phot_c = phot_c[sel4]
                ext_c0 = ext_c0[sel4]
                info(13, f'Selected {len(phot_c):,.0f} objects from the control field extinction map')
                srt2 = np.argsort(ext_c0['mean_A'])
                sel5 = srt2[0:int(len(phot_c) * data_pr['starFraction'])]
                phot_c = phot_c[sel5]
                info(14, f'Selected {len(phot_c):,.0f} objects from individual extinctions')
            info(15, 'Performing the extreme deconvolution')
            xd = XDGaussianMixture(n_components=data_pr['numComponents'], 
                                   n_classes=2 if data_pr['morphclass'] else 1)
            xnicer = XNicer(xd, np.linspace(0.0, data_pr['maxExtinction'], 
                                            data_pr['extinctionSteps']))
            xnicer.fit(phot_c)
            info(40, 'Performing the control field a-posteriori calibration')
            xnicer.calibrate(phot_c, 
                             np.linspace(
                                -1.0, data_pr['maxExtinction'], 
                                data_pr['extinctionSteps']*data_pr['extinctionSubsteps']),
                             update_errors=False)
            info(65, 'Control field analysis')
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
            info(68, f'Bias = {bias_c:.3f}, MSE = {mse_c:.3f}, Err = {err_c:.3f}')
            info(68, 
                 f'Retrieving science field data: expecting {data_pr["nstars_sf"]:,.0f} objects')
            sf_data = cls.retrieve_data(id, 1, data_pr['urls_sf'],
                                        logger=lambda message: info(68, message))
            info(74, f'{len(sf_data):,.0f} objects found')
            info(74, 'Converting photometric data')
            phot_s = PhotometricCatalogue.from_table(
                sf_data, data_pr['mags'], data_pr['magErrs'],
                reddening_law=data_pr['reddeningLaw'],
                class_names=[
                    'obj1', 'obj2'] if data_pr['morphclass'] else None,
                class_prob_names=data_pr['morphclass'],
                log_class_probs=False, dtype=np.float64)
            info(77, f'{len(phot_s)} objects with two or more bands')
            phot_s.add_log_probs()
            info(77, 'Computing extinctions')
            ext_s = xnicer.predict(phot_s.get_colors())
            coord_s = AstrometricCatalogue.from_table(
                sf_data, coords, unit='deg', frame=frame)
            info(85, 'Map making')
            w = astropy.wcs.WCS(naxis=2)
            w.pixel_shape = (wcs['naxis1'], wcs['naxis2'])
            w.wcs.crpix = [wcs['crpix1'], wcs['crpix2']]
            if wcs['coosys'] == 'galactic':
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
            hdu = make_maps(getattr(coord_s, wcs['coosys']), ext_s, w,
                            smoother, n_iters=data_pr['clipIters'], 
                            tolerance=data_pr['clipping'], use_xnicest=use_xnicest)
            info(95, 'Saving results')
            hdu.writeto(f'process_{id}.fits', overwrite=True, checksum=True)
            info(100, 'Process completed', state='end')
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
        hdu = fits.open(f'process_{id}.fits')
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

    def execute_query(self, step: int, server: str, catalogs: Sequence[str], 
                      fields: Sequence[str], constraints: Union[str, dict]):
        session = getSession()
        # Check if the query has changed
        querydata = (server, catalogs, fields, constraints)
        if session.get(f'querydata_{step}', ()) == querydata:
            return session[f'URLs_{step}']
        job_urls = []
        try:
            self.abort_query(step)
            if self._process_state(session):
                self.abort_process()
            if server == 'vizier':
                my_vizier = Vizier(columns=fields, timeout=VIZIER_TIMEOUT)
                my_vizier.ROW_LIMIT = MAX_OBJS
                for catalog in catalogs:
                    request = my_vizier.query_constraints_async(catalog=catalog, **constraints)
                    job_urls.append(request)
            else:
                service = vo.dal.TAPService(server)
                # Now start the new jobs and saves the URLs in the session
                for catalog in catalogs:
                    query = f"SELECT {', '.join(fields)}\nFROM {catalog}" + \
                        f"\nWHERE {constraints}"
                    job = service.submit_job(query, maxrec=MAX_OBJS)
                    job.run()
                    job_urls.append(job.url)
        except Exception:
            return []
        # Save the URLs
        session = getSession()
        session[f'URLs_{step}'] = job_urls
        session[f'querydata_{step}'] = (server, catalogs, fields, constraints)
        return job_urls

    def abort_query(self, step: int):
        session = getSession()
        job_urls = session.get(f'URLs_{step}')
        if job_urls:
            proc = pool.apply_async(self.do_abort_queries, (job_urls,))
        session[f'URLs_{step}'] = None
        session[f'querydata_{step}'] = ()
        cache_path = f'process_{session.id}_cache{step}.fits'
        if USE_CACHE and os.path.isfile(cache_path):
            os.unlink(cache_path)

    @classmethod
    def retrieve_data(cls, id: str, step: int, urls: Sequence[str], logger=logging.info):
        cache_path = f'process_{id}_cache{step}.fits'
        if USE_CACHE and os.path.isfile(cache_path):
            logger('Using cached results')
            return Table.read(cache_path)
        results: Optional[Table] = None
        n_fails = 0
        for job_url in urls:
            if not isinstance(job_url, str):
                logger(f'Retrieving data from VizieR')
                try:
                    result = Vizier._parse_result(job_url)[0]
                except Exception:
                    logger('Cannot retrieve the data: giving up')
                    raise
            else:
                job = vo.dal.tap.AsyncTAPJob(job_url)
                while True:
                    logger(f'Retrieving data from URL {job_url}')
                    try:
                        job.wait(['COMPLETED', 'ERROR', 'ABORTED'], timeout=TAP_TIMEOUT)
                        result = job.fetch_result().to_table()
                        if job.phase == 'COMPLETED':
                            break
                        else:
                            logger(f'Unexpected job phase: {job.phase}')
                            raise vo.DALQueryError(f'Unexpected job phase: {job.phase}')
                    except:
                        n_fails += 1
                        if n_fails < TAP_MAX_FAILS:
                            logger(f'Job still in phase {job.phase}: trying again')
                        else:
                            logger(f'Cannot retrieve the data after {n_fails} tries: giving up')
                            raise
            if results:
                results = np.vstack(results, result)
            else:
                results = result
        if USE_CACHE and results:
            results.write(cache_path)
        return results

if __name__ == '__main__':
    # Check if we have arguments
    import sys
    os.chdir('py')
    # sys.argv.append('process_b9d7dbf80665f444334e11ffd0fb027560c7b760.dat')
    if len(sys.argv) > 1:
        # Interpret the 1st argument as a process id
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
        # CherryPy configuration
        static_conf = {
            '/': {
                'tools.staticdir.root': os.path.abspath('..'),
                'tools.staticdir.on': True,
                'tools.staticdir.dir': './dist' if DEVEL else './build',
                'tools.staticdir.index': 'index.html'
            },
            '/static': {
                'tools.staticdir.on': True,
                'tools.staticdir.dir': STATIC_PATH
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
        cherrypy.engine.start()
        cherrypy.engine.block()
