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
  const meta = json['$'];
  return new Period({
    from: meta.from,
    to: meta.to,
    number: meta.period,

    symbol: json.symbol[0]['$'],
    precipitation: json.precipitation[0]['$'],
    windDirection: json.windDirection[0]['$'],
    windSpeed: json.windSpeed[0]['$'],
    temperature: json.temperature[0]['$'],
    pressure: json.pressure[0]['$'],
  });
}



/**
 * Process raw JSON forecast data into Days and Periods
 * @param {String} data 
 */
function processForecast(data) {
  const periods = data.weatherdata.forecast[0].tabular[0].time;
  const days = [];
  let currentDate = '';
  let thisDay = null;
  for (periodJson of periods) {
    let period = Period.revive(periodJson);
    let thisDate = period.from.split('T')[0];
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


const days = [];
for (const period of periods) {

}
var ts = new Date(periods[0].time);
console.log(ts);
console.log(ts.getTimezoneOffset());


//=> {"hello": "world"}