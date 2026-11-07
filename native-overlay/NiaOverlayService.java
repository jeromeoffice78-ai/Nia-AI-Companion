package com.nia.companion;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/** Offline GLB/WebGL renderer in a real Android system overlay. No microphone or network. */
public class NiaOverlayService extends Service {
 public static volatile String status="hidden";
 private static final String CHANNEL="nia-floating-avatar",STOP="com.nia.companion.STOP_OVERLAY";
 private static final int NOTICE=7521;
 private static final Set<String> ASSETS=new HashSet<>(Arrays.asList("index.html","renderer.js","three.module.js","GLTFLoader.js","BufferGeometryUtils.js","nia-character.glb"));
 private WindowManager manager;
 private WindowManager.LayoutParams params;
 private LinearLayout floating;
 private WebView web;
 private TextView handle;
 private boolean destroyed=false;
 private final Handler mainHandler=new Handler(Looper.getMainLooper());
 private final Runnable loadTimeout=()->{
  if(!destroyed&&!"ready".equals(status)){
   status="error: 3D overlay did not render within 30 seconds";
   Log.e("NiaOverlay",status);stopSelf();
  }
 };
 @Override public IBinder onBind(Intent intent){return null;}
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  if(intent!=null&&STOP.equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
  try{
   if(Build.VERSION.SDK_INT>=23&&!Settings.canDrawOverlays(this))throw new IllegalStateException("Display-over-apps permission is missing");
   startVisibleService();
   if(floating==null)createOverlay();
  }catch(Exception error){status="error: "+error.getClass().getSimpleName();stopSelf();}
  return START_NOT_STICKY;
 }
 private void startVisibleService(){
  NotificationManager notifications=(NotificationManager)getSystemService(Context.NOTIFICATION_SERVICE);
  if(Build.VERSION.SDK_INT>=26)notifications.createNotificationChannel(new NotificationChannel(CHANNEL,"Floating Nia",NotificationManager.IMPORTANCE_LOW));
  Intent close=new Intent(this,NiaOverlayService.class).setAction(STOP);
  int immutable=Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0;
  PendingIntent stop=PendingIntent.getService(this,0,close,PendingIntent.FLAG_UPDATE_CURRENT|immutable);
  Intent launch=getPackageManager().getLaunchIntentForPackage(getPackageName());
  Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL):new Notification.Builder(this);
  builder.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("Nia floating avatar")
   .setContentText("Offline 3D test character is visible over other apps").setOngoing(true)
   .addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel,"Close",stop).build());
  if(launch!=null)builder.setContentIntent(PendingIntent.getActivity(this,1,launch,PendingIntent.FLAG_UPDATE_CURRENT|immutable));
  if(Build.VERSION.SDK_INT>=34)startForeground(NOTICE,builder.build(),ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
  else startForeground(NOTICE,builder.build());
 }
 private int dp(float value){return Math.round(value*getResources().getDisplayMetrics().density);}
 private int screenWidth(){return getResources().getDisplayMetrics().widthPixels;}
 private int screenHeight(){return getResources().getDisplayMetrics().heightPixels;}
 private void createOverlay(){
  destroyed=false;status="loading";
  manager=(WindowManager)getSystemService(Context.WINDOW_SERVICE);
  params=new WindowManager.LayoutParams(Math.max(dp(180),screenWidth()/2),Math.max(dp(280),screenHeight()/2),
   Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE,
   WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL|WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,PixelFormat.TRANSLUCENT);
  params.gravity=Gravity.TOP|Gravity.START;params.x=screenWidth()/4;params.y=screenHeight()/4;
  floating=new LinearLayout(this);floating.setOrientation(LinearLayout.VERTICAL);floating.setBackgroundColor(Color.argb(230,32,23,36));
  handle=new TextView(this);handle.setText("Nia • drag to move");handle.setTextColor(Color.WHITE);handle.setPadding(dp(8),dp(6),dp(8),dp(6));floating.addView(handle);
  handle.setOnTouchListener(new View.OnTouchListener(){float startX,startY;int initialX,initialY;
   @Override public boolean onTouch(View view,MotionEvent event){
    if(event.getAction()==MotionEvent.ACTION_DOWN){startX=event.getRawX();startY=event.getRawY();initialX=params.x;initialY=params.y;return true;}
    if(event.getAction()==MotionEvent.ACTION_MOVE){params.x=Math.max(0,Math.min(screenWidth()-params.width,initialX+(int)(event.getRawX()-startX)));params.y=Math.max(0,Math.min(screenHeight()-dp(60),initialY+(int)(event.getRawY()-startY)));manager.updateViewLayout(floating,params);return true;}
    return event.getAction()==MotionEvent.ACTION_UP;
   }
  });
  web=new WebView(this);web.setBackgroundColor(Color.TRANSPARENT);web.setLayerType(View.LAYER_TYPE_HARDWARE,null);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(false);
  settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setSupportMultipleWindows(false);
  if(Build.VERSION.SDK_INT>=21)settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return assetResponse(request.getUrl());}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
    if(!destroyed&&!"ready".equals(status)){status="error: WebView asset load failed";handle.setText("3D rig error • close to retry");Log.e("NiaOverlay",status);}
   }
   @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){status="error: WebView renderer stopped";stopSelf();return true;}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onConsoleMessage(ConsoleMessage message){
    if(destroyed)return true;
    if("NIA_OVERLAY_READY".equals(message.message())){mainHandler.removeCallbacks(loadTimeout);status="ready";handle.setText("3D rig ready • drag to move");Log.i("NiaOverlay","NIA_OVERLAY_READY");}
    else if(message.message().startsWith("NIA_OVERLAY_ERROR:")){status="error:"+message.message().substring("NIA_OVERLAY_ERROR:".length());handle.setText("3D rig error • close to retry");Log.e("NiaOverlay",status);}
    else if(message.messageLevel()==ConsoleMessage.MessageLevel.ERROR&&!"ready".equals(status)){status="error: "+message.message();handle.setText("3D rig error • close to retry");Log.e("NiaOverlay",status);}
    return true;
   }
  });
  floating.addView(web,new LinearLayout.LayoutParams(-1,0,1));
  LinearLayout controls=new LinearLayout(this);
  Button smaller=button("−",controls),larger=button("+",controls),close=button("Close",controls);
  smaller.setOnClickListener(v->resize(.85f));larger.setOnClickListener(v->resize(1.15f));close.setOnClickListener(v->stopSelf());floating.addView(controls);
  manager.addView(floating,params);
  mainHandler.postDelayed(loadTimeout,30000);
  web.loadUrl("https://nia-overlay.invalid/index.html");
 }
 private Button button(String label,LinearLayout parent){Button button=new Button(this);button.setText(label);parent.addView(button,new LinearLayout.LayoutParams(0,dp(44),1));return button;}
 private void resize(float factor){
  params.width=Math.max(dp(180),Math.min(screenWidth(),Math.round(params.width*factor)));
  params.height=Math.max(dp(280),Math.min(screenHeight()-dp(48),Math.round(params.height*factor)));
  params.x=Math.max(0,Math.min(screenWidth()-params.width,params.x));params.y=Math.max(0,Math.min(screenHeight()-params.height,params.y));manager.updateViewLayout(floating,params);
 }
 private WebResourceResponse assetResponse(Uri uri){
  String name=uri.getPath()==null?"":uri.getPath().replaceFirst("^/","");
  if(!"https".equals(uri.getScheme())||!"nia-overlay.invalid".equals(uri.getHost())||uri.getPort()!=-1||uri.getQuery()!=null||!ASSETS.contains(name))return denied();
  try{
   String mime=name.endsWith(".html")?"text/html":name.endsWith(".js")?"application/javascript":"model/gltf-binary";
   InputStream stream=getAssets().open("nia-overlay/"+name);
   return new WebResourceResponse(mime,name.endsWith(".glb")?null:"UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-store"),stream);
  }catch(Exception error){status="error: bundled overlay asset missing";return denied();}
 }
 private WebResourceResponse denied(){return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
 @Override public void onDestroy(){
  destroyed=true;mainHandler.removeCallbacks(loadTimeout);
  if(web!=null){web.stopLoading();web.onPause();web.loadUrl("about:blank");}
  if(floating!=null&&manager!=null){try{manager.removeViewImmediate(floating);}catch(Exception ignored){}}
  if(web!=null){web.removeAllViews();web.destroy();web=null;}
  floating=null;handle=null;params=null;manager=null;
  if(!status.startsWith("error")&&!status.startsWith("NIA_OVERLAY_ERROR"))status="hidden";
  stopForeground(true);super.onDestroy();
 }
}
