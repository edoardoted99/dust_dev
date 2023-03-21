# HOW TO SETUP EVERYTHING

## Yarn and parcel configuration

- `yarn install`

## Python configuration

Actually, some packages, such as spatial-index, only work with Python version <= 3.8. Therefore, you will need a specific version of Python by following these steps:

- `conda create -n myenv python=3.8`
- `conda activate myenv`

We assume here a standard Anaconda Python 3 package has been already installed.
You then need to perform the following addition steps:


- `conda install sqlparse`
- `conda install -c conda-forge healpy pyvo`
- `pip install -r requirements.txt`
- `pip install https://github.com/edoardoted99/xnicer_dev.git`


## build

- `yarn run build`

## Start python server

- `python3 py/main.py`

then, go to localhost on 8080 port.