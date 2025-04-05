// -----------------------------------------------------------------------
// SoftPressController.js (Plain JS, replicating the TS version)
// -----------------------------------------------------------------------
//
// JSDoc @input lines define the Inspector fields. They become 
// "script.colliderObject", "script.googleSlideBridge", etc., in code.
//
// If your environment doesn't have exactly these physics events
// ("onOverlapEnter", "onOverlapStay", "onOverlapExit") or if `.add(...)` 
// doesn't exist, see notes at the bottom.
//
// -----------------------------------------------------------------------

// @input SceneObject colliderObject         {"label":"Collider Object","hint":"Has a Physics.ColliderComponent"}
// @input SceneObject interactorObject       {"label":"Interactor Object","hint":"Finger tip or other pressing object"}
// @input SceneObject closestPointMarker     {"label":"Debug Marker","allowUndefined":true,"hint":"Optional marker to show press depth"}

// @input SceneObject topVertex0  {"label":"Top Vertex 0"}
// @input SceneObject topVertex1  {"label":"Top Vertex 1"}
// @input SceneObject topVertex2  {"label":"Top Vertex 2"}
// @input SceneObject topVertex3  {"label":"Top Vertex 3"}

// @input SceneObject bottomVertex0  {"label":"Bottom Vertex 0"}
// @input SceneObject bottomVertex1  {"label":"Bottom Vertex 1"}
// @input SceneObject bottomVertex2  {"label":"Bottom Vertex 2"}
// @input SceneObject bottomVertex3  {"label":"Bottom Vertex 3"}

// @input float pressThreshold = 0.7  {"label":"Press Threshold (0..1)"}
// @input float resetDuration = 1.0   {"label":"Reset Duration (sec)"}

// @input SceneObject presentationSwitcher  {"label":"Local Slide Switcher","hint":"Script with .api.next/.api.previous"}
// @input SceneObject googleSlideBridge    {"label":"GoogleSlideBridge Obj","hint":"Optional for Google Slide API"}

// @input bool next = false           {"label":"If true, triggers 'next' slide when pressed"}
// @input bool useGoogleSlide = false {"label":"Use Google Slide Bridge?"}


// -----------------------------------------------------------------------
// Require any needed modules for logging, math, etc.
// -----------------------------------------------------------------------
var NativeLogger = require("../../SpectaclesInteractionKit/Utils/NativeLogger").default;
var log = new NativeLogger("SoftPressController");

var mix = require("../../SpectaclesInteractionKit/Utils/animate").mix;
var clamp = require("../../SpectaclesInteractionKit/Utils/mathUtils").clamp;

// -----------------------------------------------------------------------
// Internal state variables
// -----------------------------------------------------------------------
var colliderComp = null;
var isInteracting = false;
var pressValue = 0;
var hasTriggeredEvent = false;
var isResetting = false;
var resetProgress = 0;

var localTop = new vec3(0, 0, 0);
var localBottom = new vec3(0, 0, 0);
var lastClosestPointLocal = new vec3(0, 0, 0);
var activeOverlapId = null; // track which overlap belongs to the interactor

// -----------------------------------------------------------------------
// Create events in the global script. This is how Lens Studio sees the script.
// -----------------------------------------------------------------------
script.createEvent("OnStartEvent").bind(onStart);
script.createEvent("UpdateEvent").bind(onUpdate);

// -----------------------------------------------------------------------
// onStart() - similar to onAwake/onStart in the TS version
// -----------------------------------------------------------------------
function onStart() {
    log.d("[SoftPressController] onStart triggered.");

    // 1) Get the collider component
    if (!script.colliderObject) {
        log.e("No colliderObject assigned in Inspector!");
        return;
    }
    colliderComp = script.colliderObject.getComponent("Physics.ColliderComponent");
    if (!colliderComp) {
        log.e("colliderObject has no Physics.ColliderComponent!");
        return;
    }

    // 2) Average the top/bottom vertices in world space
    var topPositions = [
        script.topVertex0.getTransform().getWorldPosition(),
        script.topVertex1.getTransform().getWorldPosition(),
        script.topVertex2.getTransform().getWorldPosition(),
        script.topVertex3.getTransform().getWorldPosition()
    ];
    var bottomPositions = [
        script.bottomVertex0.getTransform().getWorldPosition(),
        script.bottomVertex1.getTransform().getWorldPosition(),
        script.bottomVertex2.getTransform().getWorldPosition(),
        script.bottomVertex3.getTransform().getWorldPosition()
    ];

    var worldTop = averagePositions(topPositions).uniformScale(1);
    var worldBottom = averagePositions(bottomPositions).uniformScale(1);

    // Convert to local space
    var colliderTransform = script.colliderObject.getTransform();
    var invWorld = colliderTransform.getInvertedWorldTransform();
    localTop = invWorld.multiplyPoint(worldTop);
    localBottom = invWorld.multiplyPoint(worldBottom);

    pressValue = 0;
    lastClosestPointLocal = localTop;

    // 3) Set up overlap event callbacks (like TS version)
    //    If .add(...) fails, see note below for .bind(...) / .subscribe(...)
    colliderComp.onOverlapEnter.add(function(e) {
        var overlap = e.overlap;
        if (!script.interactorObject) { return; }
        if (overlap.collider.getSceneObject() === script.interactorObject) {
            // Check if we are "entering from top"
            if (isEnteringFromTop()) {
                log.d("OverlapEnter(" + overlap.id + "): Interactor from top -> Start press");
                isInteracting = true;
                isResetting = false;
                resetProgress = 0;
                activeOverlapId = overlap.id;
            } else {
                log.d("OverlapEnter(" + overlap.id + "): Not from top -> ignore");
            }
        }
    });

    colliderComp.onOverlapStay.add(function(e) {
        var overlap = e.overlap;
        if (!script.interactorObject) { return; }
        if (overlap.collider.getSceneObject() === script.interactorObject &&
            isInteracting &&
            overlap.id === activeOverlapId) {
            log.d("OverlapStay(" + overlap.id + "): continuing press");
            calculatePressValue();
        }
    });

    colliderComp.onOverlapExit.add(function(e) {
        var overlap = e.overlap;
        if (!script.interactorObject) { return; }
        if (overlap.collider.getSceneObject() === script.interactorObject &&
            overlap.id === activeOverlapId) {
            log.d("OverlapExit(" + overlap.id + "): Interactor exited -> start reset");
            isInteracting = false;
            isResetting = true;
            resetProgress = 0;
            activeOverlapId = null;
        }
    });
}

// -----------------------------------------------------------------------
// onUpdate() - called every frame. Similar to TS's update()
// -----------------------------------------------------------------------
function onUpdate() {
    if (isInteracting) {
        calculatePressValue();
    }
    if (isResetting) {
        smoothReset();
    }
}

// -----------------------------------------------------------------------
// isEnteringFromTop()
// -----------------------------------------------------------------------
function isEnteringFromTop() {
    if (!script.interactorObject || !script.colliderObject) { return false; }

    var interactorPos = script.interactorObject.getTransform().getWorldPosition();
    var colliderPos = script.colliderObject.getTransform().getWorldPosition();
    var colliderUp = script.colliderObject.getTransform().up; // local up in world

    var dirToInteractor = interactorPos.sub(colliderPos).normalize();
    var dotVal = dirToInteractor.dot(colliderUp);

    // If dotVal is > 0.5, we consider it "from top"
    return (dotVal > 0.5);
}

// -----------------------------------------------------------------------
// calculatePressValue() - same as TS, projecting interactor along top->bottom
// -----------------------------------------------------------------------
function calculatePressValue() {
    if (!script.interactorObject || !script.colliderObject) { return; }

    var interactorPos = script.interactorObject.getTransform().getWorldPosition();
    var colliderTransform = script.colliderObject.getTransform();
    var invWorld = colliderTransform.getInvertedWorldTransform();

    // Rebuild world positions
    var worldT = colliderTransform.getWorldTransform().multiplyPoint(localTop);
    var worldB = colliderTransform.getWorldTransform().multiplyPoint(localBottom);

    var topToBottom = worldB.sub(worldT);
    var topToInteractor = interactorPos.sub(worldT);

    var ratio = clamp(
        topToInteractor.dot(topToBottom) / topToBottom.dot(topToBottom),
        0, 1
    );

    var closestPtWorld = worldT.add(topToBottom.scale(new vec3(ratio, ratio, ratio)));
    var closestPtLocal = invWorld.multiplyPoint(closestPtWorld);
    lastClosestPointLocal = closestPtLocal;

    // convert to pressValue [0..1]
    var localVec = localBottom.sub(localTop);
    var topToClosest = closestPtLocal.sub(localTop);
    var projLen = topToClosest.dot(localVec.normalize());
    var totalLen = localVec.length;
    pressValue = clamp(projLen / totalLen, 0, 1);

    log.d("Press value: " + pressValue.toFixed(3));

    // optional debug marker
    if (script.closestPointMarker) {
        script.closestPointMarker.getTransform().setWorldPosition(closestPtWorld);
    }

    // threshold check
    if (pressValue >= script.pressThreshold && !hasTriggeredEvent) {
        onPressThresholdReached();
        hasTriggeredEvent = true;
    }
    if (pressValue <= 0 && hasTriggeredEvent) {
        log.d("Press reset to 0 -> can trigger again");
        hasTriggeredEvent = false;
    }
}

// -----------------------------------------------------------------------
// smoothReset() - linearly interpolate from lastClosestPointLocal -> localTop
// -----------------------------------------------------------------------
function smoothReset() {
    resetProgress += getDeltaTime() / script.resetDuration;
    resetProgress = clamp(resetProgress, 0, 1);

    var interpLocal = mix(lastClosestPointLocal, localTop, resetProgress);

    var localVec = localBottom.sub(localTop);
    var topToCurrent = interpLocal.sub(localTop);
    var projLen = topToCurrent.dot(localVec.normalize());
    var totalLen = localVec.length;
    pressValue = clamp(projLen / totalLen, 0, 1);

    if (script.closestPointMarker) {
        var colliderTransform = script.colliderObject.getTransform();
        var interpWorld = colliderTransform.getWorldTransform().multiplyPoint(interpLocal);
        script.closestPointMarker.getTransform().setWorldPosition(interpWorld);
    }

    if (pressValue <= 0 && hasTriggeredEvent) {
        log.d("Press reset to 0 -> re-arm the event");
        hasTriggeredEvent = false;
    }

    if (resetProgress >= 1) {
        isResetting = false;
        resetProgress = 0;
        pressValue = 0;
        lastClosestPointLocal = localTop;
        log.d("Smooth reset complete.");
    }
}

// -----------------------------------------------------------------------
// onPressThresholdReached() - either go next or previous
// -----------------------------------------------------------------------
function onPressThresholdReached() {
    log.d("Press threshold reached -> trigger event");
    if (script.next) {
        navigateToNext();
    } else {
        navigateToPrevious();
    }
}

// -----------------------------------------------------------------------
// navigateToNext() and navigateToPrevious() - calls local or google slides
// -----------------------------------------------------------------------
function navigateToNext() {
    // 1) local
    if (script.presentationSwitcher && !script.useGoogleSlide) {
        var presScript = script.presentationSwitcher.getComponent("Component.ScriptComponent");
        if (presScript && presScript.api && typeof presScript.api.next === "function") {
            presScript.api.next();
        }
    }

    // 2) googleSlideBridge
    if (script.googleSlideBridge && script.useGoogleSlide) {
        var gsbScript = script.googleSlideBridge.getComponent("Component.ScriptComponent");
        if (gsbScript && gsbScript.api && typeof gsbScript.api.next === "function") {
            gsbScript.api.next();
        }
    }

    log.d("Going to next slide.");
}

function navigateToPrevious() {
    if (script.presentationSwitcher && !script.useGoogleSlide) {
        var presScript = script.presentationSwitcher.getComponent("Component.ScriptComponent");
        if (presScript && presScript.api && typeof presScript.api.previous === "function") {
            presScript.api.previous();
        }
    }

    if (script.googleSlideBridge && script.useGoogleSlide) {
        var gsbScript = script.googleSlideBridge.getComponent("Component.ScriptComponent");
        if (gsbScript && gsbScript.api && typeof gsbScript.api.previous === "function") {
            gsbScript.api.previous();
        }
    }

    log.d("Going to previous slide.");
}

// -----------------------------------------------------------------------
// averagePositions() - helper to average an array of vec3
// -----------------------------------------------------------------------
function averagePositions(posArray) {
    if (!posArray || posArray.length === 0) {
        return vec3.zero();
    }
    var sum = vec3.zero();
    for (var i = 0; i < posArray.length; i++) {
        sum = sum.add(posArray[i]);
    }
    return sum.uniformScale(1.0 / posArray.length);
}

