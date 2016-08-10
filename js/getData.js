// const http = require('http');
import d3 from 'd3';
import { arcpath } from './arc';

function getCountryByFullName(query, arr) {
  return arr.find(function(q) {return q.id == query});
}
function getCountryByShortCode(query, arr) {
  return arr.find(function(q) {return q.shortCode == query});
}
function getCountryByLongCode(query, arr) {
  return arr.find(function(q) {return q.longCode == query});
}

function getData(country, format, fn){
    var url = `http://josh-han.com:10002/${format}/${country}`;
    d3.json(url, function (err, data) {
        fn(data);
    });
}

function drawData(country, format, countryArr, curves){
  getData(country, format, function(data){
    data.forEach(function(trade){
      var originCountry = getCountryByLongCode(country, countryArr);
      console.log(country);
      var destCountry = getCountryByLongCode(trade.dest_id, countryArr);
      try {
        arcpath(originCountry.lat, originCountry.long, destCountry.lat, destCountry.long, function(err, arc) {
          curves.add(arc);
        });
      }
      catch(err) {
        // console.log(err);
      }
    });
  })
}

export {
    getData,
    drawData
};