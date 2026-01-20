import { mergeConfig, type UserConfig, type Plugin } from 'vite';

// Custom plugin to handle CSS raw imports
function cssRawPlugin(): Plugin {
  return {
    name: 'css-raw-handler',
    enforce: 'pre',
    resolveId(source) {
      // Handle ?raw= suffix on CSS files (note the trailing =)
      if (source.endsWith('.css?raw=') || source.endsWith('.css?raw')) {
        return source;
      }
      return null;
    },
    load(id) {
      // Handle CSS files with ?raw or ?raw= suffix
      if (id.endsWith('.css?raw=') || id.endsWith('.css?raw')) {
        const fs = require('fs');
        // Remove the ?raw= or ?raw suffix to get the actual file path
        const filePath = id.replace(/\?raw=?$/, '');
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          return `export default ${JSON.stringify(content)}`;
        } catch (e) {
          console.warn(`Could not read CSS file: ${filePath}`);
          return 'export default ""';
        }
      }
      return null;
    },
  };
}

export default (config: UserConfig) => {
  // Important: always return the modified config
  return mergeConfig(config, {
    plugins: [cssRawPlugin()],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    optimizeDeps: {
      exclude: ['cropperjs'],
    },
  });
};
