import THREE from 'THREE';
var GLOBE_RADIUS = 200;

function map( x,  in_min,  in_max,  out_min,  out_max){return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;}

function findVector(latitude, longitude){
  // angles
  var phi = latitude * Math.PI / 180;
  var theta = (longitude - 90) * Math.PI / 180;
  // 3 point Cartesian
  var x = GLOBE_RADIUS * Math.cos(phi) * Math.sin(theta);
  var y = GLOBE_RADIUS * Math.sin(phi);
  var z = GLOBE_RADIUS * Math.cos(phi) * Math.cos(theta);
  // vector
  var v = new THREE.Vector3(x, y, z);
  return v;
}


function distance(fromLatitude, fromLongitude, toLatitude, toLongitude, callback){
  
  var phiFrom = fromLatitude * Math.PI / 180;
  var thetaFrom = (fromLongitude - 90) * Math.PI / 180;
  var xF = GLOBE_RADIUS * Math.cos(phiFrom) * Math.sin(thetaFrom);
  var yF = GLOBE_RADIUS * Math.sin(phiFrom);
  var zF = GLOBE_RADIUS * Math.cos(phiFrom) * Math.cos(thetaFrom);
  
  ///// identical calculates for TO point
  var phiTo = toLatitude * Math.PI / 180;
  var thetaTo = (toLongitude - 90) * Math.PI / 180;
  var xT = GLOBE_RADIUS * Math.cos(phiTo) * Math.sin(thetaTo);
  var yT = GLOBE_RADIUS * Math.sin(phiTo);
  var zT = GLOBE_RADIUS * Math.cos(phiTo) * Math.cos(thetaTo);

  var vF = findVector(fromLatitude, fromLongitude);
  var vT = findVector(toLatitude, toLongitude); 
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

  if ( typeof callback == 'function'){
    callback(null, [curveObject,firstCube,secondCube]);
  }
}

export {
  distance
};