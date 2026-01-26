import { mergeConfig, type UserConfig, type Plugin } from 'vite';
import path from 'path';

// Custom plugin to handle SVG imports for Strapi admin branding
function svgPlugin(): Plugin {
  return {
    name: 'svg-loader',
    enforce: 'pre',
    load(id) {
      if (id.endsWith('.svg')) {
        const fs = require('fs');
        try {
          const content = fs.readFileSync(id, 'utf-8');
          // Return as a data URL for use in img src
          const base64 = Buffer.from(content).toString('base64');
          return `export default "data:image/svg+xml;base64,${base64}"`;
        } catch (e) {
          console.warn(`Could not read SVG file: ${id}`);
          return 'export default ""';
        }
      }
      return null;
    },
  };
}

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
    plugins: [svgPlugin(), cssRawPlugin()],
    resolve: {
      alias: {
        '@': '/src',
        './extensions': path.resolve(__dirname, 'extensions'),
      },
    },
    optimizeDeps: {
      exclude: ['cropperjs'],
    },
  });
};
