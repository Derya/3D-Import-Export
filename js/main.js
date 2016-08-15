// globe size
window.GLOBE_RADIUS = 200;
window.GLOBE_HALF_CIRCUMF = Math.PI * window.GLOBE_RADIUS;

//window.minSpeed = 0.001; window.maxSpeed = 0.01;

// thicknesses of arc lines
window.lineUnselectedThickness = 2;
window.lineSelectedThickness = 5;

const OrbitControls = orbitControls.default(THREE);
var curves;

import { scene, camera, renderer } from './scene';
import { setEvents } from './setEvents';
import { convertToXYZ, getEventCenter, geodecoder, arc, get3DCoordsFrom2D } from './geoHelpers';
import { mapTexture } from './mapTexture';
import { getTween, memoize } from './utils';
import topojson from 'topojson';
import THREE from 'THREE';
import * as orbitControls from 'OrbitControls';
import d3 from 'd3';
import { getData, drawData } from './getData';

function initialize(){
  $('.loading-container').hide();
  $('.panel').fadeIn('fast');
  $('#info').fadeIn('fast');
}

d3.json('data/world.json', function (err, data) {
  initialize();
  var currentCountry, selectedCountry, overlay;
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

  function onGlobeMousemove(event) {
    var map; var material;

    // Get pointc, convert to latitude/longitude
    var latlng = getEventCenter.call(this, event);

    // Look for country at that latitude/longitude
    var country = geo.search(latlng[0], latlng[1]);

    if (country !== null && country.code !== currentCountry) {

      // Track the current country displayed
      currentCountry = country.code;

      // Update the html
      d3.select("#msg").html(country.code);

       // Overlay the selected country
       map = textureCache(country.code, '#13355F');
       material = new THREE.MeshPhongMaterial({map: map, transparent: true});
       if (!overlay) {
        overlay = new THREE.Mesh(new THREE.SphereGeometry(201, 40, 40), material);
        overlay.rotation.y = Math.PI;
        root.add(overlay);
      } else {
        overlay.material = material;
      }
    }
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

    if (country) {
      countryLongCode = getCountryByFullName(country.code, countryArr).longCode;
      selectedCountry = country;
    }

    if (countryLongCode) {
      window.params.country = countryLongCode;
      magicRedraw();
    }
  }

  setEvents(camera, [baseGlobe], 'click');
  setEvents(camera, [baseGlobe], 'mousemove', 10);

});


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

function onMouseMove(event){
  event.preventDefault();
  mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1; 
  for(var i=0; i< $(".tooltips").length; i++){
    tooltips[i].style.top = mouse.y +20;
    tooltips[i].style.left = mouse.x +20;
  }
}

var raycaster = new THREE.Raycaster();
raycaster.linePrecision = 1;
var intersects;
var currentIntersected;

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


  //highlights curves when mouseover
  raycaster.setFromCamera( mouse, camera );
  window.addEventListener( 'mousemove', onMouseMove, false );

  var all_curves_uuid;
  if (window.pathData && window.pathData.length > 0){
    all_curves_uuid = [];
    for(var k=0; k < window.pathData.length; k++){
      all_curves_uuid.push(window.pathData[k].curveObject.uuid);
    }

  }

  if (curves){
    intersects = raycaster.intersectObjects( curves.children , true);
  }

  if ( intersects && intersects.length > 0 ) {

    if ( currentIntersected) {
      currentIntersected.material.linewidth = window.lineUnselectedThickness;
    }
    currentIntersected = intersects[0].object;
    currentIntersected.material.linewidth = window.lineSelectedThickness;

    var index = $.inArray(currentIntersected.uuid, all_curves_uuid);

    var info = window.pathData[index];

    if (info) {
      var originInfo = info.origin.id;
      var destInfo = info.destination.id;
      if(info.importQuestionMark){
        var importInfo = "import";
      }
      else {
        var importInfo = "export";
      }
      
      var valueInfo = info.value;

      $("#curve_info").html(originInfo + " " + destInfo + " "+ importInfo + " $" + valueInfo);
    }

  } 
  else {

    if ( currentIntersected !== undefined ) {
      currentIntersected.material.linewidth = window.lineUnselectedThickness;
    }
  }
  renderer.render(scene, camera);
}

animate();

var panels = document.getElementsByClassName('panel');
for(var i = 0; i < panels.length; i++){
  panels[i].addEventListener('mouseenter', function(){
    controls.enableZoom = false;
    controls.enableRotate = false;
  });
  panels[i].addEventListener('mouseleave', function(){
    controls.enableZoom = true;
    controls.enableRotate = true;
  });
};
