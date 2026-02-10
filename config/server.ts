export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', 'http://localhost:1337'),
  proxy: true, // Trust App Engine load balancer (required for secure cookies behind HTTPS proxy)
  app: {
    keys: env.array('APP_KEYS'),
  },
});
