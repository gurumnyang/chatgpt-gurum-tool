const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');

const pkg = require('./package.json');

module.exports = {
  mode: 'production',
  devtool: false,
  target: 'web',
  entry: {
    background: './background.js',
    content: './content.js',
    popup: './popup.js',
    'fetch-hook': './fetch-hook.js',
    'request-hook': './request-hook.js',
    'token-calculator': './token-calculator.js',
  },
  output: {
    path: path.resolve(__dirname, 'build-firefox'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          ecma: 2020,
          compress: {
            passes: 2,
            drop_debugger: true,
            // Remove all console.log calls in release bundles
            pure_funcs: ["console.log"],
          },
          mangle: true,
          format: { comments: false },
        },
      }),
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'popup.html'),
      filename: 'popup.html',
      inject: false,
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        minifyCSS: true,
        minifyJS: true,
      },
    }),

    // Firefox용 manifest 복사 (firefox 전용 파일을 manifest.json으로 배치)
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.firefox.json', to: 'manifest.json' },
        { from: 'icons', to: 'icons' },
        { from: '_locales', to: '_locales' },
        { from: 'dist', to: 'dist' },
        { from: 'thirdParty', to: 'thirdParty' },
      ],
    }),

    // firefox zip 산출물
    new ZipPlugin({ filename: 'firefox_release.zip' }),
    new ZipPlugin({ filename: `firefox_release_${pkg.version}.zip` }),
  ],
};
