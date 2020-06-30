CITIBIKE_DOWNLOADS=$(addsuffix .csv,$(addprefix data/2019,$(shell seq -w 1 12)))

all: projects/citibike.db 

env:
	virtualenv env --python=python3;
	. env/bin/activate; pip install -r requirements.txt;

data:
	mkdir data

data/%.csv: | data 
	cd data; \
	wget "https://s3.amazonaws.com/tripdata/$(basename $(notdir $@))-citibike-tripdata.csv.zip"; \
	unzip "$(basename $(notdir $@))-citibike-tripdata.csv.zip"; \
	rm "$(basename $(notdir $@))-citibike-tripdata.csv.zip"; \
	mv "$(basename $(notdir $@))-citibike-tripdata.csv" "$(basename $(notdir $@)).csv";
	touch $@;

projects/citibike.db: $(CITIBIKE_DOWNLOADS) env 
	. env/bin/activate; python src/database.py $(CITIBIKE_DOWNLOADS);
