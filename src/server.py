import bz2
import pandas as pd
import numpy as np
import os
import random
import sqlite3
import functools
import logging
from flask import Flask, send_from_directory, request, redirect


app = Flask(__name__, static_url_path='/')


@app.route('/')
def homepage():
    return send_from_directory('.', 'index.html')


@app.route('/project')
def projects():
    return ','.join(f.split('.')[0] for f in os.listdir('projects'))


@app.route('/dataset', methods=['POST'])
def dataset():
    """
    Load a dataset into the DB.
    The dataset is provided in the body of the POST request and must be a bzip2ed CSV of movements from one place to another and an uncompressed CSV of the vertices' locations.
    The columns must be, in order,
        to,from,A1,A2,A3,...
    where A1, A2, A3, ... are columns describing some attribute of the movement and whose name can change.
    That said, the first two must be named `to` and `from` (case-sensitive).

    The user must also provide a project name under which the new file will be saved (e.g. 'flights').
    """

    # first, load the data into pd.DataFrames so that we can store it in a DB
    movements = pd.read_csv(bz2.open(request.files['movements']))
    vertices = pd.read_csv(request.files['vertices'])
    project = request.values['project']

    with sqlite3.connect('projects/%s.db'%project) as con:
        movements.to_sql('movements', con)
        vertices.to_sql('vertices', con)

    return redirect('/visualise.html?project=%s'%project, 200)


@app.route('/project/columns')
def columns():
    """
    The user may want to filter movements by certain columns (e.g. only select flights whose airline is 'United').
    We want to show the user all the columns that are available so that they can add filters on those columns.
    This endpoint just lists the columns in the project's movements file.
    """
    project = request.args.get('project')

    with sqlite3.connect('projects/%s.db'%project) as connection:
        cursor = connection.execute('select * from movements')
        names = list(map(lambda x: x[0], cursor.description))
        return ','.join(names) + '\n'


@app.route('/vertex')
def stations():
    project = request.args.get('project') or 'citibike'
    with sqlite3.connect('projects/%s.db'%project) as con:
        return pd.read_sql('select * from vertices', con).set_index('id').to_csv()


@functools.lru_cache(maxsize=None)
@app.route('/station/traffic')
def stations_by_traffic():
    filters = ' and '.join('`%s`=\'%s\''%(arg, request.args.get(arg)) for arg in request.args if arg != 'project')
    where_clause = '' if not filters else 'where ' + filters
    project = request.args.get('project') or 'citibike'
    with sqlite3.connect('projects/%s.db'%project) as con:
        cursor = con.cursor()
        counts = cursor.execute('select `to`, count(*) from movements %s group by `to`'%where_clause)
        return '\n'.join(str(station) + ',' + str(count) for station, count in counts)


@app.route('/sql')
def sql():
    project = request.args.get('project') or 'citibike'
    with sqlite3.connect('projects/%s.db'%project) as con:
        return pd.read_sql(request.args.get('query'), con).to_csv()


if __name__ == '__main__':
    app.run(host='0.0.0.0')
