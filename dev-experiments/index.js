import got from 'got';
import readline from 'readline';
import fs from 'fs';


/**
 * Retrieve forecast JSON from the service
 * @param {String} forecastUrl 
 */
async function retrieveForecast(forecastUrl) {
  console.log("Getting forecast via URL: " + forecastUrl);
  return await got(forecastUrl).json();
}

/**
 * Represents a single forecast period within a day
 */
class Period {
  constructor({
    from,
    to,
    number,
    symbol = {},
    precipitation = {},
    windDirection = {},
    windSpeed = {},
    temperature = {},
    pressure = {}
  }) {

    this.from = from;
    this.to = to;
    this.number = number;

    this.symbol = symbol;
    this.precipitation = precipitation;
    this.windDirection = windDirection;
    this.windSpeed = windSpeed;
    this.temperature = temperature;
    this.pressure = pressure;
  }
}

Period.revive = function (json) {
  let next = json.data.next_1_hours;
  if (next === undefined) {
    next = json.data.next_6_hours;
  }
  if (next === undefined) {
    next = json.data.next_12_hours;
  }
  const details = json.data.instant.details;
  return new Period({
    from: new Date(json.time),
    to: new Date(from.getTime() + 60 * 60 * 1000),
    symbol: next.summary.symbol_code,
    precipitation: next.details.precipitation_amount,
    windDirection: details.wind_from_direction,
    windSpeed: details.wind_speed,
    temperature: details.air_temperature,
    pressure: details.air_pressure_at_sea_level
  });
}

/**
 * Represents a day's worth of forecasts
 */
class Day {
  constructor(date, periods) {
    this.date = date;
    this.periods = periods;
  }
}

/**
 * Process raw JSON forecast data into Days and Periods
 * @param {String} data 
 */
function processForecast(data) {
  const periods = data.properties.timeseries;
  const days = [];
  let currentNumber = 1;
  let currentDate = 0;
  let thisDay = null;
  for (const periodJson of periods) {
    let period = Period.revive(periodJson);
    period.number = currentNumber++;
    let thisDate = period.from.getDate();
    if (thisDate !== currentDate) {
      currentDate = thisDate;
      if (thisDay) {
        days.push(thisDay);
      }
      thisDay = new Day(thisDate, [period]);
    } else {
      thisDay.periods.push(period);
    }

    if (thisDay && thisDay.length) {
      days.push(thisDay)
    }

    if (days.length >= 5) break;
  }

  return days;
}

/**
 * Choose the most relevant forecast period within a day.
 * @param {Day} day 
 */
function choosePeriod(day) {
  const selectedPeriods = [];
  const useEvening = day.periods[0].from.getHours() > 17;
  for (const period of day.periods) {
    // try to limit to 07.00 .. 18.00 hours
    if (period.from.getHours() < 7) continue;
    if (period.from.getHours() > 17 && !useEvening) break;
    selectedPeriods.push(period);
  }
  // return the period with most precipitation
  return selectedPeriods.reduce((prev, current) => { return prev.precipitation > current.precipitation ? prev : current; });
}

/**
 * Loads the weather cities from an installed text file
 */
 async function loadCities() {
  console.log(`Retrieving cities...`);

  return new Promise((resolve, reject) => {
    const lines = [];

    const reader = readline.createInterface({
      input: fs.createReadStream('cities.txt'),
      crlfDelay: Infinity
    });

    reader.on('line', (line) => {
      lines.push(line);
    });

    reader.on('close', () => {
      // remove duplicates, ignoring the header on first line
      const dedupe = lines.slice(1).sort().filter((line, i, allLines) => {
        return (i == 0 || allLines[i - 1] != line);
      });
      resolve(dedupe);
    });

    reader.on('error', error => {
      reject(error);
    })
  })
}

/**
 * Process a list of zones into a list of options
 * @param {Array<*>} lines 
 */
function processCities(lines) {
  const options = [];
  for (const line of lines) {
    const values = line.split("\t");
    const url = values[16].trim();
    options.push({
      key: url,
      value: `${values[3]}, ${values[15].replace(/_/g, ' ')} (${values[10]})`,
    })
  }

  return options;
}

console.log('about to call api');

const data = await retrieveForecast('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=52.060669&lon=4.494025');

var properties = data.properties;
const periods = properties.timeseries;
console.log(periods[0]);
var aPeriod = periods[0];

var from = new Date(aPeriod.time);
var to = new Date(from.getTime() + 60 * 60 * 1000);
var symbol = aPeriod.data.next_1_hours.summary.symbol_code;
var precipitation = aPeriod.data.next_1_hours.details.precipitation_amount;
var details = aPeriod.data.instant.details;
var windDirection = details.wind_from_direction;
var windSpeed = details.wind_speed;
var temperature = details.air_temperature;
var pressure = details.air_pressure_at_sea_level;

var p = Period.revive(aPeriod);

var d = processForecast(data);

const precipitations = d.map(d => choosePeriod(d));

var ts = new Date(periods[0].time);
console.log(ts);
console.log(ts.getTimezoneOffset());

const cities = await loadCities();
const options = processCities(cities);


//=> {"hello": "world"}