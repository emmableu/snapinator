const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const TerserPlugin = require('terser-webpack-plugin');

const profile = process.argv.indexOf('--profile') !== -1;

module.exports = {
  entry: './index.ts',
  output: {
    path: __dirname + "/dist",
    filename: "snapinator_app.bundle.js",
    library: "snapinator",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "ts-loader" }
    ]
  },
  plugins: [],
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  },
};

if (profile) {
  module.exports.plugins.push(new BundleAnalyzerPlugin());
}
