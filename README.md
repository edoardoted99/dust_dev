# HOW TO SETUP EVERYTHING

## Yarn and parcel configuration



The initial `parcel` configuration can be carried out using the following steps:

1. `yarn add -D parcel@next`
2. Edit `package.json` by adding the script lines (see below)
3. Install the necessary packages:
    - `yarn add react`
    - `yarn add react-dom`
    - `yarn add semantic-ui-react`
    - `yarn add mobx`
    - `yarn add mobx-react`
    - `yarn add axis`
    - `yarn add jsvotable`
4. Create a `.babelrc` package with the lines reported below
5. Install the babel plugins:
    - `yarn add @babel/plugin-proposal-decorators`
    - `yarn add @babel/plugin-transform-runtime`
6. Edit the `package.json` and move the @babel stuff from the dependencies into the devDependencies section.



### The final `package.json` file
````[json]
{
### The final `package.json` file
  "name": "dust",
  "version": "1.0.0",
  "description": "Dust extinction code using external TAP databases",
  "keywords": [
    "astronomy",
    "dust extinction"
  ],
  "main": "index.js",
  "repository": "https://github.com/astrozot/dust.git",
  "author": "Marco Lombardi <marco.lombardi@gmail.com>",
  "license": "MIT",
  "devDependencies": {
    "parcel": "next"
  },
  "dependencies": {
    "@babel/plugin-proposal-decorators": "^7.10.5",
    "@babel/plugin-transform-runtime": "^7.11.5",
    "axios": "^0.20.0",
    "jsvotable": "^2.0.2",
    "mobx": "^5.15.7",
    "mobx-react": "^6.3.0",
    "react": "^16.13.1",
    "react-dom": "^16.13.1",
    "semantic-ui-react": "^1.3.0"
  },
  "scripts": {
    "start": "parcel serve ./src/index.html --open chrome",
    "build": "parcel build ./src/index.html"
  }
}
````

### The final `.babelrc` file

````[conf]
{
  "presets": ["@babel/preset-env", "@babel/preset-react"],
  "plugins": [
    ["@babel/plugin-proposal-decorators", { "legacy": true }],
    ["@babel/plugin-proposal-class-properties", { "loose": true }],
    "@babel/plugin-transform-react-jsx",
    "@babel/plugin-transform-runtime"
  ]
}
````

## Python configuration

Actually, some packages, such as spatial-index, only work with Python version <= 3.8. Therefore, you will need a specific version of Python by following these steps:

- `conda create -n myenv python=3.8`
- `source activate myenv`


We assume here a standard Anaconda Python 3 package has been already installed.
You then need to perform the following addition steps:


- `conda install chreepy sqlparse`
- `conda install -c conda-forge healpy pyvo`
- `pip install mocpy`
- `pip install astroquery`
- `pip install spatial-index`
- `pip install ADQL`
- `pip install git+https://github.com/astrozot/xnicer.git`


## Start

- `BUNDLE_BUDDY=1 parcel build ./src/index.html --no-scope-hoist`
- `parcel serve ./src/index.html --open chrome`

then, go to localhost.