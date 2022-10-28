import got from 'got';


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
  var next = json.data.next_1_hours;
  if (next === undefined) {
    next = json.data.next_6_hours;
  }
  if (next === undefined) {
    next = json.data.next_12_hours;
  }
  var details = json.data.instant.details;
  return new Period({
    from: new Date(json.time),
    to: new Date(from.getTime() + 60 * 60 * 1000),
    symbol: next.summary.symbol_code,
    precipitation: next.precipitation_amount,
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



console.log('about to call api');

// const data = await got('https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=52.060669&lon=4.494025').json();
const data = await got('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=52.060669&lon=4.494025').json();

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

var ts = new Date(periods[0].time);
console.log(ts);
console.log(ts.getTimezoneOffset());


//=> {"hello": "world"}