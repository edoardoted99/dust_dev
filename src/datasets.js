// @ts-check

// @ts-ignore
import logoVizier from 'url:./logos/VizieR.png';
// @ts-ignore
import logoIRSA from 'url:./logos/IRSA.png';
// @ts-ignore
import logo2MASS from 'url:./logos/2MASS.png';
// @ts-ignore
import logoWISE from 'url:./logos/WISE.png';
// @ts-ignore
import logoEmpty from 'url:./logos/empty.png';

// Footprints from http://alasky.u-strasbg.fr/footprints/tables/vizier/

/**
 * @constant
 * @exports
 * @type {object}
 */
export const serversDict = {
  VizieRTAP: {
    description: 'VizieR (TAP)',
    server: 'http://TAPVizieR.u-strasbg.fr/TAPVizieR/tap',
    image: logoVizier
  },
  VizieR: {
    description: 'VizieR',
    server: 'vizier',
    image: logoVizier
  },
  IRSA: {
    description: 'IRSA',
    server: 'https://cors-anywhere.herokuapp.com/https://irsa.ipac.caltech.edu/TAP',
    image: logoIRSA
  },
  ESO: {
    description: 'ESO',
    server: 'https://cors-anywhere.herokuapp.com/https://archive.eso.org/tap_cat',
    image: null
  },
  ESA: {
    description: 'ESA',
    server: 'http://sky.esa.int/esasky-tap/tap',
    image: null
  }

};

export const datasetsDict = {
  '2MASS-PSC': {
    description: '2MASS Point Source Catalog',
    image: logo2MASS,
    servers: ['VizieR', 'VizieRTAP', 'IRSA'],
    catalogs: {
      VizieR: 'II/246/out',
      VizieRTAP: 'II/246/out',
      IRSA: 'fp_psc'
    },
    coords: {
      VizieR: [
        ['E', 'RAJ2000', 'DEJ2000'],
        ['G', 'GLON', 'GLAT']
      ],
      VizieRTAP: [
        ['E', 'RAJ2000', 'DEJ2000'],
        ['G', 'GLON', 'GLAT']
      ],
      IRSA: [
        ['E', 'ra', 'dec'],
        ['G', 'glon', 'glat']
      ]
    },
    bands: {
      VizieR: [
        ['J', 'Jmag', 'e_Jmag', 2.55],
        ['H', 'Hmag', 'e_Hmag', 1.55],
        ['Ks', 'Kmag', 'e_Kmag', 1.00]
      ],
      VizieRTAP: [
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
      VizieR: [['Cflg', '==', "000"], ['Xflg', '=', '0'], ['Aflg', '=', '0']],
      VizieRTAP: [['Cflg', '=', "'000'"], ['Xflg', '=', '0'], ['Aflg', '=', '0']],
      IRSA: [['cc_flg', '=', "'000'"], ['gal_contam', '=', '0'], ['mp_flg', '=', '0']]
    }
  },
  'AllWISE': {
    description: 'AllWISE',
    image: logoWISE,
    servers: ['VizieR', 'VizieRTAP', 'IRSA'],
    catalogs: {
      'VizieR': 'II/328/allwise',
      'VizieRTAP': 'II/328/allwise',
      'IRSA': 'allwise_p3as_psd'
    },
    coords: {
      'VizieR': [['E', 'RAJ2000', 'DEJ2000']],
      'VizieRTAP': [['E', 'RAJ2000', 'DEJ2000']],
      'IRSA': [['E', 'ra', 'dec']]
    },
    bands: {
      'VizieR': [
        ['J', 'Jmag', 'e_Jmag', 2.55],
        ['H', 'Hmag', 'e_Hmag', 1.55],
        ['K', 'Kmag', 'e_Kmag', 1.00],
        ['W1', 'W1mag', 'e_W1mag', 0.80],
        ['W2', 'W2mag', 'e_W2mag', 0.60],
        ['W3', 'W3mag', 'e_W3mag', 0.50],
        ['W4', 'W4mag', 'e_W4mag', 0.40]
      ],
      'VizieRTAP': [
        ['J', 'Jmag', 'e_Jmag', 2.55],
        ['H', 'Hmag', 'e_Hmag', 1.55],
        ['K', 'Kmag', 'e_Kmag', 1.00],
        ['W1', 'W1mag', 'e_W1mag', 0.80],
        ['W2', 'W2mag', 'e_W2mag', 0.60],
        ['W3', 'W3mag', 'e_W3mag', 0.50],
        ['W4', 'W4mag', 'e_W4mag', 0.40]
      ],
      'IRSA': [
        ['J', 'j_m_2mass', 'j_msig_2mass', 2.55],
        ['H', 'h_m_2mass', 'h_msig_2mass', 1.55],
        ['K', 'k_m_2mass', 'k_msig_2mass', 1.00],
        ['W1', 'w1mpro', 'w1sigmpro', 0.80],
        ['W2', 'w2mpro', 'w2sigmpro', 0.60],
        ['W3', 'w3mpro', 'w3sigmpro', 0.50],
        ['W4', 'w4mpro', 'w4sigmpro', 0.40]
      ]
    },
    classes: [],
    extra: [],
    extra_robust: []
  },
  'VISION': {
    description: 'VISION',
    image: logoEmpty,
    servers: ['VizieR'],
    mocs: ['http://alasky.u-strasbg.fr/footprints/tables/vizier/J_A+A_587_A153_science/MOC',
      'http://alasky.u-strasbg.fr/footprints/tables/vizier/J_A+A_587_A153_control/MOC'],
    catalogs: ['J/A+A/587/A153/science', 'J/A+A/587/A153/control'],
    coords: [['E', 'RAJ2000', 'DEJ2000']],
    bands: [
      ['J', 'Jmag', 'e_Jmag', 2.55],
      ['H', 'Hmag', 'e_Hmag', 1.55],
      ['Ks', 'Ksmag', 'e_Ksmag', 1.00]
    ],
    classes: [
      ['ClassSex', 'ClassSex', 'star', 'galaxy'],
      ['ClassCog', 'ClassCog', 'galaxy', 'star']
    ],
    extra: [],
    extra_robust: []
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
    'I': 0.6,
    'Z': 0.5,
    'Y': 0.4,
    'J': 0.3,
    'H': 0.2,
    'K': 0.1,
    'KS': 0.1,
    'W1': 0.04,
    '3-4UM': 0.04,
    'W2': 0.03,
    '4-8UM': 0.03,
    'W3': 0.02,
    'W4': 0.01
  }
}