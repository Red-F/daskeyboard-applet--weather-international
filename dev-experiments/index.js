import got from 'got';
console.log('about to call api');

const data = await got('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=52.060669&lon=4.494025').json();


var properties = data.properties;
var timeseries = properties.timeseries;
console.log(timeseries[0]);

var ts = new Date(timeseries[0].time);
console.log(ts);
console.log(ts.getTimezoneOffset());


//=> {"hello": "world"}