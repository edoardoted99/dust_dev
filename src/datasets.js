// @ts-check

// @ts-ignore
import logoVizier from 'url:./logos/VizieR.png';
// @ts-ignore
import logoIRSA from 'url:./logos/IRSA.png';
// @ts-ignore
import logo2MASS from 'url:./logos/2MASS.png';
// @ts-ignore
import logoEmpty from 'url:./logos/empty.png';

export const serversDict = {
  VizieR: {
    description: 'VizieR',
    TAP: 'http://TAPVizieR.u-strasbg.fr/TAPVizieR/tap/',
    image: logoVizier
  },
  IRSA: {
    description: 'IRSA',
    TAP: 'https://irsa.ipac.caltech.edu/TAP',
    image: logoIRSA
  }
};

export const datasetsDict = {
  '2MASS-PSC': {
    description: '2MASS Point Source Catalog',
    image: logo2MASS,
    servers: ['VizieR', 'IRSA'],
    catalogs: {
      VizieR: 'II/246',
      IRSA: 'fp_psc'
    },
    coords: {
      VizieR: ['RAJ2000', 'DEJ2000'],
      IRSA: ['ra', 'dec']
    },
    gal_coords: {
      VizieR: ['GLON', 'GLAT'],
      IRSA: ['glon', 'glat']
    },
    bands: {
      VizieR: [
        ['J', 'Jmag', 'e_Jmag', 2.55],
        ['H', 'Hmag', 'e_Hmag', 1.55],
        ['Ks', 'Kmag', 'e_Kmag', 1.00]
      ],
      IRSA: [
        ['J', 'j_m', 'j_msigcom', 2.55],
        ['H', 'h_m', 'j_msigcom', 1.55],
        ['Ks', 'k_m', 'k_msigcom', 1.00]
      ]
    },
    classes: [],
    extra: [],
    extra_robust: {
      VizieR: [['Cflg', '=', "'000'"], ['Xflg', '=', '0'], ['Aflg', '=', '0']],
      IRSA: [['cc_flg', '=', "'000'"], ['gal_contam', '=', '0'], ['mp_flg', '=', '0']]
    }
  },
  'VISION': {
    description: 'VISION',
    image: logoEmpty,
    servers: ['VizieR'],
    mask: 'VISION',
    catalogs: ['"J/A+A/587/A153/science"', '"J/A+A/587/A153/control"'],
    coords: ['RAJ2000', 'DEJ2000'],
    bands: [
      ['J', 'Jmag', 'e_Jmag', 2.55],
      ['H', 'Hmag', 'e_Hmag', 1.55],
      ['Ks', 'Kmag', 'e_Kmag', 1.00]
    ],
    classes: [
      ['ClassSex', 'ClassSex', 'star', 'galaxy'],
      ['ClassCog', 'ClassCog', 'galaxy', 'star']
    ],
    extra: [],
    extra_robust: [['qflag', '=', '0']]
  }
};

export const colorDict = {
  colorNames: ['red', 'orange', 'yellow', 'olive', 'green', 'teal', 'blue', 'violet'],
  bands: {
    'U': 7,
    'B': 6,
    'V': 5,
    'G': 4,
    'R': 1,
    'I': 0,
    'Z': 0,
    'Y': 0,
    'J': 0,
    'H': 0,
    'K': 0,
    'KS': 0,
    'L': 0,
    'M': 0,
    'N': 0,
    'Q': 0
  }
}