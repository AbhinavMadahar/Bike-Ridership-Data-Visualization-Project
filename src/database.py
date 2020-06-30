"""
Set up database from CSV files.
"""


import sqlite3
import numpy as np
import pandas as pd
from sys import argv


with sqlite3.connect('projects/citibike.db') as conn:
    for data_file_name in argv[1:]:
        try:
            rides = pd.read_csv(data_file_name)
            rides.columns = ['tripduration','starttime','stoptime','start station id','start station name','start station latitude','start station longitude','end station id','end station name','end station latitude','end station longitude','bikeid','usertype','birth year','gender']
            rides = rides.astype({'start station id': np.float32, 'end station id': np.float32})

            stations = rides.groupby('start station id').first()
            stations = stations[['start station name', 'start station latitude', 'start station longitude']]
            stations = stations.rename(columns={'start station name': 'name', 'start station latitude': 'latitude', 'start station longitude': 'longitude'})
            stations.index = stations.index.rename('id')
            print(stations)

            end_stations = rides.groupby('start station id').first()
            end_stations = end_stations[['end station name', 'end station latitude', 'end station longitude']]
            end_stations = end_stations.rename(columns={'end station name': 'name', 'end station latitude': 'latitude', 'end station longitude': 'longitude'})
            end_stations.index = end_stations.index.rename('id')
            stations = pd.concat([stations, end_stations]).drop_duplicates()
            stations.to_sql('station', con=conn, if_exists='replace')
            print('Inserted stations into DB')

            rides['starttime'] = pd.to_datetime(rides['starttime'])
            rides['hour'] = rides['starttime'].dt.hour
            rides['minute'] = rides['starttime'].dt.minute
            rides = rides[['start station id', 'end station id', 'hour', 'minute', 'bikeid', 'usertype', 'birth year', 'gender']]
            rides = rides.rename(columns={'start station id': 'from', 'end station id': 'to'})
            rides.to_sql('ride', con=conn, if_exists='append')
            print('Inserted rides into DB')
        except pd.errors.ParserError:
            pass

    c = conn.cursor()
    try:
        c.execute('CREATE INDEX to_index         ON ride (`to`)')
        c.execute('CREATE INDEX from_index       ON ride (`from`)')
        c.execute('CREATE INDEX hour_index       ON ride (`hour`)')
        c.execute('CREATE INDEX bikeid_index     ON ride (`bikeid`)')
        c.execute('CREATE INDEX gender_index     ON ride (`gender`)')
        c.execute('CREATE INDEX birth_year_index ON ride (`birth year`)')
    except sqlite3.OperationalError:
        pass
    print('Created indices')
    conn.commit()
