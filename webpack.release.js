const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const WebpackObfuscator = require('webpack-obfuscator');
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
        { from: 'dist', to: 'dist' },
        { from: 'thirdParty', to: 'thirdParty' },
      ],
    }),

    // 난독화 (MV3 안전 옵션, background는 제외)
    new WebpackObfuscator(
      {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        numbersToExpressions: false,
        renameGlobals: false,
        rotateStringArray: true,
        selfDefending: false,
        simplify: true,
        splitStrings: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        target: 'browser',
        unicodeEscapeSequence: false,
        transformObjectKeys: true,
        sourceMap: false,
      },
      [
        // 제외 패턴들 (서비스워커와 외부 번들)
        'background.js',
        '**/dist/**',
        '**/thirdParty/**',
      ]
    ),

    // zip 산출물 (release.zip, release_<version>.zip)
    new ZipPlugin({ filename: 'release.zip' }),
    new ZipPlugin({ filename: `release_${pkg.version}.zip` }),
  ],
};
