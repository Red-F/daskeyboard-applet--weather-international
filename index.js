const got = require('got');
const fs = require('fs');
const moment = require('moment');
const readline = require('readline');
const q = require('daskeyboard-applet');
const logger = q.logger;

const Colors = Object.freeze({
  CLEAR: '#FFFF00',
  CLOUDY: '#FF00FF',
  SHOWER: '#0000FF',
  SNOW: '#FFFFFF',
  STORM: '#FF0000',
  SUNNY: '#FFFF00'
})

const Units = Object.freeze({
  metric: 'metric',
  imperial: 'imperial'
});

const MAX_SEARCH_RESULTS = 1000;

/**
 * Loads the weather cities from an installed text file
 */
async function loadCities() {
  logger.info(`Retrieving cities...`);

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
  for (line of lines) {
    const values = line.split("\t");
    const url = values[17].trim() || values[16].trim() || values[15].trim();
    const urlParts = url.split('//')[1].split('/');
    options.push({
      key: url,
      value: `${values[3]}, ${urlParts[3].replace(/_/g, ' ')} (${values[10]})`,
    })
  }

  return options;
}

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
    number,
    symbol = {},
    precipitation = {},
    windDirection = {},
    windSpeed = {},
    temperature = {},
    pressure = {}
  }) {

    this.from = from;
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
      thisDay = new Day(period.from, [period]);
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

const periodNameMap = {
  '0': 'Overnight',
  '1': 'Morning',
  '2': 'Afternoon',
  '3': 'Evening',
}

function generatePeriodText(period, units) {
  const temperature = (units == Units.imperial) ?
    Math.round(period.temperature * 1.8 + 32) + '°F' :
    period.temperature + '°C';
  return `${period.from.getHours().toString().padStart(2, '0')}:00 ${period.symbol}, ${temperature}`;
}

/**
 * Chooses the appropriate signal color for a period
 * @param {Period} period 
 */
function chooseColor(period) {
  const text = period.symbol.toLowerCase();
  if (text.includes('snow')) {
    return Colors.SNOW;
  } else if (text.includes('storm')) {
    return Colors.STORM;
  } else if (text.includes('rain') || text.includes('shower')) {
    return Colors.SHOWER;
  } else if (text.includes('cloud')) {
    return Colors.CLOUDY;
  } else {
    return Colors.CLEAR;
  }
}

class WeatherForecast extends q.DesktopApp {
  constructor() {
    super();
    this.cityName = null;
    // run every 30 min
    this.pollingInterval = 30 * 60 * 1000;
  }

  async applyConfig() { }

  async options(fieldId, search) {
    return loadCities().then(cities => {
      return processCities(cities)
    }).then(options => {
      // filter the cities if needed
      search = (search || '').trim();
      search = unescape(search);
      if (search.length > 0) {
        return options.filter(option => {
          return option.value.toLowerCase().includes(search);
        }).slice(0, MAX_SEARCH_RESULTS);
      } else {
        return options.slice(0, MAX_SEARCH_RESULTS);
      }
    }).catch(error => {
      logger.error(error);
      return [];
    });
  }

  /**
   * Generate a signal from a forecast day
   * @param {Array<Day>} days
   */
  generateSignal(days) {
    days = days.slice(0, this.getWidth());
    const messages = [];

    for (let day of days) {
      const dateMessage = `<div style="color: red;"><strong>${day.date.toString()}:</strong></div>`;
      messages.push(dateMessage);
      messages.push(`<div>`);
      day.periods.forEach((period, index) => {
        messages.push(`${generatePeriodText(period, this.config.units)}`);
        if (index !== day.periods.length - 1) {
          messages.push('-');
        }
      });
      messages.push(`</div></br>`);
    }

    const signal = new q.Signal({
      points: [
        days.map(day => {
          return new q.Point(chooseColor(choosePeriod(day)))
        })
      ],
      name: `${this.config.cityId_LABEL}`,
      message: messages.join("\n"),
    });

    return signal;
  }

  async run() {
    logger.info("Weather international running.");
    const forecastUrl = this.config.cityId;
    const cityName = this.config.cityId_LABEL || this.config.cityId;

    if (forecastUrl) {
      logger.info("My forecast URL is  : " + forecastUrl);
      logger.info("My city name is: " + cityName);

      return retrieveForecast(forecastUrl)
        .then(body => {
          return this.generateSignal(processForecast(body));
        })
        .catch((error) => {
          logger.error(`Error while getting forecast data: ${error}`);
          if(`${error.message}`.includes("getaddrinfo")){
            // Do not send signal when getting internet connection error
            // return q.Signal.error(
            //   'The Weather forecast International service returned an error. <b>Please check your internet connection</b>.'
            // );
          }else{
            return q.Signal.error([`The Weather forecast International service returned an error. Detail: ${error}`]);
          }
        })
    } else {
      logger.info("No cityId configured.");
      return null;
    }
  }
}


module.exports = {
  Colors: Colors,
  Units: Units,

  Day: Day,
  Period: Period,
  WeatherForecast: WeatherForecast,

  chooseColor: chooseColor,
  choosePeriod: choosePeriod,
  generatePeriodText: generatePeriodText,
  loadCities: loadCities,
  processCities: processCities,
  processForecast: processForecast,
  retrieveForecast: retrieveForecast,
}

const applet = new WeatherForecast();