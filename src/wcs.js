// @ts-check
'use strict';

function splice(str1, index, remove, str2) {
  return (str1.slice(0, index) + str2 + str1.slice(index + Math.abs(remove)));
}

export class WCS {
  init(header) {
    // @ts-ignore
    const JS9 = window.JS9;
    let line = '';
    if (typeof header === "object") {
      let cards = []
      for (let card in header) {
        let value = header[card];
        if (value === undefined || value === null)
          continue;
        if (typeof value === "string" && value !== 'T' && value !== 'F')
          value = "'" + value + "'";
        let entry = card.padEnd(8, ' ') + '= ' + value
        cards.push(entry);
      }
      cards.push('END');
      header = cards.join('\n');
    }
    // Split the string to an array; pad each element with spaces; and join again
    this.header = header = header.match(/.{1,80}/g).map(s => s.padEnd(80, ' ')).join('');
    // JS9 stuff: this uses internal routines
    let l = header.length, pheader = JS9.vmalloc(l + 1), maxlen = 256000, pwcs;
    JS9.vstrcpy(header, pheader);
    this.wcs = JS9.initwcs(pheader, maxlen);
    JS9.vfree(pheader);
  }

  free() {
    // @ts-ignore
    const JS9 = window.JS9;
    JS9.freewcs(this.wcs);
    this.wcs = 0;
  }

  sky2pix(lon, lat) {
    // @ts-ignore
    const JS9 = window.JS9;
    let pix = JS9.wcs2pix(this.wcs, lon, lat).trim().split(/ +/);
    return [parseFloat(pix[0]), parseFloat(pix[1])];
  }

  pix2sky(x, y) {
    // @ts-ignore
    const JS9 = window.JS9;
    let sky = JS9.pix2wcs(this.wcs, x, y).trim().split(/ +/);
    return [parseFloat(sky[0]), parseFloat(sky[1])];
  }
}
