System.config({
  baseURL: '/',
  map: {
    d3: 'node_modules/d3/d3',
    THREE: 'node_modules/three/three',
    OrbitControls: 'node_modules/three-orbit-controls/index',
    topojson: 'node_modules/topojson/topojson',
    SubUnit: 'node_modules/src/index'
  },
  transpiler: 'babel'
});

System.import('js/main');