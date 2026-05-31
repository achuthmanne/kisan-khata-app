const { withMainActivity } = require('@expo/config-plugins');

const lockScreenBypassCode = `
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val keyguardManager = getSystemService(android.content.Context.KEYGUARD_SERVICE) as android.app.KeyguardManager?
      keyguardManager?.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
        android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      )
    }
    super.onCreate(null)`;

const withLockScreenBypass = (config) => {
  return withMainActivity(config, async (config) => {
    let contents = config.modResults.contents;

    // Check if the code is already injected
    if (!contents.includes('setShowWhenLocked(true)')) {
      console.log('Injecting lock screen bypass into MainActivity.kt...');
      // Replace super.onCreate(null) or super.onCreate(savedInstanceState) with our code + the original call
      contents = contents.replace(
        /super\.onCreate\((null|savedInstanceState)\)/,
        (match) => lockScreenBypassCode.replace('super.onCreate(null)', match)
      );
      config.modResults.contents = contents;
    }

    return config;
  });
};

module.exports = withLockScreenBypass;
