// const http = require('http');
import d3 from 'd3';

function getData(country, format, fn){
    var url = `http://josh-han.com:10002/${format}/${country}`;
    // http.get(url, function(res){
    d3.json(url, function (err, data) {
        fn(data);
    });
}

export {
    getData
};