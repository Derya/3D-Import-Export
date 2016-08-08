import { scene, camera, renderer } from './scene';
import { setEvents } from './setEvents';
import { convertToXYZ, getEventCenter, geodecoder, arc, get3DCoordsFrom2D } from './geoHelpers';
import { mapTexture } from './mapTexture';
import { getTween, memoize } from './utils';
import topojson from 'topojson';
import THREE from 'THREE';
import d3 from 'd3';

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






  // BEGIN HACKED IN LINE DRAWING TEST
  // some helper function
  function map( x,  in_min,  in_max,  out_min,  out_max){return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;}
  // test json with 1 point
  var dataRecord = {
    from: { // in india
      lat: 19,
      lon: 78
    },
    to: { // in indonesia
      lat: 0,
      lon: 100
    }
  };
  ///// calculations for getting FROM point from a latlong into a 3d point on the globe
  var phiFrom = dataRecord.from.lat * Math.PI / 180;
  var thetaFrom = (dataRecord.from.lon - 90) * Math.PI / 180;
  var xF = GLOBE_RADIUS * Math.cos(phiFrom) * Math.sin(thetaFrom);
  var yF = GLOBE_RADIUS * Math.sin(phiFrom);
  var zF = GLOBE_RADIUS * Math.cos(phiFrom) * Math.cos(thetaFrom);
  ///// identical calculates for TO point
  var phiTo = dataRecord.to.lat * Math.PI / 180;
  var thetaTo = (dataRecord.to.lon - 90) * Math.PI / 180;
  var xT = GLOBE_RADIUS * Math.cos(phiTo) * Math.sin(thetaTo);
  var yT = GLOBE_RADIUS * Math.sin(phiTo);
  var zT = GLOBE_RADIUS * Math.cos(phiTo) * Math.cos(thetaTo);
  // save as vectors
  var vT = new THREE.Vector3(xT, yT, zT);
  var vF = new THREE.Vector3(xF, yF, zF);
  // calculate distance
  var dist = vF.distanceTo(vT);
  // here we are creating the control points for the first ones.
  // the 'c' in front stands for control.
  var cvT = vT.clone();
  var cvF = vF.clone();
  // then you get the half point of the vectors points.
  var xC = ( 0.5 * (vF.x + vT.x) );
  var yC = ( 0.5 * (vF.y + vT.y) );
  var zC = ( 0.5 * (vF.z + vT.z) );
  // then we create a vector for the midpoints.
  var mid = new THREE.Vector3(xC, yC, zC);

  ////////////////////////// some more curve magic i guess????
  var smoothDist = map(dist, 0, 10, 0, 15/dist );
  mid.setLength( GLOBE_RADIUS * smoothDist );
  cvT.add(mid);
  cvF.add(mid);
  cvT.setLength( GLOBE_RADIUS * smoothDist );
  cvF.setLength( GLOBE_RADIUS * smoothDist );
  ////////////////////////// end curve magic
  // create curve object
  var curve = new THREE.CubicBezierCurve3( vF, cvF, cvT, vT );
 
  // create curve geometry
  var geometry2 = new THREE.Geometry();
  geometry2.vertices = curve.getPoints( 50 );
  var material2 = new THREE.LineBasicMaterial( { color : 'green' } );
  
  // CREATING ACTUAL 3D OBJECT TO RENDER:::
  var curveObject = new THREE.Line( geometry2, material2 );
  // added to scene a bit further below 

  // important: we need to save the paths for adding graphics to them::
  // paths.push(curve);

  // make some cubes for testing, also added to scene below
  var firstCube = new THREE.Mesh(new THREE.CubeGeometry(10,10,10), new THREE.MeshNormalMaterial());
  firstCube.position.x = xT; firstCube.position.y = yT; firstCube.position.z = zT;
  var secondCube = new THREE.Mesh(new THREE.CubeGeometry(10,10,10), new THREE.MeshNormalMaterial());
  secondCube.position.x = xF; secondCube.position.y = yF; secondCube.position.z = zF;

  // END HACKED IN ROUTES TESTING





  // create a container node and add ALL OUR meshes
  var root = new THREE.Object3D();
  root.scale.set(2.5, 2.5, 2.5);
  root.add(baseGlobe);
  root.add(baseMap);
  root.add(curveObject);
  root.add(firstCube); root.add(secondCube);
  scene.add(root);

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
