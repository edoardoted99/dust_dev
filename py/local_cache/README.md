# Do not delete

The directory where this file is located will be used to store local
files, that is, tables uploaded from the user.

The directory will contain the following files:

- `data-ID.dat`: The original file uploaded by the user. Can be in any
  format understood automatically by `astropy.table.Table`: FITS, HDF5, 
  or VO tables.

- `db-ID.db`: The sqlite3 database storing the uploaded file. The table
  is completed with columns useful for geometric constraints.

- `densityMap-ID.hpx`: The healpix density map associated to the uploaded
  file.

Additionally, the pipeline also create a MOC file associated to the data:
this file is put under `static/mocs/session-ID.fits`.
