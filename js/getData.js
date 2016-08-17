// const http = require('http');
import d3 from 'd3';
import { arcpath } from './arc';
import tinycolor from 'TinyColor';
import { beautifulDigits } from './beautifulDigits';
import {despaceify} from './utils';


var noDataMessage = 'Data of this country is not available.';

function getCountryByFullName(query, arr) {
  return arr.find(function(q) {return q.id == query});
}
function getCountryByShortCode(query, arr) {
  return arr.find(function(q) {return q.shortCode == query});
}
function getCountryByLongCode(query, arr) {
  return arr.find(function(q) {return q.longCode == query});
}

function getData(country, format, product, fn){
  var url = `http://josh-han.com:10002/${format}/${country}`;
  if (product != '000000')
    url += `/${product}`;
  d3.json(url, function (err, data) {
    fn(data);
  });
}

function calcColor(minHue, maxHue, val) {
  var min = 0; var max = 100;
    // var minHue = 140; var maxHue = 0;
    var curPercent = (val - min) / (max-min);
    var colString = "hsl(" + Math.floor(((curPercent * (maxHue-minHue) ) + minHue)) + ",82%,59%)";

    return "#" + tinycolor(colString).toHex();
}

// import? is boolean, true for import false for export
function getHexCode(tradePercent, importQuestionMark) {
  if (importQuestionMark) 
    return calcColor(0, 52, tradePercent);
  else
    return calcColor(180, 270, tradePercent);
}

// draw either import or export data or both evidently, depending on input data

function drawData(country, format, product, countryArr, curves){
  // note: curves variable that we are passing reference to in parameters for this function
  // is a wrapper for more than just the curve objects, all the moving arrow objects are held in it as well

  if (!country) return;

  getData(country, format, product, function(data){

    // our data array has an entry with destination "xxxx" that isn't supposed to represent an actual
    // trade to a country, but rather just has the total export or total import for this country
    // remove it:
    data = data.filter(function(obj) {
      if (obj.dest_id === 'xxxxh')
      {
        return false;
      }
      return true;
    });

    window.totalImport = 0;
    window.totalExport = 0;

    // we are going to find the minimum and maximum values for this dataset
    var maxVal = -1;
    var minVal = Infinity;

    for (var i = 0; i < data.length; i++)
    {
      if (data[i].import_val && data[i].import_val > maxVal)
        maxVal = data[i].import_val;
      if (data[i].export_val && data[i].export_val > maxVal)
        maxVal = data[i].export_val;
      if (data[i].import_val && data[i].import_val < minVal)
        minVal = data[i].import_val;
      if (data[i].export_val && data[i].export_val < minVal)
        minVal = data[i].export_val;
    }

    minVal += 0.03 * maxVal;

    window.displayMax = Math.log(maxVal);
    window.displayMin = Math.log(minVal);

    data.forEach(function(trade){
      var importVal, exportVal, colorDraw, originCountry, destCountry, tradePercent;

      // draw import if it exists
      if (trade.import_val)
      {
        window.totalImport += trade.import_val;
        importVal = Math.log(trade.import_val);

        tradePercent = 100 * (importVal - window.displayMin) / (window.displayMax - window.displayMin);
        if (tradePercent > 100) tradePercent = 100;

        if (tradePercent > 0)
        {
          colorDraw = getHexCode(tradePercent, true);

          // console.log("tradeVal = " + tradeVal + " % = " + tradePercent);
          originCountry = getCountryByLongCode(country, countryArr);
          destCountry = getCountryByLongCode(trade.dest_id, countryArr);
          try {
            // definetely import
            arcpath(originCountry, destCountry, colorDraw, true, trade.import_val, tradePercent, function(err, objects) {
              for (var i = 0; i < objects.length; i++) curves.add(objects[i]);
            });
          }
          catch(err) {
            // console.log(err);
          }
        }
      }

      // draw export if it exists
      if (trade.export_val)
      {
        window.totalExport += trade.export_val;
        exportVal = Math.log(trade.export_val);

        tradePercent = 100 * (exportVal - window.displayMin) / (window.displayMax - window.displayMin);
        if (tradePercent > 100) tradePercent = 100;

        if (tradePercent > 0)
        {
          colorDraw = getHexCode(tradePercent, false);

          // console.log("tradeVal = " + tradeVal + " % = " + tradePercent);
          originCountry = getCountryByLongCode(country, countryArr);
          destCountry = getCountryByLongCode(trade.dest_id, countryArr);
           
          try {
            // definetely export
            arcpath(originCountry, destCountry, colorDraw, false, trade.export_val, tradePercent, function(err, objects) {
              for (var i = 0; i < objects.length; i++) curves.add(objects[i]);

            });
          }
          catch(err) {
            // console.log(err);
          }
        }
      }

    });

    window.totalExport = "$" + beautifulDigits(window.totalExport);
    window.totalImport = "$" + beautifulDigits(window.totalImport);

    showData(data, countryArr);

    window.all_curves_uuid = [];
    for(var k=0; k < window.pathData.length; k++){
      window.all_curves_uuid.push(window.pathData[k].curveObject.uuid);
    }

  });
}

function showData(data, countryArr) {

  var countryName, tradeVal, tradePercent, tradeColor;
  countryName = getCountryByLongCode(window.params.country, countryArr).actual_full_name || '';
  $('#current-country').text(countryName);

  $('.data-table').find('tr').remove();
  $('#info-panel').find('.no-data-message').remove();

  $('#total-import').text(window.totalImport);
  $('#total-export').text(window.totalExport);

  var sortedImport = data.filter(function(ele){
    return ele.import_val;
  }).sort(function(a, b){
    return b.import_val - a.import_val;
  })

  var sortedExport = data.filter(function(ele){
    return ele.export_val;
  }).sort(function(a, b){
    return b.export_val - a.export_val;
  })

  if (sortedImport.length == 0) {
    var noData = $('<h4>').text('Data of this country is not available.').css('color', 'salmon').addClass('no-data-message').appendTo($('#import-table'));
  } else {
    var header = $('<tr>');
    $('<th>').text('From').appendTo(header);
    $('<th>').text('Value').appendTo(header);
    $('#import-table').append(header);
  }

  if (sortedExport.length == 0) {
    var noData = $('<h4>').text('Data of this country is not available.').css('color', 'salmon').addClass('no-data-message').appendTo($('#export-table'));
  } else {
    var header = $('<tr>');
    $('<th>').text('To').appendTo(header);
    $('<th>').text('Value').appendTo(header);
    $('#export-table').append(header);
  }

  sortedImport.forEach(function(ele){
    $('#import-title').show();
    var thisCountry = getCountryByLongCode(ele.dest_id, countryArr);
    if (thisCountry) {
      countryName = thisCountry.id;
    } else {
      return;
    }
    tradeVal = ele.import_val;
    tradeVal = Math.log(tradeVal);
    tradePercent = 100 * (tradeVal - window.displayMin) / (window.displayMax - window.displayMin);
    if (tradePercent > 100) tradePercent = 100;
    tradeColor = getHexCode(tradePercent, true);
    var tr = $('<tr>');
    if (tradeVal > window.displayMin)
      tr.css('background', `${tradeColor}`);
    $('<td>').text(countryName).appendTo(tr);
    $('<td nowrap>').addClass(despaceify(countryName)).text(`$${beautifulDigits(ele.import_val)}`).appendTo(tr);
    $('#import-table').append(tr);
  });

  sortedExport.forEach(function(ele){
    $('#export-title').show();
    var thisCountry = getCountryByLongCode(ele.dest_id, countryArr);
    if (thisCountry) {
      countryName = thisCountry.id;
    } else {
      return;
    }
    tradeVal = ele.export_val;
    tradeVal = Math.log(tradeVal);
    tradePercent = 100 * (tradeVal - window.displayMin) / (window.displayMax - window.displayMin);
    if (tradePercent > 100) tradePercent = 100;
    tradeColor = getHexCode(tradePercent, false);
    var tr = $('<tr>');
    if (tradeVal > window.displayMin)
      tr.css('background', `${tradeColor}`);
    $('<td>').text(countryName).appendTo(tr);
    $('<td nowrap>').addClass(despaceify(countryName)).text(`$${beautifulDigits(ele.export_val)}`).appendTo(tr);
    $('#export-table').append(tr);
  });
 
}

export {
  getData,
  drawData
};
