const { withStringsXml } = require('@expo/config-plugins');

module.exports = function withFirebaseAuthFix(config) {
  return withStringsXml(config, (config) => {
    const strings = config.modResults.resources.string || [];
    
    // Check if it already exists to avoid duplicates
    const hasWebClientId = strings.some(
      (s) => s.$ && s.$.name === 'default_web_client_id'
    );

    if (!hasWebClientId) {
      strings.push({
        $: { name: 'default_web_client_id', translatable: 'false' },
        _: '534150351488-t3pinalnfqj6d67k42ekimct5efefif4.apps.googleusercontent.com'
      });
    }

    config.modResults.resources.string = strings;
    return config;
  });
};
