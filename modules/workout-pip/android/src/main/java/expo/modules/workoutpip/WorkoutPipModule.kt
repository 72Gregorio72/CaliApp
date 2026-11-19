package expo.modules.workoutpip

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Rational
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHANNEL_ID = "workout_timer"
private const val NOTIFICATION_ID = 4242

class WorkoutPipModule : Module() {
  private var pipEnabled = false

  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  private val manager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun pipParams(autoEnter: Boolean): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder().setAspectRatio(Rational(16, 9))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setAutoEnterEnabled(autoEnter)
    return builder.build()
  }

  override fun definition() = ModuleDefinition {
    Name("WorkoutPip")

    // A fresh process means the JS session is gone: drop a notification left by a killed app.
    OnCreate { runCatching { manager.cancel(NOTIFICATION_ID) } }

    Function("setPipEnabled") { enabled: Boolean ->
      pipEnabled = enabled
      val activity = appContext.currentActivity ?: return@Function
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        activity.runOnUiThread {
          runCatching { activity.setPictureInPictureParams(pipParams(enabled)) }
        }
      }
    }

    // Android 8-11 have no auto-enter: enter PiP by hand when the user presses home.
    OnUserLeavesActivity {
      if (pipEnabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        appContext.currentActivity?.let { runCatching { it.enterPictureInPictureMode(pipParams(true)) } }
      }
    }

    // In PiP the activity is paused, so RN stops timers and UI updates: resume the host to keep the widget ticking.
    OnActivityEntersBackground {
      val activity = appContext.currentActivity ?: return@OnActivityEntersBackground
      Handler(Looper.getMainLooper()).post {
        if (pipEnabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && activity.isInPictureInPictureMode) {
          (activity.application as? ReactApplication)?.reactHost?.onHostResume(activity)
        }
      }
    }

    Function("showTimer") { title: String, text: String, whenMs: Double, chronometer: Boolean, countDown: Boolean ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        manager.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, "Allenamento in corso", NotificationManager.IMPORTANCE_LOW)
        )
      }
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      val tap = PendingIntent.getActivity(
        context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
      val notification = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
        .setContentTitle(title)
        .setContentText(text)
        .setContentIntent(tap)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setSilent(true)
        .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setShowWhen(chronometer)
        .setUsesChronometer(chronometer)
        .setChronometerCountDown(countDown)
        .setWhen(whenMs.toLong())
        .build()
      runCatching { manager.notify(NOTIFICATION_ID, notification) } // SecurityException if permission denied
    }

    Function("hideTimer") { manager.cancel(NOTIFICATION_ID) }
  }
}
