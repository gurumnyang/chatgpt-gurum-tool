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
    'timestamp-injector': './timestamp-injector.js',
    'token-calculator': './token-calculator.js',
    'hover-toolbar': './hover-toolbar.js',
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      // JS는 별도 로더 없이 플러그인으로 최소화/난독화 처리
    ],
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
            pure_funcs: ['console.log'],
          },
          mangle: true,
          format: {
            comments: false,
          },
        },
      }),
    ],
  },
  plugins: [
    // popup.html 템플릿을 그대로 사용하되, minify만 적용
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

    // 정적 자원 복사 (원본 번들 포함)
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'icons', to: 'icons' },
        { from: '_locales', to: '_locales' },
        { from: 'dist', to: 'dist' },
        { from: 'thirdParty', to: 'thirdParty' },
      ],
    }),

    // 정책 준수를 위해 난독화는 제거, Terser로 최소화만 수행

    // zip 산출물 (release.zip, release_<version>.zip)
    new ZipPlugin({ filename: 'release.zip' }),
    new ZipPlugin({ filename: `release_${pkg.version}.zip` }),
  ],
};
