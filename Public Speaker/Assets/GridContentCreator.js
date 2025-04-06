// @input SceneObject customFileBridgeObj {"label":"Custom File Bridge Object"}
// @input Component.Text textDisplay {"label":"Text Component to Show Current Page"}

function updateTextFromBridge() {
    if (!script.customFileBridgeObj || !script.textDisplay) {
        print("❌ Missing input references (customFileBridgeObj or textDisplay)");
        return;
    }

    var bridgeScript = script.customFileBridgeObj.getComponent("Component.ScriptComponent");
    if (!bridgeScript || !bridgeScript.api) {
        print("❌ customFileBridgeObj does not have a valid script component with .api");
        return;
    }

    // Expecting a method like .getCurrentText() in CustomFileBridge
    if (typeof bridgeScript.api.getCurrentText === "function") {
        var currentText = bridgeScript.api.getCurrentText();
        script.textDisplay.text = currentText || "No text available.";
        print("📖 Loaded text from CustomFileBridge: " + currentText);
    } else {
        print("❌ customFileBridgeObj.api.getCurrentText() is not available.");
    }
}

// Run it once on start
script.createEvent("OnStartEvent").bind(function() {
    updateTextFromBridge();
});
