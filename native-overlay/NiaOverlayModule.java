package com.nia.companion;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.Gravity;
import android.content.res.Configuration;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
public class NiaOverlayModule extends ReactContextBaseJavaModule {
 private final ReactApplicationContext context;
 private WindowManager manager;
 private View floating;
 private WindowManager.LayoutParams params;
 public NiaOverlayModule(ReactApplicationContext context){super(context);this.context=context;}
 @Override public String getName(){return "NiaOverlay";}
 @ReactMethod public void hasPermission(Promise promise){promise.resolve(Build.VERSION.SDK_INT>=23&&Settings.canDrawOverlays(context));}
 @ReactMethod public void requestPermission(Promise promise){
  if(Build.VERSION.SDK_INT<23){promise.resolve(true);return;}
  if(Settings.canDrawOverlays(context)){promise.resolve(true);return;}
  Activity activity=getCurrentActivity();
  if(activity==null){promise.reject("NO_ACTIVITY","Open Nia before requesting overlay permission");return;}
  Intent intent=new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+context.getPackageName()));
  activity.startActivity(intent);
  promise.resolve(false);
 }
 @ReactMethod public void show(Promise promise){
  if(Build.VERSION.SDK_INT<23||!Settings.canDrawOverlays(context)){promise.reject("NO_PERMISSION","Allow display over other apps in Android settings");return;}
  Activity activity=getCurrentActivity();
  if(activity==null){promise.reject("NO_ACTIVITY","Open Nia to start the overlay");return;}
  activity.runOnUiThread(()->{
   try{
    hideInternal();
    manager=(WindowManager)context.getSystemService(Context.WINDOW_SERVICE);
    int width=context.getResources().getDisplayMetrics().widthPixels;
    int height=context.getResources().getDisplayMetrics().heightPixels;
    params=new WindowManager.LayoutParams(Math.max(180,width/2),Math.max(240,height/2),Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,PixelFormat.TRANSLUCENT);
    params.gravity=Gravity.TOP|Gravity.START;params.x=width/4;params.y=height/4;
    LinearLayout panel=new LinearLayout(context);panel.setOrientation(LinearLayout.VERTICAL);panel.setPadding(14,14,14,14);
    GradientDrawable bg=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{Color.rgb(62,34,69),Color.rgb(25,16,35)});bg.setCornerRadius(24);panel.setBackground(bg);
    TextView title=new TextView(context);title.setText("Nia • Floating Companion");title.setTextColor(Color.WHITE);title.setTextSize(16);panel.addView(title);
    TextView avatar=new TextView(context);avatar.setText("NIA");avatar.setTextSize(52);avatar.setTextColor(Color.WHITE);avatar.setGravity(Gravity.CENTER);panel.addView(avatar,new LinearLayout.LayoutParams(-1,0,1));
    LinearLayout controls=new LinearLayout(context);
    Button minimize=new Button(context);minimize.setText("−");controls.addView(minimize,new LinearLayout.LayoutParams(0,-2,1));
    Button close=new Button(context);close.setText("×");controls.addView(close,new LinearLayout.LayoutParams(0,-2,1));panel.addView(controls);
    minimize.setOnClickListener(v->{boolean compact=avatar.getVisibility()==View.VISIBLE;avatar.setVisibility(compact?View.GONE:View.VISIBLE);params.height=compact?WindowManager.LayoutParams.WRAP_CONTENT:Math.max(240,height/2);manager.updateViewLayout(panel,params);});
    close.setOnClickListener(v->hideInternal());
    avatar.setOnClickListener(v->{Intent launch=context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());if(launch!=null){launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);context.startActivity(launch);}});
    title.setOnTouchListener(new View.OnTouchListener(){float startX,startY;int initialX,initialY;
     @Override public boolean onTouch(View v,MotionEvent e){
      if(e.getAction()==MotionEvent.ACTION_DOWN){startX=e.getRawX();startY=e.getRawY();initialX=params.x;initialY=params.y;return true;}
      if(e.getAction()==MotionEvent.ACTION_MOVE){params.x=initialX+(int)(e.getRawX()-startX);params.y=initialY+(int)(e.getRawY()-startY);manager.updateViewLayout(panel,params);return true;}
      return e.getAction()==MotionEvent.ACTION_UP;
     }});
    floating=panel;manager.addView(floating,params);promise.resolve(true);
   }catch(Exception e){hideInternal();promise.reject("OVERLAY_ERROR",e);}
  });
 }
 private void hideInternal(){if(floating!=null&&manager!=null){try{manager.removeViewImmediate(floating);}catch(Exception ignored){}floating=null;}params=null;}
 @ReactMethod public void hide(Promise promise){Activity activity=getCurrentActivity();if(activity!=null)activity.runOnUiThread(()->{hideInternal();promise.resolve(true);});else{hideInternal();promise.resolve(true);}}
}
