const path = require('path');
const webpack = require('webpack');

const port = Number(process.env.PORT) || 3000;

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: './src/main.tsx',
  output: {
    path: path.join(__dirname, 'public/dist/'),
    filename: 'bundle.js',
    publicPath: '/dist/',
    clean: true
  },
  plugins: [
    new webpack.DefinePlugin({
      __API_SERVER_URL__: JSON.stringify(process.env.API_SERVER_URL || 'http://localhost:9966/petclinic')
    })
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  // react-datepicker's bundle contains a dynamic require that webpack cannot analyse; it is never reached at runtime.
  ignoreWarnings: [{ module: /node_modules\/react-datepicker/ }],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        include: path.join(__dirname, 'src')
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.less$/,
        use: [
          'style-loader',
          'css-loader',
          // Bootstrap 3's Less sources rely on Less 3's division behavior.
          { loader: 'less-loader', options: { lessOptions: { math: 'always' } } }
        ],
        include: path.join(__dirname, 'src/styles')
      },
      {
        test: /\.(png|jpg)$/,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 25000 } }
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2)$/,
        type: 'asset/resource',
        generator: { filename: 'fonts/[name][ext]' }
      }
    ]
  },
  devServer: {
    port,
    hot: true,
    historyApiFallback: true,
    static: { directory: path.join(__dirname, 'public') },
    devMiddleware: { publicPath: '/dist/' }
  }
};
