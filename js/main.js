window.GLOBE_RADIUS = 200;
window.GLOBE_HALF_CIRCUMF = Math.PI * window.GLOBE_RADIUS;
window.minSpeed = 0.001; window.maxSpeed = 0.01;

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

const OrbitControls = orbitControls.default(THREE);

d3.json('data/world.json', function (err, data) {

  d3.select("#loading").transition().duration(500).style("opacity", 0).remove();

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
  baseGlobe.addEventListener('ondblclick', onGlobeClick);
  baseGlobe.addEventListener('click', clickToRedraw);
  baseGlobe.addEventListener('mousemove', onGlobeMousemove);

  // add base map layer with all countries
  let worldTexture = mapTexture(countries, '#112D43');
  let mapMaterial  = new THREE.MeshPhongMaterial({map: worldTexture, transparent: true});
  var baseMap = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), mapMaterial);
  baseMap.rotation.y = Math.PI;

  // get array of country objects from world.json
  var countryArr = data.objects.countries.geometries;

  // create a container node and add all our curves to it
  var curves = new THREE.Object3D();

  // create a container node and add all our meshes
  var root = new THREE.Object3D();
  root.scale.set(2.5, 2.5, 2.5);
  root.add(baseGlobe);
  root.add(baseMap);
  root.add(curves);
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
    var map, material;

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
      root.remove(curves);
      curves = new THREE.Object3D();

      drawData(countryLongCode, 'both', countryArr, curves);
      
      console.log(countryLongCode);
      root.add(curves);
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

function animate() {
  requestAnimationFrame(animate);

  if (window.pathData && window.pathData.length > 0)
  {
    for(var i = 0; i < window.pathData.length; i++) {
      pathHash = window.pathData[i];
      pt = pathHash.curve.getPoint(pathHash.position);
      pathHash.movingGuy.position.set(pt.x, pt.y, pt.z);
      if (pathHash.importQuestionMark) {
        pathHash.position = (pathHash.position <= 0) ? 1 : pathHash.position -= pathHash.speed;
      } else {
        pathHash.position = (pathHash.position >= 1) ? 0 : pathHash.position += pathHash.speed;
      }
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
