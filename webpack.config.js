var webpack = require('webpack');
var path = require('path');
var libraryName = 'graphVisualizer';
var outputFile = libraryName + '.js';

var config = {
  entry: __dirname + '/src/index.js',
  devtool: 'source-map',
  output: {
    path: __dirname + '/lib',
    filename: outputFile,
  }
};

module.exports = config;