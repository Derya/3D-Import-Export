import { scene, camera, renderer } from './scene';
import { setEvents } from './setEvents';
import { convertToXYZ, getEventCenter, geodecoder, arc, get3DCoordsFrom2D } from './geoHelpers';
import { mapTexture } from './mapTexture';
import { getTween, memoize } from './utils';
import topojson from 'topojson';
import THREE from 'THREE';
import d3 from 'd3';
import { arcpath } from './arc';

var GLOBE_RADIUS = 200;



d3.json('data/world.json', function (err, data) {

  d3.select("#loading").transition().duration(500)
  .style("opacity", 0).remove();

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
  let blueMaterial = new THREE.MeshPhongMaterial({color: '#003380', transparent: true});
  let sphere = new THREE.SphereGeometry(GLOBE_RADIUS, segments, segments);
  let baseGlobe = new THREE.Mesh(sphere, blueMaterial);
  baseGlobe.rotation.y = Math.PI;
  baseGlobe.addEventListener('click', onGlobeClick);
  baseGlobe.addEventListener('mousemove', onGlobeMousemove);

  // add base map layer with all countries
  let worldTexture = mapTexture(countries, '#b8b894');
  let mapMaterial  = new THREE.MeshPhongMaterial({map: worldTexture, transparent: true});
  var baseMap = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), mapMaterial);
  baseMap.rotation.y = Math.PI;

  // var from;
  // var to;

  d3.json('data/latlng.json', function(err, data){
    console.log(data.length);
  // for(var i =0; i < data.length ; i++){
  //   console.log(data[i]);

  // }
  var from = data[100]
  console.log(from);
  var to = data[200];
  console.log(to);

  
  arcpath(from.CapitalLatitude, from.CapitalLongitude, to.CapitalLatitude, to.CapitalLongitude, function(err, data){
    console.log("callback");
    for(var i=0; i < data.length; i++){
      root.add(data[i]);
      console.log(data[i]);
    }
    console.log("add all component to root");
    console.log(root);
    
  });

  scene.add(root);

});

  // var dataRecord = {
  //   from: { // in india
  //     lat: 19,
  //     lon: 78
  //   },
  //   to: { // in indonesia
  //     lat: 0,
  //     lon: 100
  //   }
  // };

  // create a container node and add ALL OUR meshes
  var root = new THREE.Object3D();
  root.scale.set(2.5, 2.5, 2.5);
  root.add(baseGlobe);
  root.add(baseMap);
  


  function onGlobeClick(event) {

    // Get pointc, convert to latitude/longitude
    var latlng = getEventCenter.call(this, event);
    console.log("latitude: " + latlng[0] + " longitude: " + latlng[1]);
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
       map = textureCache(country.code, 'red');
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

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
