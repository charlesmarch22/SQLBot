import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import Map, {Layer, Source} from 'react-map-gl';

import { XCircleIcon } from '@heroicons/react/20/solid'
import mapboxgl from 'mapbox-gl';
import { zipcodesToLatLong } from './zipcodes';
import bbox from '@turf/bbox';
import * as turf from '@turf/turf'
import posthog from 'posthog-js'

posthog.init('phc_iLMBZqxwjAjaKtgz29r4EWv18El2qg3BIJoOOpw7s2e', { api_host: 'https://app.posthog.com' })

// The following is required to stop "npm build" from transpiling mapbox code.
// notice the exclamation point in the import.
// @ts-ignore
// eslint-disable-next-line import/no-webpack-loader-syntax, import/no-unresolved
mapboxgl.workerClass = require('worker-loader!mapbox-gl/dist/mapbox-gl-csp-worker').default;

// mapboxgl.accessToken = 'pk.eyJ1IjoicmFodWwtY2Flc2FyaHEiLCJhIjoiY2xlb2w0OG85MDNoNzNzcG5kc2VqaGR3dCJ9.mhsdkiyqyI5jLgy8TKYavg';
// mapboxgl.workerClass = require("worker-loader!mapbox-gl/dist/mapbox-gl-csp-worker").default;

function TableHeader(props) {
  return (
    <thead>
      <tr>
        {props.columns.map((x) => ( <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">{x}</th>))}
      </tr>
    </thead>
  );
}

function TableRows(props) {
  return (
    <tbody className="divide-y divide-gray-200">
      {props.values.map((row, i) => (
        <tr key={"row"+i}>
          {row.map((rowValue) => (
            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
            {rowValue}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

function Examples(props) {
  const example_queries = [
    "3 zipcodes in San Francisco that have the highest females?",
    "Which zipcodes have the median income closest to the national median income?",
    "Five zipcodes in New York City with the lowest crime?",
    "Richest neighborhood in Houston, TX"
  ]
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {example_queries.map((q) => (
        <div
          key={q}
          className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:border-gray-400"
        >
          <div className="min-w-0 flex-1">
            <a className="focus:outline-none" onClick={() => {
                props.setQuery(q)
                props.handleClick(q)
              }}>
              <span className="absolute inset-0" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-900">{q}</p>
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorMessage(props) {
  return (
    <div className="rounded-md bg-red-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">There were errors with your submission</h3>
          <div className="mt-2 text-sm text-red-700">
            <ul role="list" className="list-disc space-y-1 pl-5">
              <li>{props.errorMessage.toString()}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Table(props) {
  let columns = props.columns
  let values = props.values

  return (
<div className="px-4 sm:px-6 lg:px-8">
      <div className="mt-8 flow-root">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-gray-300">
              <TableHeader columns={columns} />
              <TableRows values={values} />
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [query, setQuery] =  useState('');
  const [sql, setSQL] = useState('');
  const [zipcodesFormatted, setZipcodesFormatted] = useState([])
  const [zipcodes, setZipcodes] = useState([])
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [statusCode, setStatusCode] = useState(0)
  const [errorMessage, setErrorMessage] = useState('');
  const [cities, setCities] = useState([]);
  const [viewState, setViewState] = useState({
    longitude: -98.2177715,
    latitude: 38.651327165999525,
    zoom: 3.1
  })

  const mapRef = useRef();

  // const test_table = {
  //   'column_names': ['zip_code', 'median_income_for_workers'],
  //   'values': [
  //         {
  //           "female_pop": 42367,
  //           "zip_code": "94112",
  //           "zip_code_lat": 37.720375,
  //           "zip_code_lon": -122.44295
  //       },
  //       {
  //           "female_pop": 33067,
  //           "zip_code": "94110",
  //           "zip_code_lat": 37.750021,
  //           "zip_code_lon": -122.415201
  //       },
  //       {
  //           "female_pop": 30826,
  //           "zip_code": "94122",
  //           "zip_code_lat": 37.758797,
  //           "zip_code_lon": -122.485128
  //       }
  //     ]
  // }

  const handleSearchChange = (event) => {
    const { value } = event.target;
    setQuery(value);
  }

  // schema for Result:
  
    // result: {
    //     "column_names": [
    //         "zip_code",
    //         "total_crime"
    //     ],
    //     "values": [
    //         [
    //             "94536",
    //             "12710"
    //         ]
    //     ]
    // }

  const getZipcodesMapboxFormatted = (zips) => {
    return zips.map(x => "<at><openparen>" + x['zipcode'] + "<closeparen>")
  }

  const getZipcodesOld = (result) => { 
      let zipcode_index = result.column_names.indexOf("zip_code")
      if (zipcode_index == -1 || !result.values) return []

      return result.values.map(x => {
        let zipcode = x[zipcode_index]
        let lat = zipcodesToLatLong[zipcode] ? zipcodesToLatLong[zipcode].lat : 0
        let long = zipcodesToLatLong[zipcode] ? zipcodesToLatLong[zipcode].long : 0

        return {
          'zipcode': x[zipcode_index],
          'lat': lat,
          'long': long
        }
      })
    }

  const getZipcodes = (result) => { 

      let zipcode_index = result.column_names.indexOf("zip_code")
      if (zipcode_index == -1 || !result.results) return []

      return result.results.map(x => { return {'zipcode': x["zip_code"], 'lat': x["lat"], 'long': x["long"] }})
  }
  
  const fetchBackend = (natural_language_query) => {
    const options = {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: '{"natural_language_query":"' + natural_language_query + '"}'
    };

    // Hardcoded test data for testing
    
    // setStatusCode(200)
    // console.log("a")
    // setColumns(test_table.column_names)
    // console.log("b")
    // setRows(test_table.values)
    // console.log("c")
    // setZipcodesFormatted(getZipcodesMapboxFormatted(test_table))
    // console.log("d")
    // setZipcodes(getZipcodes(test_table))

  let res = {
      "result": {
          "column_names": [
              "zip_code",
              "difference",
              "lat",
              "long"
          ],
          "results": [
              {
                  "difference": 0,
                  "lat": 45.925286,
                  "long": -89.499516,
                  "zip_code": "54558"
              },
              {
                "difference": 0,
                "lat": 45.925286,
                "long": -89.499516,
                "zip_code": "54558"
            }
          ]
      },
      "sql_query": "SELECT zip_code, ABS(median_income_for_workers - (SELECT median_income_for_workers FROM acs_census_data ORDER BY ABS(median_income_for_workers - (SELECT AVG(median_income_for_workers) FROM acs_census_data)) LIMIT 1)) AS difference\nFROM acs_census_data\nWHERE median_income_for_workers IS NOT NULL\nORDER BY difference\nLIMIT 1"
  }

    fetch('https://ama-api.onrender.com/api/text_to_sql', options)
      .then(response => response.json())
      .then(response => {
        setStatusCode(response.status)
        setSQL(response.sql_query)

        console.log("Backend Response ==>", response)

        // filter out lat and long columns
        let filteredColumns = response.result.column_names.filter(c => c != "lat" && c != "long")
        setColumns(filteredColumns)

        // fit the order of columns and filter out lat and long row values
        let rows = response.result.results.map((value) => {
          let row = []
          // find each of the filtered column value in the object and push it into the row
          filteredColumns.map(c => row.push(value[c]))
          return row
        })
        setRows(rows)

        let responseZipcodes = getZipcodes(response.result)

        setZipcodesFormatted(getZipcodesMapboxFormatted(responseZipcodes))

        // Fitbounds needs at least two geo coordinates. 
        if (responseZipcodes.length == 1) {
          responseZipcodes.push({
            'zipcode': responseZipcodes[0].zipcode,
            'lat': responseZipcodes[0].lat+0.1,
            'long': responseZipcodes[0].long,
          })
        }

        let [minLng, minLat, maxLng, maxLat] = bbox(turf.lineString(responseZipcodes.map(z => [z.long, z.lat])));
    
        mapRef.current.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat]
          ],
          {padding: '100', duration: 1000}
        );

        setZipcodes(responseZipcodes)
      })
     .catch(err => {
      setStatusCode(500)
      setErrorMessage(err)
      console.error(err)
    });
  }

  const handleSearchClick = (event) => {
    posthog.capture('search', { property: 'yooo1ooooo' })
    fetchBackend(query)
  }

  const zipcodeFeatures = zipcodes.map((z) => {
    return {
      "type": "Feature",
      "geometry": {
          "type": "Point",
          "coordinates": [z.long, z.lat]
      }
    }
  })

  const citiesFeatures = cities.map((c) => {
    return {
      "type": "Feature",
      "geometry": {
          "type": "Point",
          "coordinates": [c.long, c.lat]
      }
    }
  })


const zipcodeLayerLow =   {
    'id': 'zips-kml',
    'type': 'fill',
    'source': 'zips-kml',
    'minzoom': 5,
    'layout': {
        'visibility': 'visible'
    },
    'paint': {
        'fill-outline-color': 'black',
        'fill-opacity': 0.9,
        'fill-color': "#006AF9"
    },
    'source-layer': 'Layer_0',
    'filter': [
      'in',
      ['get', 'Name'],
      ['literal', zipcodesFormatted],     // Zip code in the feature is formatted like this:  <at><openparen>94105<closeparen>
    ] 
   };

 const zipcodeLayerHigh = {
    'id': 'Zip',
    'type': 'circle',
    'layout': {
        'visibility': 'visible'
    },
    'maxzoom': 8,
    'paint': {
      'circle-radius': 10,
      'circle-color': "#006AF9",
      'circle-opacity': 1,
    }
};

const citiesLayerHigh = {
  'id': 'cities',
  'type': 'circle',
  'layout': {
      'visibility': 'visible'
  },
  'paint': {
    'circle-radius': 10,
    'circle-color': "#006AF9",
    'circle-opacity': 0.8,
  }
};

  return (
    <div className="App">
      <link href="https://api.tiles.mapbox.com/mapbox-gl-js/v0.44.2/mapbox-gl.css" rel="stylesheet" />
      <div className="overflow-hidden rounded-lg bg-white shadow md:h-screen">
      <div className="px-4 py-5 sm:px-6">
        <h1 className="text-4xl font-bold mb-8">Census GPT</h1>
        <div>
          <div className="relative mt-1 flex justify-center">
            <input
              type="text"
              name="search"
              id="search"
              className="block w-full md:w-1/2 rounded-md border-gray-300 pr-12 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={query}
              onChange={handleSearchChange}
            />
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ml-2"
              onClick={handleSearchClick}
            >
              Search
            </button>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 px-4 h-full sm:p-6 flex flex-col md:flex-row md:pb-[200px]">
          <div className="overflow-hidden rounded-lg h-[40vh] md:h-full bg-white shadow flex-grow-[0] w-full mr-8 mb-8">
            {sql.length == 0 ? <Examples setQuery={setQuery} handleClick={fetchBackend}/> : <>
              <div className="p-4">
                <pre align="left" className="bg-gray-100 rounded-md p-2 overflow-auto"><code className="text-sm text-gray-800 language-sql">{sql}</code></pre>
              </div>
              {statusCode == 500 ? <ErrorMessage errorMessage={errorMessage}/> : <></>}
              <Table columns={columns} values={rows}/>
            </> }
          </div>
          <div className="overflow-hidden rounded-lg bg-white shadow flex-grow-[2] h-[70vh] md:h-full w-full">
            <Map
              ref={mapRef}
              mapboxAccessToken="pk.eyJ1IjoicmFodWwtY2Flc2FyaHEiLCJhIjoiY2xlb2w0OG85MDNoNzNzcG5kc2VqaGR3dCJ9.mhsdkiyqyI5jLgy8TKYavg"
              style={{width: '100%'}}
              mapStyle="mapbox://styles/mapbox/dark-v11"
            >
              <Source id="zips-kml" type="vector" url="mapbox://darsh99137.4nf1q4ec">
                <Layer {...zipcodeLayerLow} />
              </Source>
              <Source id="zip-zoomed-out" type="geojson" data={{type: 'FeatureCollection', features: zipcodeFeatures}}>
                <Layer {...zipcodeLayerHigh} />
              </Source>
              <Source id="cities" type="geojson" data={{type: 'FeatureCollection', features: citiesFeatures}}>
                <Layer {...citiesLayerHigh} />
              </Source>
            </Map>;
          </div>
      </div>
    </div>
  </div>
  );
}

export default App;

// /* DO NOT REMOVE

// Use this to find out what feature info is pulled for each zipcode from the vector tiles

//     map.current.on('mousemove', function (e) {
//       var features = map.current.queryRenderedFeatures(e.point, {
//           layers:  ['Zip', 'zips-kml']
//       });
//       if (features.length > 0) {
//         console.log("\n\nFEATURES => ", features)
//           if (features[0].layer.id == 'Zip') {
//             console.log("ZIP5", features[0].properties.ZIP5)
//           } else if (features[0].layer.id == 'zips-kml') {
//             console.log("ZIPS-KMLLLL", features[0].properties.Name)
//             console.log("ZIPS-KML", features[0].properties.Name.replace(/^\D+/g, '').split("<closeparen>")[0])
//             console.log("TYYPE>>>", typeof features[0].properties.Name.replace(/^\D+/g, ''));
            
//           } else {
//             console.log("ZCTAE10", features[0].properties.ZCTA5CE10)
//           }

//       } else {
//           // document.getElementById('pd').innerHTML = '<p>Hover over a state!</p>';
//       }
//   });

//   */

//   });
