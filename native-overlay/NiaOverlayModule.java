package com.nia.companion;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/** Starts a user-visible, independently owned overlay service, never a JS placeholder. */
public class NiaOverlayModule extends ReactContextBaseJavaModule {
 private final ReactApplicationContext context;
 public NiaOverlayModule(ReactApplicationContext context){super(context);this.context=context;}
 @Override public String getName(){return "NiaOverlay";}
 @ReactMethod public void hasPermission(Promise promise){promise.resolve(Build.VERSION.SDK_INT<23||Settings.canDrawOverlays(context));}
 @ReactMethod public void requestPermission(Promise promise){
  if(Build.VERSION.SDK_INT<23||Settings.canDrawOverlays(context)){promise.resolve(true);return;}
  Activity activity=getCurrentActivity();
  if(activity==null){promise.reject("NO_ACTIVITY","Open Nia before requesting overlay permission");return;}
  activity.runOnUiThread(()->{
   try{activity.startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+context.getPackageName())));promise.resolve(false);}
   catch(Exception e){promise.reject("PERMISSION_SETTINGS",e);}
  });
 }
 @ReactMethod public void show(Promise promise){
  Activity activity=getCurrentActivity();
  if(activity==null){promise.reject("NO_ACTIVITY","Open Nia to start the floating avatar");return;}
  activity.runOnUiThread(()->{
   if(!activity.hasWindowFocus()){promise.reject("NOT_VISIBLE","Keep Nia visible while starting the floating avatar");return;}
   if(Build.VERSION.SDK_INT>=23&&!Settings.canDrawOverlays(context)){promise.reject("NO_PERMISSION","Allow display over other apps in Android settings");return;}
   try{
    if(!"ready".equals(NiaOverlayService.status)&&!"loading".equals(NiaOverlayService.status))NiaOverlayService.status="loading";
    Intent intent=new Intent(context,NiaOverlayService.class);
    if(Build.VERSION.SDK_INT>=26)context.startForegroundService(intent);else context.startService(intent);
    promise.resolve(true);
   }catch(Exception e){NiaOverlayService.status="error: "+e.getClass().getSimpleName();promise.reject("OVERLAY_START",e);}
  });
 }
 @ReactMethod public void hide(Promise promise){
  try{context.stopService(new Intent(context,NiaOverlayService.class));promise.resolve(true);}
  catch(Exception e){promise.reject("OVERLAY_STOP",e);}
 }
 @ReactMethod public void getStatus(Promise promise){promise.resolve(NiaOverlayService.status);}
}
