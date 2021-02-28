#!/usr/bin/env ./python
# pylint: disable=invalid-name
from __future__ import print_function
import cgi
import cgitb
import json
import numpy as np
import healpy as hp
import pyvo as vo

MAXREC = 10**7

def count_stars(cgi_form):
    """Count the approximate number of stars for a query.

    Uses the provided boundaries in galactic coordinates and the specified
    dataset. The estimate is performed using a density map in healpy format.
    """
    kw = {}
    for k in ['glon_min', 'glon_max', 'glat_min', 'glat_max', 'dataset']:
        v = cgi_form.getvalue(k)
        if v is not None:
            if k != 'dataset':
                kw[k] = float(v)
            else:
                kw[k] = v
        else:
            raise ValueError(f"Value for {k} is None")
    d2r = np.pi/180.0
    rho, header = hp.read_map(f'../hips/{kw["dataset"]}.hpx', h=True, verbose=False)
    header = dict(header)
    nside = header['NSIDE']
    strip = hp.query_strip(nside,
                           (90.0 - kw['glat_max'])*d2r, (90.0 - kw['glat_min'])*d2r,
                           inclusive=True)
    colat, lon = hp.pix2ang(nside, strip)  # pylint: disable=unused-variable
    if kw['glon_min'] > kw['glon_max']:
        mask = (lon < kw['glon_max']*d2r) | (lon > kw['glon_min']*d2r)
    else:
        mask = (lon < kw['glon_max']*d2r) & (lon > kw['glon_min']*d2r)
    return np.sum(rho[strip[mask]])

def start_tap_query(cgi_form):
    """Initiate a TAP query.

    The query is based on the provided query string, with added geometric
    constraint. If the database provides galactic coordinates, the query
    uses a simple procedure; otherwise, the BOX ADQL function is used.

    The query is repeated for all catalogs indicated in the FROM part of the
    query.
    """
    service_url = cgi_form.getvalue('service_url')
    query = cgi_form.getvalue('sql_query')
    coord1 = cgi_form.getvalue('coord1')
    coord2 = cgi_form.getvalue('coord2')
    glon_min = float(cgi_form.getvalue('glon_min'))
    glon_max = float(cgi_form.getvalue('glon_max'))
    glat_min = float(cgi_form.getvalue('glat_min'))
    glat_max = float(cgi_form.getvalue('glat_max'))
    use_galactic = int(cgi_form.getvalue('use_galactic'))
    if use_galactic:
        if glon_min < glon_max:
            constraints = f'{coord1}>={glon_min} AND {coord1}<={glon_max} AND ' \
            f'{coord2}>={glat_min} AND {coord2}<={glat_max}'
        else:
            constraints = f'({coord1}>={glon_min} OR {coord1}<={glon_max}) AND ' \
                f'{coord2}>={glat_min} AND {coord2}<={glat_max}'
    else:
        glon_ctr = (glon_max + glon_min) / 2
        glon_wdt = glon_max - glon_min
        if glon_wdt < 0:
            glon_ctr += 180
            glon_wdt += 180
        glon_ctr = glon_ctr % 360
        glat_ctr = (glat_max + glat_min) / 2
        glat_wdt = glat_max - glat_min
        constraints = f"CONTAINS(POINT('icrs', {coord1}, {coord2}), " + \
        f"BOX('galactic', {glon_ctr}, {glat_ctr}, {glon_wdt}, {glat_wdt}))=1"
    query_lines = query.split('\n')
    catalogs = query_lines[1][5:].split(', ')
    if len(query_lines) == 2:
        query_lines.append(f'WHERE {constraints}')
    else:
        query_lines[2] += f' AND {constraints}'
    service = vo.dal.TAPService(service_url)
    job_urls = []
    for catalog in catalogs:
        query_lines[1] = f'FROM "{catalog}"'
        job = service.submit_job('\n'.join(query_lines), maxrec=MAXREC)
        job.run()
        job_urls.append(job.url)
    return job_urls


cgitb.enable()

# Create instance of FieldStorage
form = cgi.FieldStorage()

nstars = count_stars(form)
if nstars < MAXREC:
    urls = start_tap_query(form)
else:
    urls = None

print("Content-type: application/json")
print()
print(json.JSONEncoder().encode({'nstars': nstars, 'job_urls': urls}))
