rm -f ../data/citibike.db;
python -u database.py ../data/2019*.csv;

for hour in $(seq -w 0 23); do
    python traffic-cache.py $hour &
done;

python hourly-cache.py;
