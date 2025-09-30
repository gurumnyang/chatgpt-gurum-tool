const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    tiktoken: './src/tiktoken-wrapper.js',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    library: {
      name: 'tiktoken',
      type: 'umd',
      export: 'default',
    },
  },
  resolve: {
    extensions: ['.js'],
    fallback: {
      fs: false,
      path: false,
      url: false,
      crypto: false,
    },
  },
  optimization: {
    minimize: true,
  },
};
