// TextScrollBar.js
// @input Component.Text targetText {"label":"Text to Scroll"}
// @input Component.ScriptComponent containerFrame {"label":"Container Frame"}
// @input float scrollBarWidth = 0.5 {"label":"Scroll Bar Width (cm)", "min":0.1, "max":2.0}
// @input vec4 scrollBarColor = {0.7, 0.7, 0.7, 0.5} {"label":"Scroll Bar Color", "widget":"color"}
// @input vec4 scrollHandleColor = {1.0, 1.0, 1.0, 0.8} {"label":"Scroll Handle Color", "widget":"color"}
// @input Asset.Material defaultMaterial {"label":"Default Material (Optional)"}

// Simple logging function
function log(message) {
    print("[TextScrollBar] " + message);
}

// Track state
var textObject = null;
var textTransform = null;
var scrollBarObject = null;
var scrollHandleObject = null;
var scrollBarTransform = null;
var scrollHandleTransform = null;
var scrollBarVisual = null;
var scrollHandleVisual = null;
var containerObject = null;
var containerTransform = null;

// Scroll state
var isDragging = false;
var textHeight = 0;
var visibleHeight = 0;
var scrollPosition = 0;
var maxScrollPosition = 0;
var scrollBarHeight = 0;
var handleHeight = 0;
var lastTouchY = 0;

function onAwake() {
    if (!script.targetText) {
        log("Error: Target Text not assigned!");
        return;
    }
    
    if (!script.containerFrame) {
        log("Error: Container Frame not assigned!");
        return;
    }
    
    // Get objects and transforms
    textObject = script.targetText.getSceneObject();
    textTransform = textObject.getTransform();
    
    // Try to get container object through API
    try {
        if (script.containerFrame.api && script.containerFrame.api.getTargetObject) {
            containerObject = script.containerFrame.api.getTargetObject();
        } else {
            containerObject = script.containerFrame.getSceneObject();
        }
        containerTransform = containerObject.getTransform();
    } catch (e) {
        log("Error getting container: " + e);
        containerObject = textObject.getParent();
        containerTransform = containerObject.getTransform();
    }
    
    // Create scroll bar elements
    createScrollBar();
    
    // Calculate initial text metrics
    calculateTextMetrics();
    
    // Setup touch events
    setupTouchEvents();
    
    log("Text scroll bar initialized");
    
    // Update the scroll bar on container size changes
    if (script.containerFrame.api && script.containerFrame.api.onScalingUpdateEvent) {
        script.containerFrame.api.onScalingUpdateEvent.add(function() {
            calculateTextMetrics();
            updateScrollBarLayout();
        });
    }
}

function createScrollBar() {
    // Create scroll bar object
    scrollBarObject = global.scene.createSceneObject("TextScrollBar");
    scrollBarObject.setParent(containerObject);
    scrollBarTransform = scrollBarObject.getTransform();
    
    // Create a basic planar mesh for the scroll bar
    scrollBarVisual = scrollBarObject.createComponent("Component.RenderMeshVisual");
    
    // Use a quad mesh or plane shape
    var material = null;
    if (script.defaultMaterial) {
        material = script.defaultMaterial.clone();
    } else {
        // Use a basic material if no material is provided
        material = createBasicMaterial(script.scrollBarColor);
    }
    
    scrollBarVisual.mainMaterial = material;
    
    // Create a simple quad mesh visual
    var meshAsset = findPlaneOrQuadMesh();
    if (meshAsset) {
        scrollBarVisual.mesh = meshAsset;
    } else {
        log("Warning: Could not find a suitable mesh for the scroll bar");
    }
    
    // Create scroll handle object
    scrollHandleObject = global.scene.createSceneObject("ScrollHandle");
    scrollHandleObject.setParent(scrollBarObject);
    scrollHandleTransform = scrollHandleObject.getTransform();
    
    // Add visual component for scroll handle
    scrollHandleVisual = scrollHandleObject.createComponent("Component.RenderMeshVisual");
    
    // Use the same mesh but with different material
    if (meshAsset) {
        scrollHandleVisual.mesh = meshAsset;
    }
    
    // Create handle material
    var handleMaterial = null;
    if (script.defaultMaterial) {
        handleMaterial = script.defaultMaterial.clone();
        handleMaterial.mainPass.baseColor = script.scrollHandleColor;
    } else {
        handleMaterial = createBasicMaterial(script.scrollHandleColor);
    }
    
    scrollHandleVisual.mainMaterial = handleMaterial;
    
    // Position initially
    updateScrollBarLayout();
}

function findPlaneOrQuadMesh() {
    // Try to find a suitable mesh in the scene's resources
    var resources = global.scene.getAllResources();
    
    for (var i = 0; i < resources.length; i++) {
        var resource = resources[i];
        if (resource.getTypeName() === "Mesh") {
            // Look for meshes named "plane", "quad", or "square"
            var name = resource.name.toLowerCase();
            if (name.indexOf("plane") >= 0 || 
                name.indexOf("quad") >= 0 || 
                name.indexOf("square") >= 0) {
                return resource;
            }
        }
    }
    
    // If no suitable mesh was found, return null
    return null;
}

function createBasicMaterial(color) {
    // Create a new basic material with the given color
    var material = global.scene.createMaterial("Unlit");
    material.mainPass.baseColor = color;
    return material;
}

function calculateTextMetrics() {
    try {
        // Get text dimensions
        var textBounds = script.targetText.getBounds();
        textHeight = textBounds.max.y - textBounds.min.y;
        
        // Get container dimensions
        var containerInnerSize = null;
        if (script.containerFrame.api && script.containerFrame.api.innerSize) {
            containerInnerSize = script.containerFrame.api.innerSize;
            visibleHeight = containerInnerSize.y;
        } else {
            // Fallback if we can't get inner size from API
            visibleHeight = 40; // Default height in cm
        }
        
        // Calculate maximum scroll position
        maxScrollPosition = Math.max(0, textHeight - visibleHeight);
        
        log("Text height: " + textHeight + ", Visible height: " + visibleHeight);
    } catch (e) {
        log("Error calculating text metrics: " + e);
    }
}

function updateScrollBarLayout() {
    try {
        var containerInnerSize = null;
        var border = 7; // Default border
        
        if (script.containerFrame.api) {
            if (script.containerFrame.api.innerSize) {
                containerInnerSize = script.containerFrame.api.innerSize;
            }
            if (script.containerFrame.api.border !== undefined) {
                border = script.containerFrame.api.border;
            }
        }
        
        if (!containerInnerSize) {
            containerInnerSize = new vec2(40, 40); // Default fallback
        }
        
        // Calculate scroll bar dimensions
        scrollBarHeight = containerInnerSize.y;
        
        // Calculate handle size as proportion of total content
        var handleRatio = visibleHeight / textHeight;
        handleHeight = Math.max(scrollBarHeight * handleRatio, 5); // Minimum 5cm handle height
        
        // Position scroll bar at right edge of container
        scrollBarTransform.setLocalPosition(new vec3(
            containerInnerSize.x/2 - script.scrollBarWidth/2 - border/2,
            0,
            1
        ));
        
        // Scale the scroll bar
        scrollBarTransform.setLocalScale(new vec3(
            script.scrollBarWidth,
            scrollBarHeight,
            1
        ));
        
        // Scale the handle
        scrollHandleTransform.setLocalScale(new vec3(
            1,
            handleHeight / scrollBarHeight,
            1.1 // Slightly in front
        ));
        
        // Update handle position based on scroll position
        updateHandlePosition();
        
        log("Scroll bar layout updated");
    } catch (e) {
        log("Error updating scroll bar layout: " + e);
    }
}

function updateHandlePosition() {
    // Calculate normalized scroll position (0-1)
    var scrollRatio = maxScrollPosition > 0 ? scrollPosition / maxScrollPosition : 0;
    
    // Calculate handle position
    var handlePositionY = (scrollBarHeight - handleHeight) * -scrollRatio / 2;
    
    // Set handle position
    scrollHandleTransform.setLocalPosition(new vec3(0, handlePositionY, 0));
    
    // Update text position
    var textObj = script.targetText.getSceneObject();
    var textTransform = textObj.getTransform();
    textTransform.setLocalPosition(new vec3(
        textTransform.getLocalPosition().x,
        scrollPosition,
        textTransform.getLocalPosition().z
    ));
}

function setupTouchEvents() {
    // Touch start event for scroll handle
    var touchStartEvent = script.createEvent("TouchStartEvent");
    touchStartEvent.bind(function(eventData) {
        var touchPos = eventData.getTouchPosition();
        
        // Check if touch is on scroll handle
        // (This is a simple check - ideally we would do a proper hit test)
        lastTouchY = touchPos.y;
        isDragging = true;
    });
    
    // Touch move event for scrolling
    var touchMoveEvent = script.createEvent("TouchMoveEvent");
    touchMoveEvent.bind(function(eventData) {
        if (isDragging) {
            var touchPos = eventData.getTouchPosition();
            var deltaY = touchPos.y - lastTouchY;
            
            // Convert screen delta to scroll delta (invert direction)
            var scrollDelta = -deltaY * maxScrollPosition;
            
            // Apply scrolling
            scrollPosition = Math.max(0, Math.min(maxScrollPosition, scrollPosition + scrollDelta));
            
            // Update handle position
            updateHandlePosition();
            
            // Update last touch position
            lastTouchY = touchPos.y;
        }
    });
    
    // Touch end event
    var touchEndEvent = script.createEvent("TouchEndEvent");
    touchEndEvent.bind(function(eventData) {
        isDragging = false;
    });
}

// Clean up function
function onDestroy() {
    if (scrollBarObject) {
        scrollBarObject.destroy();
    }
}

var startEvent = script.createEvent("OnStartEvent");
startEvent.bind(onAwake);

var destroyEvent = script.createEvent("OnDestroyEvent");
destroyEvent.bind(onDestroy);