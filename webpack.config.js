const path = require('path');

module.exports = {
  entry: './index.js',  // Aapke project ka entry point (main file)
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),  // Ye output file dist folder mein jaayegi
  },
  target: 'node',  // Backend ke liye target node set karein
};
    