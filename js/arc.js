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

function arcpath(originCountry, destCountry, colorToDraw, importQuestionMark, value, tradePercent, callback)
{
  const importExportSpacing = 0.5;

  var fromLatitude = originCountry.lat;
  var fromLongitude = originCountry.long;
  var toLatitude;
  var toLongitude;

  if(importQuestionMark){
    toLatitude = destCountry.lat - importExportSpacing;
    toLongitude = destCountry.long - importExportSpacing;
  }
  else{
    toLatitude = destCountry.lat + importExportSpacing;
    toLongitude = destCountry.long + importExportSpacing;
  }

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

  // map the distance to 1.0 --> 1.7
  // we want further countries to have higher arcs
  var heightConst = map(dist, 0, window.GLOBE_DIAMETER, 11, 17);
  var smoothDist = map( dist, 0, 10, 0, heightConst/dist );
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

  // number of moving clusters, and the number of arrows in each cluster
  var numMovingGuyClusters = Math.floor(map(curve.getLength(), 50, 600, 1, 15));
  console.log(curve.getLength());
  var clusterDensityMovingGuys = 2; //Math.floor(map(tradePercent, 0, 100, 1, 4));
  // this is the spacing between arrows we want, in length units (not in %) 
  const clusterSpacingReal = 3;
  // calculate this spacing in %
  const clusterSpacing = clusterSpacingReal / curve.getLength();
  // arrow size, 1.5 looks good to me
  const arrowSize = 1;

  // this is the array of hashes holding all the moving object data
  var movingGuys = [];

  // this is the array of threeJS objects that we will add to our "curves" object wrapper via the callback function later
  // this is not necessary to have seperate from the above array, but the rest of the code is structured to accomodate it this way 
  // so I am letting it be for now. this array is used at the bottom, in the callback function
  // start with just the curve object, add the moving guys in the loop below
  var returnObjArr = [curveObject];

  // speed we want, in length units (not in %)
  const speedReal = map(tradePercent, 0, 100, 0.1, 1);
  // calculate speed in %
  const speed = speedReal / curve.getLength();

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
    curveObject: curveObject,
    // array of moving guy objects
    movingGuys: movingGuys,
    origin: originCountry,
    destination: destCountry,
    importQuestionMark: importQuestionMark,
    value: value
  });

  if ( typeof callback == 'function'){
    callback(null, returnObjArr);
  }
}

export {
  arcpath
};