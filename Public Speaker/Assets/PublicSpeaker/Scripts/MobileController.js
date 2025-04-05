// ----------------------------------------------------------------------
// MobileController.js - Plain JS version of the original MobileController.ts
// ----------------------------------------------------------------------

// 1) Require the SIK and your logger
var SIK = require("../../SpectaclesInteractionKit/SIK").SIK;
var NativeLogger = require("../../SpectaclesInteractionKit/Utils/NativeLogger").default;
var log = new NativeLogger("MobileController");

// 2) JSDoc-style inputs for the Lens Studio Inspector
//    These become script.presentationSwitcherObj, script.googleSlideBridgeObj, etc.

// @input SceneObject presentationSwitcherObj {"label":"Presentation Switcher","hint":"SceneObject with a script.api.next/previous"}
// @input SceneObject googleSlideBridgeObj    {"label":"GoogleSlideBridge Object","hint":"(Optional) for Google Slides"}
// @input bool useGoogleSlide = false         {"label":"Use Google Slide Bridge?"}


// 3) Setup onStart event
script.createEvent("OnStartEvent").bind(onStart);

// ----------------------------------------------------------------------
// onStart(): Equivalent to the old onAwake/onStart in your TypeScript class
// ----------------------------------------------------------------------
function onStart() {
    log.d("[MobileController] onStart triggered.");

    // Retrieve MobileInputData from SIK definitions
    var mobileInputData = SIK.MobileInputData;
    // Fetch the MotionController for the phone
    var motionController = mobileInputData.motionController;
    
    // The line below is EXACTLY like your TS version, but in JS:
    motionController.onTouchEvent.add(function(normalizedPosition, touchId, timestampMs, phase) {
        // Wait until the touch is finished (Ended phase)
        if (phase !== MotionController.TouchPhase.Ended) {
            return;
        }

        // Left half => previous, right half => next
        if (normalizedPosition.x < 0.5) {
            log.d("Previous slide");
            navigateToPrevious();
        } else {
            log.d("Next slide");
            navigateToNext();
        }
    });
}

// ----------------------------------------------------------------------
// navigateToNext() / navigateToPrevious(): same logic, but in JS
// ----------------------------------------------------------------------
function navigateToNext() {
    // 1) Local presentation switcher (if user doesn't want Google Slides)
    if (script.presentationSwitcherObj && !script.useGoogleSlide) {
        var presScript = script.presentationSwitcherObj.getComponent("Component.ScriptComponent");
        if (presScript && presScript.api && typeof presScript.api.next === "function") {
            presScript.api.next();
        }
    }

    // 2) Google Slides
    if (script.googleSlideBridgeObj && script.useGoogleSlide) {
        var gsbScript = script.googleSlideBridgeObj.getComponent("Component.ScriptComponent");
        if (gsbScript && gsbScript.api && typeof gsbScript.api.next === "function") {
            gsbScript.api.next();
        }
    }
}

function navigateToPrevious() {
    // 1) Local presentation switcher
    if (script.presentationSwitcherObj && !script.useGoogleSlide) {
        var presScript = script.presentationSwitcherObj.getComponent("Component.ScriptComponent");
        if (presScript && presScript.api && typeof presScript.api.previous === "function") {
            presScript.api.previous();
        }
    }

    // 2) Google Slides
    if (script.googleSlideBridgeObj && script.useGoogleSlide) {
        var gsbScript = script.googleSlideBridgeObj.getComponent("Component.ScriptComponent");
        if (gsbScript && gsbScript.api && typeof gsbScript.api.previous === "function") {
            gsbScript.api.previous();
        }
    }
}
