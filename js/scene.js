import THREE from 'THREE';
import d3 from 'd3';

export var canvas = d3.select("body").append("canvas")
  .attr("width", window.innerWidth)
  .attr("height", window.innerHeight);

canvas.node().getContext("webgl");

export var renderer = new THREE.WebGLRenderer({canvas: canvas.node(), antialias: true});

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

export var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.z = 1000;

export var scene = new THREE.Scene();

export var light = new THREE.AmbientLight('#ffffff', '#666666', 2);
scene.add(light);
export var light2 = new THREE.PointLight('#ffffff');
light2.position.set(0,0,10000);
light2.castShadow = true;

scene.add(light2);


window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
