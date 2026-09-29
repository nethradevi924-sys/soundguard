package com.safesphere.soundguard;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SoundGuardPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
