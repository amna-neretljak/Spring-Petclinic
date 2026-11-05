const webpack = require('webpack');
const devConfig = require('./webpack.config');

module.exports = {
  ...devConfig,
  mode: 'production',
  plugins: [
    new webpack.DefinePlugin({
      __API_SERVER_URL__: JSON.stringify(process.env.API_SERVER_URL || 'http://localhost:9966/petclinic')
    })
  ],
  devServer: undefined
};
