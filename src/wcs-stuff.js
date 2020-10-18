// WCS procedures
export const projectionTypes = [
  { value: 'AZP', text: 'AZP: zenithal/azimuthal perspective' },
  { value: 'SZP', text: 'SZP: slant zenithal perspective' },
  { value: 'TAN', text: 'TAN: gnomonic' },
  { value: 'STG', text: 'STG: stereographic' },
  { value: 'SIN', text: 'SIN: orthographic/synthesis' },
  { value: 'ARC', text: 'ARC: zenithal/azimuthal equidistant' },
  { value: 'ZPN', text: 'ZPN: zenithal/azimuthal polynomial' },
  { value: 'ZEA', text: 'ZEA: zenithal/azimuthal equal area' },
  { value: 'AIR', text: 'AIR: Airy’s projection' },
  { value: 'CYP', text: 'CYP: cylindrical perspective' },
  { value: 'CEA', text: 'CEA: cylindrical equal area' },
  { value: 'CAR', text: 'CAR: plate carrée' },
  { value: 'MER', text: 'MER: Mercator\'s projection' },
  { value: 'COP', text: 'COP: conic perspective' },
  { value: 'COE', text: 'COE: conic equal area' },
  { value: 'COD', text: 'COD: conic equidistant' },
  { value: 'COO', text: 'COO: conic orthomorphic' },
  { value: 'SFL', text: 'SFL: Sanson-Flamsteed ("global sinusoid")' },
  { value: 'PAR', text: 'PAR: parabolic' },
  { value: 'MOL', text: 'MOL: Mollweide\'s projection' },
  { value: 'AIT', text: 'AIT: Hammer-Aitoff' },
  { value: 'BON', text: 'BON: Bonne\'s projection' },
  { value: 'PCO', text: 'PCO: polyconic' },
  { value: 'TSC', text: 'TSC: tangential spherical cube' },
  { value: 'CSC', text: 'CSC: COBE quadrilateralized spherical cube' },
  { value: 'QSC', text: 'QSC: quadrilateralized spherical cube' },
  { value: 'HPX', text: 'HPX: HEALPix' },
  { value: 'HPH', text: 'XPH: HEALPix polar, aka "butterfly"' }];

@observable naxis1 = 0;
@observable naxis2 = 0;
@observable coosys = 'GAL';
@observable projection = 'TAN';
@observable crpix1 = 0;
@observable crpix2 = 0;
@observable crval1 = 0;
@observable crval2 = 0;
@observable scale = 1;
@observable rot = 0;
@observable lonpole = 0;
@observable latpole = 0;
@observable pv2 = [0, 0, 0, 0];

export function makeHeader(state) {
  const { naxis1, naxis2, coosys, projection, crpix1, crpix2, crval1, crval2, scale, pv2 } = state;
  const types = coosys === 'GAL' ? ['GLON', 'GLAT'] : ['RA--', 'DEC-'];
  let header;
  header = {
    'SIMPLE': 'T',
    'BITPIX': -32,
    'NAXIS': 2,
    'NAXIS1': parseInt(naxis1),
    'NAXIS2': parseInt(naxis2),
    'CTYPE1': types[0] + '-' + projection,
    'CRPIX1': parseInt(crpix1),
    'CDELT1': -parseFloat(scale) / 60.0,
    'CRVAL1': parseFloat(crval1),
    'CTYPE2': types[1] + '-' + projection,
    'CRPIX2': parseInt(crpix2),
    'CDELT2': -parseFloat(scale) / 60.0,
    'CRVAL2': parseFloat(crval2),
    'EQUINOX': 2000.0
  };
  for (let name of ['lonpole', 'latpole', 'crota2'])
    if (state[name] === 0 || state[name]) header[name] = parseFloat(state[name]);
  for (let n = 0; n < 4; n++) 
    if (pv2[n] === 0 || pv2[n]) header['PV2_' + n] = parseFloat(pv2[n]);
  return header
}

export function showWCS(noshow, header) {
  if (noshow !== true && inicest_frozen) return;

  var data = loadStorage("inicest.step1");
  if (!data) return false;

  var glon_min = parseFloat(data.glon_min), glon_max = parseFloat(data.glon_max),
    glat_min = parseFloat(data.glat_min), glat_max = parseFloat(data.glat_max);
  var w, n, scale;

  if (!header) header = makeHeader();
  scale = header["CDELT2"] * 60.0;

  w = new wcs();
  w.init(header);
  var canvas, ctx, canvasWidth, canvasHeight;
  if (noshow !== true) {
    // OK, now work with the canvas!
    canvas = document.getElementById("myCanvas");
    ctx = canvas.getContext("2d");
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    /* @@@ This should work for retina displays, but is not doing its job!
     if (0 && window.devicePixelRatio > 1) {
     canvas.width = canvasWidth * window.devicePixelRatio;
     canvas.height = canvasHeight * window.devicePixelRatio;
     canvas.style.width = canvasWidth + "px";
     canvas.style.height = canvasHeight + "px";
     ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
     }
     */
    scale = Math.max(header.NAXIS1 / canvasWidth / 0.8, header.NAXIS2 / canvasHeight / 0.8);
  } else {
    canvasWidth = 0.0;
    canvasHeight = 0.0;
    scale = 1.0;
  }

  var npts = 10, m;
  var xs = new Array(4 * npts), ys = new Array(4 * npts), xy;
  if (glon_max < glon_min) {
    if (header.CRVAL1 < 180.0) glon_min -= 360;
    else glon_max += 360;
  }
  for (n = 0; n < npts; n++) {
    xs[n] = glon_min + (glon_max - glon_min) / npts * n;
    ys[n] = glat_min;
  }
  for (n = 0; n < npts; n++) {
    xs[n + npts] = glon_max;
    ys[n + npts] = glat_min + (glat_max - glat_min) / npts * n;
  }
  for (n = 0; n < npts; n++) {
    xs[n + 2 * npts] = glon_max - (glon_max - glon_min) / npts * n;
    ys[n + 2 * npts] = glat_max;
  }
  for (n = 0; n < npts; n++) {
    xs[n + 3 * npts] = glon_min;
    ys[n + 3 * npts] = glat_max - (glat_max - glat_min) / npts * n;
  }
  if (header["CTYPE1"][0] !== "G") {
    for (n = 0; n < 4 * npts; n++) {
      xy = galactic2equatorial([xs[n], ys[n]]);
      xs[n] = xy[0];
      ys[n] = xy[1];
    }
  }
  for (n = 0; n < 4 * npts; n++) {
    xy = w.sky2pix(xs[n], ys[n]);
    xs[n] = xy[0] / scale + canvasWidth * 0.1;
    ys[n] = header.NAXIS2 / scale + canvasHeight * 0.1 - xy[1] / scale;
  }

  if (noshow === true) return [xs, ys];
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.beginPath();
  ctx.moveTo(xs[0], ys[0]);
  for (n = 1; n < 4 * npts; n++) {
    ctx.lineTo(xs[n], ys[n]);
  }
  ctx.closePath();
  ctx.fill();
  // Make the lines for the coordinates
  ctx.strokeStyle = "#00FF00";
  for (m = 0; m < 5; m++) {
    for (n = 0; n <= npts; n++) {
      xs[n] = glon_min + (glon_max - glon_min) / npts * n;
      ys[n] = glat_min + (glat_max - glat_min) / 4 * m;
    }
    for (n = 0; n <= npts; n++) {
      xs[n + npts + 1] = glon_min + (glon_max - glon_min) / 4 * m;
      ys[n + npts + 1] = glat_min + (glat_max - glat_min) / npts * n;
    }
    if (header["CTYPE1"][0] !== "G") {
      for (n = 0; n < 2 * npts + 2; n++) {
        xy = galactic2equatorial([xs[n], ys[n]]);
        xs[n] = xy[0];
        ys[n] = xy[1];
      }
    }
    for (n = 0; n < 2 * npts + 2; n++) {
      xy = w.sky2pix(xs[n], ys[n]);
      xs[n] = xy[0] / scale + canvasWidth * 0.1;
      ys[n] = header.NAXIS2 / scale + canvasHeight * 0.1 - xy[1] / scale;
    }
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (n = 1; n < npts + 1; n++) {
      ctx.lineTo(xs[n], ys[n]);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xs[npts + 1], ys[npts + 1]);
    for (n = npts + 2; n < 2 * npts + 2; n++) {
      ctx.lineTo(xs[n], ys[n]);
    }
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(225,225,225,0.5)';
  var mx = header.NAXIS1 / scale, my = header.NAXIS2 / scale;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight * 0.1);
  ctx.fillRect(0, my + canvasHeight * 0.1, canvasWidth, canvasHeight * 0.1);
  ctx.fillRect(0, canvasHeight * 0.1, canvasWidth * 0.1, my);
  ctx.fillRect(mx + canvasWidth * 0.1, canvasHeight * 0.1, canvasWidth * 0.1, my);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillRect(0, my + canvasHeight * 0.2, canvasWidth, canvasHeight);
  ctx.fillRect(mx + canvasWidth * 0.2, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.strokeStyle = "#FF0000";
  ctx.strokeRect(canvasWidth * 0.1, canvasHeight * 0.1, header.NAXIS1 / scale, header.NAXIS2 / scale);
}



function checkPVs() {
  var proj = $('input[name="type2"]').val(), pvs, n, $input, $unit, i;
  // Defaults values for projections parameters PVn, starting from n=1
  // The numbers are: 0=0, 1=1, 2=?, 3=0°, 4=90°, 5=?°
  var pars = {
    AZP: [0, 3], SZP: [0, 3, 4], SIN: [0, 0], ZPN: [1, 0, 0],
    AIR: [4], CYP: [1, 1], CEA: [1], COP: [5, 3],
    COE: [5, 3], COD: [5, 3], COO: [5, 3], BON: [5]
  };
  var latpoles = {
    AZP: 4, SZP: 4, TAN: 4, STG: 4, SIN: 4, ARC: 4,
    ZPN: 4, ZEA: 4, AIR: 4, COP: 5, COE: 5, COD: 5, COO: 5
  };
  var crval2 = $('input[name="crval2"]').val();
  if (proj in pars) pvs = pars[proj]; else pvs = [];
  for (n = 0; n < 3; n++) {
    $input = $('input[name="pv2_' + (n + 1) + '"]');
    $unit = $input.siblings('div');
    for (i = 0; i < 2; i++) {
      if (n >= pvs.length) {
        // Cannot keep the value, it is not used!
        $input.val('').prop("disabled", true);
        $unit.text('').blur();
        $unit.addClass("disabled");
      } else {
        var value, unit, pv = pvs[n];
        if (pv === 0 || pv === 3) value = "0";
        else if (pv === 1) value = "1";
        else if (pv === 4) value = "90";
        else if (pv === 5) value = crval2;
        else value = "";
        if (pv < 3) unit = ""; else unit = "°";
        if (["", "0", "90", crval2].indexOf($input.val()) >= 0) {
          // Almost certainly the original value was a default one, replace it!
          $input.val(value).blur();
        }
        $input.siblings('div').text(unit).blur();
        $input.prop("disabled", false).siblings("div").removeClass("disabled");
      }
    }
  }
  for (i = 0; i < 2; i++) {
    $input = $('input[name="pv2_0"]');
    $unit = $input.siblings('div');
    if (proj === "ZPN") {
      if ($input.val() === "") $input.val("0").blur().prop("disabled", false);
      $unit.removeClass("disabled");
    } else {
      $input.val("").blur().prop("disabled", true);
      $unit.addClass("disabled");
    }
    $input = $('input[name="latpole"]');
    if ($input.val() === "") {
      if (proj in latpoles) {
        if (latpoles[proj] === "4") $input.val("90").blur();
        else $input.val("").blur();
      } else $input.val("0").blur();
    }
  }
}


function Transform(p, rot) {
  var d2r = Math.PI / 180, r2d = 180 / Math.PI;
  p[0] *= d2r;
  p[1] *= d2r;
  var cp1 = Math.cos(p[1]);
  var m = [Math.cos(p[0]) * cp1, Math.sin(p[0]) * cp1, Math.sin(p[1])];
  var s = [m[0] * rot[0] + m[1] * rot[1] + m[2] * rot[2], m[0] * rot[3] + m[1] * rot[4] + m[2] * rot[5], m[0] * rot[6] + m[1] * rot[7] + m[2] * rot[8]];
  var r = Math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]);
  var b = Math.asin(s[2] / r); // Declination in range -90 -> +90
  var cb = Math.cos(b);
  var a = Math.atan2(((s[1] / r) / cb), ((s[0] / r) / cb));
  if (a < 0) a += Math.PI * 2;
  return [a * r2d, b * r2d];
}

// From SLALIB sla_GALEQ
function galactic2equatorial(lb) {
  return Transform(lb, [-0.054875539726, 0.494109453312, -0.867666135858, -0.873437108010,
  -0.444829589425, -0.198076386122, -0.483834985808, 0.746982251810, 0.455983795705]);
}

// From SLALIB sla_EQGAL
function equatorial2galactic(radec) {
  return Transform(radec, [-0.054875539726, -0.873437108010, -0.483834985808, 0.494109453312,
  -0.444829589425, 0.746982251810, -0.867666135858, -0.198076386122, 0.455983795705]);
}


