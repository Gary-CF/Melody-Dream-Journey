// Measured from executable built-ins by scripts/creative-measure-catalog.cjs.
// Descriptive dimensions for planning; runtime collision/framing still uses actual geometry.
export const builtinGeometry: Record<
  string,
  { extent: [number, number, number]; minimumY: number }
> = {
  tree: {
    extent: [3.15, 4.37, 2.25],
    minimumY: 0,
  },
  flowerTree: {
    extent: [3.85, 5.34, 2.75],
    minimumY: 0,
  },
  shop: {
    extent: [10.43, 5.1, 10.43],
    minimumY: 0,
  },
  home: {
    extent: [10.43, 8.5, 10.43],
    minimumY: 0,
  },
  tower: {
    extent: [4.7, 12.75, 4.11],
    minimumY: 0,
  },
  lamp: {
    extent: [2.4, 3.86, 2.4],
    minimumY: 0,
  },
  bus: {
    extent: [2.44, 2.31, 5.82],
    minimumY: 0.01,
  },
  person: {
    extent: [0.84, 1.83, 0.6],
    minimumY: 0.04,
  },
  bench: {
    extent: [2, 1.34, 0.82],
    minimumY: 0,
  },
  stop: {
    extent: [0.75, 2.6, 0.14],
    minimumY: 0,
  },
  "core-sakura": {
    extent: [17.17, 11.63, 17.18],
    minimumY: -0.04,
  },
  "core-osmanthus": {
    extent: [10.39, 10.04, 10.91],
    minimumY: -0.04,
  },
  "core-willow": {
    extent: [17.17, 12.58, 17.18],
    minimumY: -0.04,
  },
  "core-pine": {
    extent: [16.93, 10.96, 16.96],
    minimumY: -0.04,
  },
  "core-pavilion": {
    extent: [16.55, 9.8, 16.55],
    minimumY: -0.1,
  },
  "core-moonGate": {
    extent: [10.1, 5.95, 1],
    minimumY: 0,
  },
  "core-redBridge": {
    extent: [5.02, 3.78, 14],
    minimumY: -2.55,
  },
  "core-stoneBridge": {
    extent: [5.17, 3.55, 14.19],
    minimumY: -0.37,
  },
  "core-stoneLantern": {
    extent: [2.4, 4.25, 2.4],
    minimumY: 0,
  },
  "core-paperLantern": {
    extent: [1.2, 2.75, 1.2],
    minimumY: 0.85,
  },
  "core-rocks": {
    extent: [7.8, 5.19, 6.37],
    minimumY: -1.79,
  },
  "core-mountain": {
    extent: [94.77, 43, 52.7],
    minimumY: -5.5,
  },
  "core-ridge": {
    extent: [80, 45.64, 64],
    minimumY: -0.05,
  },
  "core-stoneArch": {
    extent: [11.6, 8.09, 3.59],
    minimumY: -0.45,
  },
  "core-reeds": {
    extent: [3, 3.06, 2.83],
    minimumY: -0.01,
  },
  "core-lotus": {
    extent: [4.12, 0.5, 4.02],
    minimumY: -0.03,
  },
  "core-tavern": {
    extent: [10.8, 6.33, 12.6],
    minimumY: -0.02,
  },
  "core-bar": {
    extent: [4.3, 2.1, 1.5],
    minimumY: 0,
  },
  "core-table": {
    extent: [2.57, 1.6, 2.7],
    minimumY: 0,
  },
  "core-stool": {
    extent: [1.05, 0.99, 1.1],
    minimumY: 0,
  },
  "core-shelves": {
    extent: [3.8, 3.47, 0.6],
    minimumY: 0,
  },
  "core-lattice": {
    extent: [3.1, 2.64, 0.14],
    minimumY: 0.66,
  },
  "core-pendant": {
    extent: [1.95, 2.69, 2],
    minimumY: 1.21,
  },
  "core-neon": {
    extent: [4.2, 6, 0.43],
    minimumY: 0,
  },
  "core-truss": {
    extent: [8.5, 8.2, 0.4],
    minimumY: 0,
  },
  "core-beacon": {
    extent: [3.16, 24, 3.1],
    minimumY: 0,
  },
  "cafe-set": {
    extent: [2.8, 1, 1.44],
    minimumY: 0,
  },
  bicycle: {
    extent: [2.22, 1.29, 0.4],
    minimumY: -0.03,
  },
  shelter: {
    extent: [4.2, 2.7, 1.9],
    minimumY: 0,
  },
  planter: {
    extent: [2.5, 1.4, 1],
    minimumY: 0,
  },
  willow: {
    extent: [3.24, 4.6, 2.93],
    minimumY: 0,
  },
  reeds: {
    extent: [1.51, 1.9, 0.74],
    minimumY: -0.25,
  },
  boat: {
    extent: [2.83, 0.89, 4],
    minimumY: -0.15,
  },
  pavilion: {
    extent: [6.43, 4.73, 6.27],
    minimumY: -0.02,
  },
  mountains: {
    extent: [39.4, 25, 36.71],
    minimumY: -1.5,
  },
  "roof-garden": {
    extent: [4.9, 3.83, 4],
    minimumY: 0,
  },
  "light-fins": {
    extent: [1.48, 4.4, 0.37],
    minimumY: 0,
  },
  lanterns: {
    extent: [2.2, 3.25, 0.6],
    minimumY: 0,
  },
};
