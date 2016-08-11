window.GLOBE_RADIUS = 200;

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

  var currentCountry, overlay;

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
  // todo: implement this!
  baseGlobe.addEventListener('ondblclick', onGlobeClick);
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

  //example of drawing
  drawData('asind', 'both', countryArr, curves);

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

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
