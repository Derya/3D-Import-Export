import THREE from 'THREE';

function map( x,  in_min,  in_max,  out_min,  out_max){return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;}

function findVector(latitude, longitude){
  // angles
  var phi = latitude * Math.PI / 180;
  var theta = (longitude - 90) * Math.PI / 180;
  // 3 point Cartesian
  var x = window.GLOBE_RADIUS * Math.cos(phi) * Math.sin(theta);
  var y = window.GLOBE_RADIUS * Math.sin(phi);
  var z = window.GLOBE_RADIUS * Math.cos(phi) * Math.cos(theta);
  // vector
  var v = new THREE.Vector3(x, y, z);
  return v;
}

// cool callback
function arcpath(fromLatitude, fromLongitude, toLatitude, toLongitude, colorToDraw, importQuestionMark, callback)
{
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
  mid.setLength( window.GLOBE_RADIUS * smoothDist );
  cvT.add(mid);
  cvF.add(mid);
  cvT.setLength( window.GLOBE_RADIUS * smoothDist );
  cvF.setLength( window.GLOBE_RADIUS * smoothDist );
  ////////////////////////// end curve magic

   // create curve object
   var curve = new THREE.CubicBezierCurve3( vF, cvF, cvT, vT );
  // create curve geometry
  var geometry2 = new THREE.Geometry();
  geometry2.vertices = curve.getPoints( 50 );

  var material2 = new THREE.LineBasicMaterial( { color : colorToDraw , linewidth: 3, fog: true, lineopacity: 0.8 } );
  
  // CREATING ACTUAL 3D OBJECT TO RENDER:::
  var curveObject = new THREE.Line( geometry2, material2 );
  // added to scene a bit further below 

  // this is the threeJS object that is moving on this path
  var newMovingGuy = new THREE.Mesh(new THREE.BoxGeometry(10,10,10), new THREE.MeshNormalMaterial());

  // this is the hash of info for this particular path to be stored in the global pathHash array
  window.pathHashes.push({
    // threeJS 3D object
    movingGuy: newMovingGuy,
    // threeJS curve object
    curve: curve,
    // current position on the arc (initialized to random point)
    position: Math.random(),
    // speed
    speed: 0.002,
    // whether it is an import or an export
    importQuestionMark: importQuestionMark
  });

  if ( typeof callback == 'function'){
    callback(null, [curveObject,newMovingGuy]);
  }
}

export {
  arcpath
};