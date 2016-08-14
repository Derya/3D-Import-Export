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
  return new THREE.Vector3(x, y, z);;
}

function arcpath(fromLatitude, fromLongitude, toLatitude, toLongitude, colorToDraw, importQuestionMark, callback)
{
  // get from and to locations in the form of threeJS vectors
  var vF = findVector(fromLatitude, fromLongitude);
  var vT = findVector(toLatitude, toLongitude);
  // calculate distance between them
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

  // some more curve magic
  var smoothDist = map(dist, 0, 10, 0, 15/dist );
  mid.setLength( window.GLOBE_RADIUS * smoothDist );
  cvT.add(mid);
  cvF.add(mid);
  cvT.setLength( window.GLOBE_RADIUS * smoothDist );
  cvF.setLength( window.GLOBE_RADIUS * smoothDist );

  // create curve object
  var curve = new THREE.CubicBezierCurve3( vF, cvF, cvT, vT );
  // create curve geometry
  var geometry2 = new THREE.Geometry();
  geometry2.vertices = curve.getPoints( 50 );
  // make shaders for this object, the line opacity is not working as of right now
  var material2 = new THREE.LineBasicMaterial( { color : colorToDraw , linewidth: window.lineUnselectedThickness, fog: true, lineopacity: 0.8 } );
  
  // this is the threeJS object that is representing path itself
  var curveObject = new THREE.Line( geometry2, material2 );

  // hard coding these in here, later we can use these to indicate amount of trade going over this route
  // we could have more groups of arrows, or we could just have more arrows per group as potential ways to indicate
  // how much trade is going
  var numMovingGuyClusters = 2;
  var clusterDensityMovingGuys = 2;
  // 0.015 looks like it works well. the problem is that this is proportional to the arc length, so it is not
  // consistent between arcs. this is easy to fix by calculating this based on the arc length, so i'll implement
  // that later
  const clusterSpacing = 0.015;
  // arrow size, 1.5 looks good to me
  const arrowSize = 1.5;

  // this is the array of hashes holding all the moving object data
  var movingGuys = [];

  // this is the array of threeJS objects that we will add to our "curves" object wrapper via the callback function later
  // this is not necessary to have seperate from the above array, but the rest of the code is structured to accomodate it this way 
  // so I am letting it be for now. this array is used at the bottom, in the callback function
  // start with just the curve object, add the moving guys in the loop below
  var returnObjArr = [curveObject];

  // hard coding in speed for now. later we will want to calculate this based on arc length so that nearby countries
  // don't have extremely slow travelling arrows
  var speed = 0.002;

  // start somewhere random
  var position = Math.random();

  for (var i = 0; i < numMovingGuyClusters; i++)
  {
    // move forward in position to disperse the clusters
    position += 1/numMovingGuyClusters - clusterSpacing;
    // wrap back if necessary
    if (position > 1) position -= 1;

    for (var j = 0; j < clusterDensityMovingGuys; j++)
    {
      // move forward by clusterSpacing
      position += clusterSpacing;
      // wrap back if necessary
      if (position > 1) position -= 1;

      // build the arrow object
      var newMovingGuyGeom = new THREE.Geometry();
      newMovingGuyGeom.vertices.push(new THREE.Vector3(0, -arrowSize, -arrowSize));
      newMovingGuyGeom.vertices.push(new THREE.Vector3(0, 0, arrowSize));
      newMovingGuyGeom.vertices.push(new THREE.Vector3(0, arrowSize, -arrowSize));
      var newMovingGuyMaterial = new THREE.LineBasicMaterial( { color: colorToDraw, linewidth: 3 } );
      var newMovingGuy = new THREE.Line(newMovingGuyGeom, newMovingGuyMaterial);

      // push to object wrapper array
      returnObjArr.push(newMovingGuy);

      // push again to window data array along with other info
      movingGuys.push({
        // threeJS 3D object
        movingGuy: newMovingGuy,
        // current position on the arc, 0-1
        position: position,
        // speed
        speed: speed,
        // whether it is an import or an export
        importQuestionMark: importQuestionMark,
      });
    }
  }

  // this is the hash of info for this particular path to be stored in the global pathHash array
  window.pathData.push({
    // threeJS curve object
    curve: curve,
    // array of moving guy objects
    movingGuys: movingGuys
  });

  if ( typeof callback == 'function'){
    callback(null, returnObjArr);
  }
}

export {
  arcpath
};