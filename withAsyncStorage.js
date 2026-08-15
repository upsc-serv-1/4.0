const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withAsyncStorage(config, size = 50) {
  return withGradleProperties(config, config => {
    config.modResults.push({
      type: 'property',
      key: 'AsyncStorage_db_size_in_MB',
      value: String(size),
    });
    return config;
  });
};
