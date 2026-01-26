import type { StrapiApp } from '@strapi/strapi/admin';

// Import custom logos
import AuthLogo from './extensions/logo-auth.svg';
import MenuLogo from './extensions/logo.svg';

export default {
  config: {
    // Custom branding - Replace Strapi with JJElevate
    auth: {
      logo: AuthLogo,
    },
    menu: {
      logo: MenuLogo,
    },
    head: {
      favicon: '/favicon.svg',
    },
    // Disable Strapi tutorials
    tutorials: false,
    // Disable notifications about Strapi updates
    notifications: {
      releases: false,
    },
    // Custom translations to replace any remaining "Strapi" text
    translations: {
      en: {
        'app.components.LeftMenu.navbrand.title': 'JJElevate CMS',
        'app.components.LeftMenu.navbrand.workplace': 'Tax Filing Portal',
        'Auth.form.welcome.title': 'Welcome to JJElevate',
        'Auth.form.welcome.subtitle': 'Tax Filing CMS Portal',
        'HomePage.helmet.title': 'JJElevate CMS Portal',
        'global.strapi': 'JJElevate',
        'Settings.application.strpiVersion': 'Version',
        'Settings.application.strapiVersion': 'Version',
        'app.components.HomePage.welcome': 'Welcome to JJElevate CMS Portal',
        'app.components.HomePage.welcome.again': 'Welcome back!',
        'app.components.HomePage.welcomeBlock.content': 'Manage tax filings, users, and system settings from this portal.',
        'app.components.HomePage.welcomeBlock.content.again': 'We hope you had a great time away. Here are the latest updates.',
        'content-manager.App.schemas.data-loaded': 'Data loaded successfully',
      },
    },
    // Locales configuration
    locales: ['en'],
    // Theme customization
    theme: {
      light: {
        colors: {
          primary100: '#e6f0f7',
          primary200: '#b3d4e8',
          primary500: '#07477a',
          primary600: '#053560',
          primary700: '#042a4d',
          buttonPrimary500: '#07477a',
          buttonPrimary600: '#053560',
        },
      },
      dark: {
        colors: {
          primary100: '#1a3a5c',
          primary200: '#0a5a99',
          primary500: '#3ba4e0',
          primary600: '#07477a',
          primary700: '#053560',
          buttonPrimary500: '#3ba4e0',
          buttonPrimary600: '#07477a',
        },
      },
    },
  },
  bootstrap(app: StrapiApp) {
    // Set initial title
    document.title = 'JJElevate CMS Portal';

    // Inject CSS to hide Marketplace and Cloud menu items
    const style = document.createElement('style');
    style.textContent = `
      /* Hide Marketplace menu item */
      a[href="/marketplace"],
      a[href*="/marketplace"],
      [data-strapi-marketplace],
      nav a[href="/marketplace"] {
        display: none !important;
      }

      /* Hide Cloud/Deploy menu item */
      a[href*="cloud.strapi.io"],
      a[href="/plugins/cloud"],
      [data-strapi-cloud],
      nav a[href*="cloud"] {
        display: none !important;
      }

      /* Hide any menu items with Marketplace or Cloud text */
      nav li:has(a[href="/marketplace"]),
      nav li:has(a[href*="cloud"]) {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    // Watch for title changes and replace any Strapi references
    const observer = new MutationObserver(() => {
      if (document.title.toLowerCase().includes('strapi')) {
        document.title = document.title.replace(/strapi/gi, 'JJElevate');
      }
    });

    // Observe title element changes
    const titleElement = document.querySelector('title');
    if (titleElement) {
      observer.observe(titleElement, { childList: true, characterData: true, subtree: true });
    }

    // Also set up an interval as a fallback for dynamic title changes
    const titleInterval = setInterval(() => {
      if (document.title.toLowerCase().includes('strapi')) {
        document.title = document.title.replace(/strapi/gi, 'JJElevate');
      }
    }, 500);

    // Clean up interval after 10 seconds (initial load should be done by then)
    setTimeout(() => clearInterval(titleInterval), 10000);
  },
};
