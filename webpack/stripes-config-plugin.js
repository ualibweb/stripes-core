// This webpack plugin generates a virtual module containing the stripes configuration
// To access this configuration simply import 'stripes-config' within your JavaScript:
//   import { okapi, config, modules } from 'stripes-config';

const assert = require('assert');
const _ = require('lodash');
const VirtualModulesPlugin = require('webpack-virtual-modules');
const StripesBrandingPlugin = require('./stripes-branding-plugin');
const StripesTranslationPlugin = require('./stripes-translations-plugin');
const serialize = require('serialize-javascript');
const StripesModuleParser = require('./stripes-module-parser');
const StripesBuildError = require('./stripes-build-error');

module.exports = class StripesConfigPlugin {
  constructor(options) {
    if (!_.isObject(options.modules)) {
      throw new StripesBuildError('stripes-config-plugin was not provided a "modules" object for enabling stripes modules');
    }
    this.options = _.omit(options, 'branding');
  }

  apply(compiler) {
    const enabledModules = this.options.modules;
    const stripesModuleParser = new StripesModuleParser(enabledModules, compiler.context, compiler.options.resolve.alias);
    const moduleConfigs = stripesModuleParser.parseEnabledModules();
    this.mergedConfig = Object.assign({}, this.options, { modules: moduleConfigs });

    // Prep the virtual module now, we will write to it when ready
    this.virtualModule = new VirtualModulesPlugin();
    compiler.apply(this.virtualModule);

    // Wait until after other plugins to generate virtual stripes-config
    compiler.plugin('after-plugins', theCompiler => this.afterPlugins(theCompiler));
  }

  afterPlugins(compiler) {
    // Locate the StripesTranslationPlugin to grab its translation file list
    const translationPlugin = compiler.options.plugins.find(plugin => plugin instanceof StripesTranslationPlugin);
    const brandingPlugin = compiler.options.plugins.find(plugin => plugin instanceof StripesBrandingPlugin);

    // Create a virtual module for Webpack to include in the build
    const stripesVirtualModule = `
      const { okapi, config, modules } = ${serialize(this.mergedConfig, { space: 2 })};
      const branding = ${brandingPlugin.serializedBranding};
      const translations = ${serialize(translationPlugin.allFiles, { space: 2 })};
      export { okapi, config, modules, branding, translations };
    `;

    this.virtualModule.writeModule('node_modules/stripes-config.js', stripesVirtualModule);
  }
};
