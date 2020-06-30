// we'll define the render function later, but for now we need declare it in
// the global namespace
let render;

// when we insert plots into the document, we do so using two columns.
// we start with 1 plot, the map, taking the left half of the top column.
// then, we add a new plot to that same row.
// after that, we add a new row for the new plot, but then we continue to use that row for the next.
// basically, we alternate between using the bottom row and making a new row, 
// so we save that state in this variable.
// we start with 2 plots (map and popular vertices), so we set the variable to true.
let lastPlotLineFull = true;

// plots the HTML code in plot in the appropriate spot
const addPlot = (plot) => {
  const guid = Math.random();
  const element = `
    <button id="focus-${guid}">Focus</button>
    <div id="${guid}">${plot}</div>
  `;
  if (lastPlotLineFull) {
    const row = `
      <div class="row">
        <div class="six columns">
          ${element}
        </div>
      </div>
    `;
    document.getElementById('end-of-plots').insertAdjacentHTML('beforebegin', row);
  } else {
    document.getElementById('end-of-plots').previousSibling.previousSibling.innerHTML += element;
  }
  lastPlotLineFull = !lastPlotLineFull;
  document.getElementById('focus-'+guid).onclick = () => focusOnPlot(document.getElementById(guid));
};

// the application can use different databases, not just the original Citi Bike data.
// the user can upload more data, which is stored as its own project.
// here, we select the project (e.g. 'flights' or 'citibike') from the URL hash (e.g. extract 'citibike' from '?project=citibike').
// if no project is specified, we use the original citibike data
const project = location.search.includes('project') ? location.search.split('&').filter(elem => elem.includes('project'))[0].split('=')[1] : 'citibike';

// for cleanliness, we define the code that renders the event map here. It
// accepts the mapData and layout parameters which are used in Plotly.react, a
// dictionary of the stations, and the popularStations object which is used in
// Plotly.newPlot
let mapHooksSet = false;
const renderMap = async (mapData, popularStations, layout, stations, filters) => {
  document.getElementById('focus-map').onclick = () => focusOnPlot(document.getElementById('map'));

  const urlFilters = Object.keys(filters).map(key => `${key}=${filters[key]}`).join('&');
  const url = `/station/traffic?project=${project}&${urlFilters}`;
  const rides = CSVToArray(await (await fetch(url)).text()).slice(2);  // we have to .slice(2) to remove the heading and any junk
  // the rides data (before the .slice(2)) looked like:
  //   StationID,Traffic
  //   72.0,1000
  //   74.0,262
  //   78.0,256
  //   ...
  // as you can see, each row lists a station and how many rides were made to
  // that station from the `from` station.

  // extract the columns
  const stationIds = rides.map(r => r[0]);
  const traffic = rides.map(r => Number(r[1]));

  // now, we fill the mapData[0] latitude, longitude, and text lists with the
  // `traffic` data

  mapData[0].lat = stationIds.map(stationId => stations[stationId][0]);
  mapData[0].lon = stationIds.map(stationId => stations[stationId][1]);
  mapData[0].marker.color = traffic;
  mapData[0].marker.colorscale = 'YlOrRd';
  mapData[0].marker.reversescale = true;
  mapData[0].marker.cmin = Math.min(...traffic);
  mapData[0].marker.cmax = Math.max(...traffic);
  mapData[0].text = stationIds;

  // if a `from` station was used, we want to highlight it on the map.
  // to do so, we add a new layer with a single, large dot at the `from` station.
  // the large dot appears below the smaller, existing dot for the station, forming an outline.
  if (filters.from) {
    mapData[2].lat = [stations[filters.from][0]];
    mapData[2].lon = [stations[filters.from][1]];
    mapData[2].text = [filters.from];
    mapData[2].marker.color = [50];
  } else {
    mapData[2].lat = [];
    mapData[2].lon = [];
    mapData[2].text = [];
  }

  // we sort the stations by traffic to get a 2-tuple with elements of the form (stationName, traffic), e.g. ('West 4th & Baker', 251).
  // the elements are sorted in nonincreasing order
  const stationsOrderedByTraffic = stationIds.map((stationId, i) => [stations[stationId][0], traffic[i]]).sort((a, b) => b[1] - a[1]).slice(0, 20);

  // now, we can add them to the popularStations plot
  popularStations[0].x = stationsOrderedByTraffic.map(pair => pair[0]);
  popularStations[0].y = stationsOrderedByTraffic.map(pair => pair[1]);

  // we want to centre the map at the average point
  if (layout.mapbox.center === undefined) {
    layout.mapbox.center = {};
    layout.mapbox.center.lat = mapData[0].lat.map(Number).reduce((a, b) => a + b, 0) / mapData[0].lat.length;
    layout.mapbox.center.lon = mapData[0].lon.map(Number).reduce((a, b) => a + b, 0) / mapData[0].lon.length;
    layout.mapbox.zoom = 1 / (Math.max(mapData[0].lat.map(Number)) - Math.min(mapData[0].lon.map(Number)));
  }

  Plotly.redraw('stations');

  const graph = await Plotly.react('map', mapData, layout);
  if (!mapHooksSet) {
    graph.on('plotly_hover', data => {
      // we only care if the user hovers over a station, so the first check makes
      // sure that the hovered-over point is in the stations layer (mapData[0]),
      // and the second makes sure that the user wants to enable hover-select.
      // The third makes sure that we don't rerender if we already selected that
      // station as the `from` station.
      if (data.points[0].data === mapData[0] && document.getElementById('map_hover').checked && data.points[0].text !== filters.from) {
        filters.from = data.points[0].text;
        render();
      }
    });
    graph.on('plotly_click', data => {
      console.log(data);
      // we only care about the click if it's done on a station, which is stored in mapData[0]
      if (data.points[0].data !== mapData[0]) {
        return;
      }
      filters.from = data.points[0].text;
      document.getElementById('map_hover').checked = false;
      render();
    });
    mapHooksSet = true;
  }
};

const main = async () => {
  // we want to show the name of the project at the top of the page
  document.getElementById('project-name').innerHTML = project;

  // the user can filter movements based on columns that vary by the project (e.g. bikeid for the Citi Bike project and airline for the flights project).
  // here, we load the projects' columns so that we can show them to the user, who can then filter by them
  const columns = (await (await fetch(`/project/columns?project=${project}`)).text()).split(',');

  // we store a filter here (e.g. if we want to make a filter that says that `hour` must be `4`, we use `filters['hour'] = '4';`)
  const filters = {};

  // the map's data is stored here with the first layer being the vertices, and the third showing a highlight around the `from` vertex if there is one.
  // the user can upload more events data which adds more layers 
  const mapData = [
    { type: 'scattermapbox', lat: [], lon: [], mode: 'markers', marker: { size: 8, colorbar: {} }, text: [], hoverinfo: 'color+text', showscale: true },
    { type: 'densitymapbox', lat: [], lon: [], radius: 1, hoverinfo: 'skip', showscale: false },
    { type: 'scattermapbox', lat: [], lon: [], mode: 'markers', marker: { size: 25, colorscale: 'Jet' }, text: [], hoverinfo: 'text', showscale: false },
  ];

  // this is the layout for the map 
  const layout = {
    autosize: true,
    hovermode:'closest',
    mapbox: { bearing: 0, pitch: 0 },
    margin: { l: 0, r: 0, b: 0, t: 0, pad: 0 },
    showlegend: false,
  };

  Plotly.setPlotConfig({
    mapboxAccessToken: 'pk.eyJ1IjoiYWJoaW5hdm1hZGFoYXIiLCJhIjoiY2s1eW8zYmt4MDF3NjNlcDhmY2hoMnNubCJ9.WWUKRyV4QF9vo-rfKl52EA'
  });

  
  const popularStations = [{ y: [], x: [], type: 'bar', textinfo: 'value' }];

  const stationsPlot = await Plotly.newPlot('stations', popularStations, { title: 'Most trafficked stations seen on map' });
  stationsPlot.on('plotly_click', data => { from = stations.indexOf(data.points[0].label); render(); });

  const stations = {};
  const stationsCSV = CSVToArray(await (await fetch(`/vertex?project=${project}`)).text());
  const vertexIndex = stationsCSV[0].indexOf('id');
  const latitudeIndex = stationsCSV[0].indexOf('Latitude');
  const longitudeIndex = stationsCSV[0].indexOf('Longitude');
  for (let station of stationsCSV) {
    stations[station[vertexIndex]] = [station[latitudeIndex], station[longitudeIndex]];
  }

  const crime = CSVToArray(await (await fetch('/data/crime.csv')).text()).slice(2)
  mapData[1].lat = crime.map(c => c[1]);
  mapData[1].lon = crime.map(c => c[2]);

  render = async () => {
    // we want to show the user a list of all the columns, their selected value if applicable, and a button to clear the filter.
    // we'll add the filters one-by-one to the left column, right column, left column, right column, etc.
    document.getElementById('filters').innerHTML = '<div id="filters-left" class="six columns"></div><div id="filters-right" class="six columns"></div>';
    let addFilterOnLeft = true;
    for (let column of columns) {
      document.getElementById(addFilterOnLeft ? 'filters-left' : 'filters-right').innerHTML += `
        <li>
          ${column}: ${filters[column]}
          <button id="remove-filter:${column}">X</button>
          <button id="plot-filter:${column}">Plot</button>
        </li>
      `;
      addFilterOnLeft = !addFilterOnLeft;
    }
    for (let column of columns) {
      document.getElementById(`remove-filter:${column}`).onclick = () => { delete filters[column]; render() };
      document.getElementById(`plot-filter:${column}`).onclick = async () => {
        // for the future, we want this filtering to be faster, so we create an index for the column if it doesn't already exist
        fetch(`/sql?project=${project}&query=create index if not exists ${column}_index on movements(${column})`);

        const csv = CSVToArray(await (await fetch(`/sql?project=${project}&query=select \`${column}\`, count(*) from movements group by \`${column}\``)).text());
        const x = csv.map(row => row[1]);
        const y = csv.map(row => row[2]);
        const div = `<div class="row"><div class="six columns"></div></div>`;
        addPlot(`<div id="plot-of-${column}"></div>`);
        const layout = { 
          title: `How many movements for each type of ${column}`,
          xaxis: { title: column },
          yaxis: { title: 'Count' }
        };
        Plotly.newPlot('plot-of-'+column, [{ x, y, type: 'bar' }], layout);
      };
    }

    renderMap(mapData, popularStations, layout, stations, filters);
  };

  render();

  /******************************************************************************
   * LET USER RUN SQL QUERIES, VIEW THE RESULTS, AND PLOT THEM
   *
   * Here, we let the user run SQL queries on the database, view the results in
   * a table, and plot the data as a histogram, line chart, or map plot.
   *****************************************************************************/

  document.getElementById('search').onclick = async () => {
    const name = document.getElementById('name').value;
    const query = document.getElementById('query').value;
    document.getElementById('name').value = '';
    document.getElementById('query').value = '';
    const csv = CSVToArray('-' + await (await fetch(`/sql?project=${project}&query=${query}`)).text());
    const sqlId = Math.random();
    document.getElementById('sql').innerHTML += `
      <div id="${sqlId}" class="row">
        <div class="six columns">
          <strong>${name}</strong>
          <p>${query}</p>
          <button id="remove-${sqlId}">Remove</button>
          <button id="add-bar-${sqlId}">Plot as bar chart</button>
          <button id="add-line-${sqlId}">Plot as line chart</button>
          <button id="add-histogram-${sqlId}">Plot as histogram</button>
          <button id="add-map-${sqlId}">Plot as map</button>
          <table>
            ${csv.map(row => '<tr><td>' + row.join('</td><td>') + '</td></tr>').join('\n')}
          </table>
        </div>
      </div>
    `;
    document.getElementById(`remove-${sqlId}`).onclick = () => document.getElementById(sqlId).outerHTML = '';
    document.getElementById(`add-bar-${sqlId}`).onclick = () => {
      const x = csv.map(row => row[1]);
      const traces = [];

      // here, we can plot more than 1 line, and each y is calculated from a column of the CSV
      for (let i = 2; i < csv[0].length; i++) {
        const y = csv.map(row => row[i]);
        const name = csv[0][i];
        traces.push({ x, y, name, type: 'bar' })
      }
      addPlot(`<div id="bar-${sqlId}"></div>`);
      Plotly.newPlot('bar-'+sqlId, traces, { title: name });
    };
    document.getElementById(`add-line-${sqlId}`).onclick = () => {
      const x = csv.map(row => row[1]);
      const traces = [];

      // here, we can plot more than 1 line, and each y is calculated from a column of the CSV
      for (let i = 2; i < csv[0].length; i++) {
        const y = csv.map(row => row[i]);
        const name = csv[0][i];
        traces.push({ x, y, name, type: 'scatter' })
      }
      addPlot(`<div id="line-${sqlId}"></div>`);
      Plotly.newPlot('line-'+sqlId, traces, { title: name });
    };
    document.getElementById(`add-histogram-${sqlId}`).onclick = () => {
      const x = csv.map(row => row[1]);
      addPlot(`<div id="histogram-${sqlId}"></div>`);
      Plotly.newPlot('histogram-'+sqlId, [{ x, type: 'histogram' }], { title: name });
    };
    document.getElementById(`add-map-${sqlId}`).onclick = () => {
      const lat = csv.map(row => row[csv[0].indexOf('latitude')]);
      const lon = csv.map(row => row[csv[0].indexOf('longitude')]);
      addPlot(`<div id="map-${sqlId}"></div>`)
      const layout = {
        title: name,
        mapbox: { bearing: 0, center: { lat: 40.73, lon: -73.99 }, pitch: 0, zoom: 11 },
      };
      Plotly.newPlot('map-'+sqlId, [{ lat, lon, type: 'scattermapbox' }], layout);
    }
  };

  // as the user types their query, they want to make sure that they wrote it correctly.
  // at this point in the code, the user would have to write a query, submit it, wait for a few seconds, and then look at the results.
  // it would be nice if they could just see a live preview of a few rows of their query as they write it so they know it's right.
  // we implement that here
  document.getElementById('query').oninput = async () => {
    const query = document.getElementById('query').value;
    // we run their current query with a `limit 5` appended to the end to only see a few results. 
    // only asking a few results also makes it faster, so the preview comes quickly
    const res = await fetch(`/sql?project=${project}&query=${query}%20limit%205`)
    const code = res.status;
    if (code !== 200) {
      document.getElementById('sql-preview').innerHTML = '';
      return;
    }
    const csv = CSVToArray('-' + await (res.text()));
    document.getElementById('sql-preview').innerHTML = `
      <table>
        ${csv.map(row => '<tr><td>' + row.join('</td><td>') + '</td></tr>').join('\n')}
      </table>
    `;
  };
};

/******************************************************************************
 * LET THE USER UPLOAD EVENT FILES
 *
 * The user may want to upload a CSV with notable events. The CSV must have 4
 * columns, possibly more, in no particular order: latitude, longitude, text,
 * and value. This will be added to the plot and the text will be shown when
 * the mouse hovers over it. The value colours the marker.
 *****************************************************************************/

document.getElementById('events-form').onsubmit = async (event) => {
  const colorscale = document.getElementById('events-color').value;
  document.getElementById('events-color').value = '';

  const eventsFile = document.getElementById('events-file').files[0];
  const events = await eventsFile.text();
  const csv = CSVToArray(events);
  const lat = csv.slice(1).map(row => row[csv[0].indexOf('latitude')]);
  const lon = csv.slice(1).map(row => row[csv[0].indexOf('longitude')]);
  const color = csv.slice(1).map(row => row[csv[0].indexOf('value')]);
  const text = csv.slice(1).map(row => row[csv[0].indexOf('text')]);
  mapData.push({ type: 'scattermapbox', lat, lon, text, marker: { size: 16, color, colorscale }, hoverinfo: 'text' });
  onhashchange();
};


// the user might want to focus on a particular plot, so we would show that plot on the left and the other elements on the other side of the page.
// to show the other elements, we need a function that sets the page to use 1 column
const switchToOneColumn = () => {
  for (let row of document.getElementsByClassName("row")) {
    for (let child of row.children) {
      child.classList.remove('six');
      child.classList.remove('twelve');
      child.classList.remove('columns');
      child.classList.add('row');
    }
  }
};


const focusOnPlot = (plot) => {
  switchToOneColumn();
  const rightHandView = document.createElement('div');
  rightHandView.id = 'right-hand-view';
  document.body.appendChild(rightHandView);
  rightHandView.appendChild(plot);
  document.getElementsByClassName('container')[0].classList.add('left-hand-view');
}


main();
