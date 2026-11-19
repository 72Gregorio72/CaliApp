const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

// PiP needs the flag on MainActivity, and these configChanges so the activity is resized instead of recreated (JS state survives).
module.exports = config =>
  withAndroidManifest(config, cfg => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity.$['android:supportsPictureInPicture'] = 'true';
    const changes = new Set((activity.$['android:configChanges'] ?? '').split('|').filter(Boolean));
    ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation'].forEach(c => changes.add(c));
    activity.$['android:configChanges'] = [...changes].join('|');
    return cfg;
  });
