import { scene, camera, renderer } from './scene';
import { setEvents } from './setEvents';
import { convertToXYZ, getEventCenter, geodecoder, arc, get3DCoordsFrom2D } from './geoHelpers';
import { mapTexture } from './mapTexture';
import { getTween, memoize, despaceify } from './utils';
import topojson from 'topojson';
import THREE from 'THREE';
import * as orbitControls from 'OrbitControls';
import d3 from 'd3';
import { getData, drawData } from './getData';

// globe size
window.GLOBE_RADIUS = 200;
window.GLOBE_HALF_CIRCUMF = Math.PI * window.GLOBE_RADIUS;
window.GLOBE_DIAMETER = window.GLOBE_RADIUS * 2;

//window.minSpeed = 0.001; window.maxSpeed = 0.01;

// thicknesses of arc lines
window.lineUnselectedThickness = 2;
window.lineSelectedThickness = 5;
// geometry for selected and unselected moving guys
window.movingGuyUnselectedGeom = new THREE.Geometry();
window.movingGuyUnselectedGeom.vertices.push(new THREE.Vector3(0, -1.5, -1.5));
window.movingGuyUnselectedGeom.vertices.push(new THREE.Vector3(0, 0, 1.5));
window.movingGuyUnselectedGeom.vertices.push(new THREE.Vector3(0, 1.5, -1.5));
window.movingGuySelectedGeom = new THREE.Geometry();
window.movingGuySelectedGeom.vertices.push(new THREE.Vector3(0, -30, -30));
window.movingGuySelectedGeom.vertices.push(new THREE.Vector3(0, 0, 30));
window.movingGuySelectedGeom.vertices.push(new THREE.Vector3(0, 30, -30));

window.inPanels = false;

function initialize(){
  $('.loading-container').hide();
  $('.panel').fadeIn('fast');
  $('#info').fadeIn('fast');
  $('.show').fadeIn('fast');
}

const OrbitControls = orbitControls.default(THREE);
var curves; var destInfo;

// var imagePrefix = "textures/";
// var direction = ['front', 'back', 'right', 'left', 'up', 'down'];
// var imageSuffix = ".png";

var materialArray = [];
for(var j = 0; j < 6; j++){
  materialArray.push(new THREE.MeshBasicMaterial({
    // map: THREE.ImageUtils.loadTexture( imagePrefix + direction[j] + imageSuffix),
    map: THREE.ImageUtils.loadTexture( "textures/all.gif"),
    side: THREE.BackSide
  }));
}

var skyGeometry = new THREE.CubeGeometry(8000,8000,8000);
var skyMaterial = new THREE.MeshFaceMaterial(materialArray);
var skyBox = new THREE.Mesh(skyGeometry, skyMaterial);

scene.add(skyBox);

var controls = new OrbitControls(camera);
controls.enablePan = false;
controls.enableZoom = true;
controls.enableRotate = true;
controls.minDistance = 900;
controls.maxDistance = 2000;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI;

var pt; var pathHash;
var mouse = new THREE.Vector2();

d3.json('data/world.json', function (err, data) {
  initialize();
  var currentCountry, currentCountryObj, selectedCountry, overlay;
  var segments = 155; // number of vertices. Higher = better mouse accuracy

  // Setup cache for country textures
  var countries = topojson.feature(data, data.objects.countries);
  var geo = geodecoder(countries.features);

  var textureCache = memoize(function (cntryID, color) {
    var country = geo.find(cntryID);
    return mapTexture(country, color);
  });

  // Base globe with blue "water"
  let blueMaterial = new THREE.MeshPhongMaterial({color: '#091F36', transparent: true});
  let sphere = new THREE.SphereGeometry(GLOBE_RADIUS, segments, segments);
  let baseGlobe = new THREE.Mesh(sphere, blueMaterial);
  baseGlobe.rotation.y = Math.PI;

  // TODO: implement this!
  //baseGlobe.addEventListener('ondblclick', onGlobeClick);

  baseGlobe.addEventListener('click', clickToRedraw);
  baseGlobe.addEventListener('mousemove', onGlobeMousemove);
  document.getElementById('magic').addEventListener('click', magicRedraw);

  // add base map layer with all countries
  let worldTexture = mapTexture(countries, '#112D43');
  let mapMaterial  = new THREE.MeshPhongMaterial({map: worldTexture, transparent: true});
  var baseMap = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), mapMaterial);
  baseMap.rotation.y = Math.PI;

  // get array of country objects from world.json
  var countryArr = data.objects.countries.geometries;

  // create a container node and add all our meshes
  var root = new THREE.Object3D();
  root.scale.set(2.5, 2.5, 2.5);
  root.add(baseGlobe);
  root.add(baseMap);
  scene.add(root);

  function onGlobeClick(event) { 
    console.log("globe double click!");
    // Get pointc, convert to latitude/longitude
    var latlng = getEventCenter.call(this, event);
    console.log("latitude: " + latlng[0] + " longitude: " + latlng[1]);
    // Get new camera position
    var temp = new THREE.Mesh();
    temp.position.copy(convertToXYZ(latlng, 900));
    console.log(root.position);
    temp.lookAt(root.position);
    temp.rotateY(Math.PI);

    for (let key in temp.rotation) {
      if (temp.rotation[key] - camera.rotation[key] > Math.PI) {
        temp.rotation[key] -= Math.PI * 2;
      } else if (camera.rotation[key] - temp.rotation[key] > Math.PI) {
        temp.rotation[key] += Math.PI * 2;
      }
    }

    var tweenPos = getTween.call(camera, 'position', temp.position);
    d3.timer(tweenPos);

    var tweenRot = getTween.call(camera, 'rotation', temp.rotation);
    d3.timer(tweenRot);
  }

  function getCountryByFullName(query, arr) {return arr.find(function(q) {return q.id == query});}

  function getCurveByCountryObj(query, arr) {return arr.find(function(q) {return q.destination == query})}

  function onGlobeMousemove(event) {

    if (window.inPanels) return;

    if (currentIntersected !== undefined) {
      currentCountry = destInfo;
    } else {
      // Get pointc, convert to latitude/longitude
      var latlng = getEventCenter.call(this, event);

      // Look for country at that latitude/longitude
      var country = geo.search(latlng[0], latlng[1]);

      if (country == null) {
        currentCountry = window.params.countryName;
        d3.select("#msg").html(window.params.countryName);
      }
      else {
        // Track the current country displayed
        currentCountry = country.code;
      }
    }

    selectCountry();

  } // end onGlobeMouseMove event handler

  $('.data-table').on('click', 'tr', function(e) {
    e.stopPropagation();
    var countryClickedName = $(this).children().first().text();

    var countryObj = getCountryByFullName(countryClickedName, countryArr);

    var latlng = [countryObj.lat, countryObj.long];
    // Get new camera position
    var temp = new THREE.Mesh();
    temp.position.copy(convertToXYZ(latlng, 900));
    temp.lookAt(root.position);
    temp.rotateY(Math.PI);

    for (let key in temp.rotation) {
      if (temp.rotation[key] - camera.rotation[key] > Math.PI) {
        temp.rotation[key] -= Math.PI * 2;
      } else if (camera.rotation[key] - temp.rotation[key] > Math.PI) {
        temp.rotation[key] += Math.PI * 2;
      }
    }

    var tweenPos = getTween.call(camera, 'position', temp.position);
    d3.timer(tweenPos);

    var tweenRot = getTween.call(camera, 'rotation', temp.rotation);
    d3.timer(tweenRot);

    currentCountry = countryClickedName;

    // deselect previous curve
    if ( currentIntersected != undefined ) {
      currentIntersected.material.linewidth = window.lineUnselectedThickness;
      currentIntersected.childrenMovingGuys.forEach(function(movingGuy) {
        movingGuy.movingGuy.material.linewidth = window.lineUnselectedThickness;
      });
    }
    if ( currentIntersectedAlt != undefined ) {
      currentIntersectedAlt.material.linewidth = window.lineUnselectedThickness;
      currentIntersectedAlt.childrenMovingGuys.forEach(function(movingGuy) {
        movingGuy.movingGuy.material.linewidth = window.lineUnselectedThickness;
      });
    }
    // make sure we know there is no selected curve
    currentIntersected = undefined;
    currentIntersectedAlt = undefined;

    // then, use currentCountry to dictate the info panel
    var originInfo = window.params.countryName;
    var destinationCountry = currentCountry;

    if (originInfo == destinationCountry) {
      selfDisplay();
    } else {
      var importVal = $('#import-table .' + despaceify(currentCountry)).text();
      var exportVal = $('#export-table .' + despaceify(currentCountry)).text();

      if (importVal.length > 0) {
        displayImportHover(originInfo, destinationCountry, importVal);
      } else {
        displayImportHoverNone(originInfo, destinationCountry);
      }
      if (exportVal.length > 0) {
        displayExportHover(originInfo, destinationCountry, exportVal);
      } else {
        displayExportHoverNone(originInfo, destinationCountry);
      }
    }

    selectCountry();

  });

  function selectCountry() {

    currentCountryObj = getCountryByFullName(currentCountry, countryArr);

    // Update the html
    d3.select("#msg").html(currentCountry);

     // Overlay the selected country
     var map = textureCache(currentCountry, '#13355F');
     var material = new THREE.MeshPhongMaterial({map: map, transparent: true});
     if (!overlay) {
      overlay = new THREE.Mesh(new THREE.SphereGeometry(201, 40, 40), material);
      overlay.rotation.y = Math.PI;
      root.add(overlay);
    } else {
      overlay.material = material;
    }

    if (window.pathData) {
      for (var i = 0; i < window.pathData.length; i++) {
        if (window.pathData[i].destination.id == currentCountry) {
          if (currentIntersected)
          {
            currentIntersectedAlt = window.pathData[i].curveObject
            currentIntersectedAlt.material.linewidth = window.lineSelectedThickness;
            currentIntersectedAlt.childrenMovingGuys.forEach(function(movingGuy) {
              movingGuy.movingGuy.material.linewidth = window.lineSelectedThickness;
            });
          }
          else
          {
            currentIntersected = window.pathData[i].curveObject
            currentIntersected.material.linewidth = window.lineSelectedThickness;
            currentIntersected.childrenMovingGuys.forEach(function(movingGuy) {
              movingGuy.movingGuy.material.linewidth = window.lineSelectedThickness;
            });
          }
        }
      }
    }

  }

  function displayImportHover(selected1, selected2, val) {
    $("#curve_info_import").html(
      "Import<br/>" +
      selected1 + " from " + selected2 + "<br/>"+
      val);
  }
  function displayExportHover(selected1, selected2, val) {
    $("#curve_info_export").html(
      "Export<br/>" +
      selected1 + " to " + selected2 + "<br/>"+
      val);
  }
  function displayImportHoverNone(selected1, selected2) {
    $("#curve_info_import").html(
      "Import<br/>" +
      selected1 + " from " + selected2 +
      "<br/>No Data");
  }
  function displayExportHoverNone(selected1, selected2) {
    $("#curve_info_export").html(
      "Export<br/>" +
      selected1 + " to " + selected2 +
      "<br/>No Data");
  }
  function clearDisplays() {
    $("#curve_info_export").html("");
    $("#curve_info_import").html("");
  }
  function selfDisplay() {
    $("#curve_info_export").html("Total Exports<br/>" +
      window.totalExport);
    $("#curve_info_import").html("Total Imports<br/>" +
      window.totalImport);
  }

  var raycaster = new THREE.Raycaster();
  raycaster.linePrecision = 2;
  var currentIntersected = undefined;
  var currentIntersectedAlt = undefined;
  window.addEventListener( 'mousemove', onMouseMove, false );

  function onMouseMove(event){
    event.preventDefault();

    if (window.inPanels) return;

    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1; 

    // **** begin logic for highlighting hovered arc **** //

    // check if any data is being displayed
    if (!curves) {
      // no data is being displayed, make sure currentIntersected is undefined
      currentIntersected = undefined;
      currentIntersectedAlt = undefined;
      clearDisplays();
    } else {
      // figure out what is being hovered over
      raycaster.setFromCamera( mouse, camera );
      // intersects will be array of curve and moving guy objects that the mouse is hovering over
      var allIntersects = raycaster.intersectObjects( curves.children , true );
      var intersects = [];

      // filter intersects to just the curves
      for (var i = 0; i < allIntersects.length; i++)
      {
        if (allIntersects[i].object.isCurve) {
          var intersectsWithGlobe = raycaster.intersectObjects( [allIntersects[i].object, baseGlobe] , true );
          if (intersectsWithGlobe[0].object == allIntersects[i].object) {
            intersects.push(allIntersects[i].object);
          }
        }
      }

      // check to make sure the raycaster found anything
      // IF raycaster found nothing
      if ( intersects.length <= 0 ) {
        // deselect previous curve
        if ( currentIntersected != undefined ) {
          currentIntersected.material.linewidth = window.lineUnselectedThickness;
          currentIntersected.childrenMovingGuys.forEach(function(movingGuy) {
            movingGuy.movingGuy.material.linewidth = window.lineUnselectedThickness;
          });
        }
        if ( currentIntersectedAlt != undefined )
        {
          currentIntersectedAlt.material.linewidth = window.lineUnselectedThickness;
          currentIntersectedAlt.childrenMovingGuys.forEach(function(movingGuy) {
            movingGuy.movingGuy.material.linewidth = window.lineUnselectedThickness;
          });
        }
        // make sure we know there is no selected curve
        currentIntersected = undefined;
        currentIntersectedAlt = undefined;

        // then, use currentCountry to dictate the info panel
        // IF we are hovering over a country
        if (currentCountry) {
          var originInfo = window.params.countryName;
          var destinationCountry = currentCountry;

          if (originInfo == destinationCountry) {
            selfDisplay();
          } else {
            var importVal = $('#import-table .' + despaceify(currentCountry)).text();
            var exportVal = $('#export-table .' + despaceify(currentCountry)).text();

            if (importVal.length > 0) {
              displayImportHover(originInfo, destinationCountry, importVal);
            } else {
              displayImportHoverNone(originInfo, destinationCountry);
            }
            if (exportVal.length > 0) {
              displayExportHover(originInfo, destinationCountry, exportVal);
            } else {
              displayExportHoverNone(originInfo, destinationCountry);
            }
          }
        }
        // ELSE we are not hovering over a country
        else {
          selfDisplay();
        }

      // ELSE raycaster found a curve
      } else {
        // we only need to do operations if the new curve the mouse is over is different from 
        // the previous currentIntersected, or the previous doesnt exist
        if (currentIntersected == undefined || currentIntersected != intersects[0])
        {
          // deselect previous curve
          if ( currentIntersected != undefined ) {
            currentIntersected.material.linewidth = window.lineUnselectedThickness;
            currentIntersected.childrenMovingGuys.forEach(function(movingGuy) {
              movingGuy.movingGuy.material.linewidth = window.lineUnselectedThickness;
            });
          }
          if ( currentIntersectedAlt != undefined ) {
            currentIntersectedAlt.material.linewidth = window.lineUnselectedThickness;
            currentIntersectedAlt.childrenMovingGuys.forEach(function(movingGuy) {
              movingGuy.movingGuy.material.linewidth = window.lineUnselectedThickness;
            });
          }

          // get current intersected curve
          currentIntersected = intersects[0];
          currentIntersectedAlt = undefined;

          currentIntersected.material.linewidth = window.lineSelectedThickness;
          currentIntersected.childrenMovingGuys.forEach(function(movingGuy) {
            movingGuy.movingGuy.material.linewidth = window.lineSelectedThickness;
          });

          var index = $.inArray(currentIntersected.uuid, window.all_curves_uuid);
          var originInfo = window.params.countryName;
          destInfo = window.pathData[index].destination.id;
          var importVal = $('#import-table .' + despaceify(destInfo)).text();
          var exportVal = $('#export-table .' + despaceify(destInfo)).text();

          if (importVal.length > 0) {
            displayImportHover(originInfo, destInfo, importVal);
          } else {
            displayImportHoverNone(originInfo, destInfo);
          }
          if (exportVal.length > 0) {
            displayExportHover(originInfo, destInfo, exportVal);
          } else {
            displayExportHoverNone(originInfo, destInfo);
          }

        }

      } // end else statement for condition to make sure raycaster found anything

    } // end if curves conditional for logic to highlight arc paths for arc path under the mouse

    // **** end logic for highlighting hovered arc **** //
  }

  function magicRedraw(){
    root.remove(curves);
    curves = new THREE.Object3D();
    drawData(window.params.country, window.params.format, window.params.sitc_id, countryArr, curves);      
    root.add(curves);
  }

  function clickToRedraw(event){
    function getCountryByFullName(query, arr) {
      return arr.find(function(q) {return q.id == query});
    }
    // Get pointc, convert to latitude/longitude
    var latlng = getEventCenter.call(this, event);
    // Look for country at that latitude/longitude
    var country = geo.search(latlng[0], latlng[1]);
    var countryLongCode;

    if (!country) return;
    if (selectedCountry && (country.code === selectedCountry.code)) return;

    window.pathData = [];

    window.all_curves_uuid = [];

    if (country) {
      countryLongCode = getCountryByFullName(country.code, countryArr).longCode;
      selectedCountry = country;
    }

    if (countryLongCode) {
      window.params.country = countryLongCode;
      window.params.countryName = country.code;
      magicRedraw();
    }
  }

  setEvents(camera, [baseGlobe], 'click');
  setEvents(camera, [baseGlobe], 'mousemove', 10);

});



function animate() {
  requestAnimationFrame(animate);
  
  if (window.pathData && window.pathData.length > 0)
  {

    // loop over paths
    for(var j = 0; j < window.pathData.length; j++) {
      // get the hash of data for this path
      var pathHash = window.pathData[j];

      // loop over moving guys
      for (var i = 0; i < pathHash.movingGuys.length; i++)
      {
        // get the hash of data for this moving guy
        var movingGuyHash = pathHash.movingGuys[i];

        if (movingGuyHash.importQuestionMark) {
          // current ACTUAL position, in 3D vector (x,y,z)
          var oldPoint = movingGuyHash.movingGuy.position;
          // note that movingGuyHash.position is NOT a 3D vector, it is the 0-1 floating point number that indicates
          // "position" along the curve
          movingGuyHash.position = (movingGuyHash.position <= 0) ? 1 : movingGuyHash.position -= movingGuyHash.speed;
          // new position, in 3D vector (x,y,z) calculated from the curve
          var newPoint = pathHash.curve.getPoint(movingGuyHash.position);
          // set angle of the moving guy correctly
          movingGuyHash.movingGuy.lookAt( newPoint );
          // then move arrow to new position
          movingGuyHash.movingGuy.position.set(newPoint.x, newPoint.y, newPoint.z);
        } else {
          // same code for export case
          var oldPoint = movingGuyHash.movingGuy.position;
          // only vvv this line vvv is different, so i guess should refactor somehow
          movingGuyHash.position = (movingGuyHash.position >= 1) ? 0 : movingGuyHash.position += movingGuyHash.speed;
          var newPoint = pathHash.curve.getPoint(movingGuyHash.position);
          movingGuyHash.movingGuy.lookAt( newPoint );
          movingGuyHash.movingGuy.position.set(newPoint.x, newPoint.y, newPoint.z);
          // if (j == 0) console.log("position: " + movingGuyHash.position);
        }
      }

    }

  }

  renderer.render(scene, camera);
}

animate();

var panels = document.getElementsByClassName('panel');
for(var i = 0; i < panels.length; i++){
  panels[i].addEventListener('mouseenter', function(){
    window.inPanels = true;
    controls.enableZoom = false;
    controls.enableRotate = false;
  });
  panels[i].addEventListener('mouseleave', function(){
    window.inPanels = false;
    controls.enableZoom = true;
    controls.enableRotate = true;
  });
};
