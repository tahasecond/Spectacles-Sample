// ButtonController.js
// @input Component.ScriptComponent interactableScript {"label":"Interactable"}
// @input Component.ScriptComponent presentationSwitcher {"label":"PresentationSwitcher"}
// @input bool useNextButton = true {"label":"Is Next Button?"}

function onAwake() {
    if (!script.interactableScript) {
        print("❌ Error: No Interactable script assigned!");
        return;
    }
    
    if (!script.presentationSwitcher) {
        print("❌ Error: No PresentationSwitcher script assigned!");
        return;
    }
    
    print("🔗 Setting up button navigation controller");
    
    // Try to connect to the Interactable's events with error handling
    try {
        // Connect to the onTriggerStart event
        if (script.interactableScript.onTriggerStart && 
            typeof script.interactableScript.onTriggerStart.add === 'function') {
            
            script.interactableScript.onTriggerStart.add(function(eventArgs) {
                if (script.useNextButton) {
                    print("▶️ Next button pressed");
                    goToNextSlide();
                } else {
                    print("◀️ Previous button pressed");
                    goToPreviousSlide();
                }
            });
            print("✅ Successfully connected to button's trigger event");
        } else {
            print("❓ Couldn't find expected event interface. Checking alternatives...");
            
            // Check if event is accessible through api property
            if (script.interactableScript.api && 
                script.interactableScript.api.onTriggerStart && 
                typeof script.interactableScript.api.onTriggerStart.add === 'function') {
                
                script.interactableScript.api.onTriggerStart.add(function(eventArgs) {
                    if (script.useNextButton) {
                        print("▶️ Next button pressed");
                        goToNextSlide();
                    } else {
                        print("◀️ Previous button pressed");
                        goToPreviousSlide();
                    }
                });
                print("✅ Successfully connected to button's trigger event through API");
            } else {
                print("❌ Could not find suitable event to connect to on the Interactable");
                print("Available properties: " + Object.keys(script.interactableScript).join(", "));
                if (script.interactableScript.api) {
                    print("API properties: " + Object.keys(script.interactableScript.api).join(", "));
                }
            }
        }
    } catch (e) {
        print("❌ Error connecting to Interactable: " + e);
    }
}

function goToNextSlide() {
    if (script.presentationSwitcher && script.presentationSwitcher.api &&
        typeof script.presentationSwitcher.api.next === 'function') {
        script.presentationSwitcher.api.next();
    } else {
        print("❌ Could not call next() method on PresentationSwitcher");
    }
}

function goToPreviousSlide() {
    if (script.presentationSwitcher && script.presentationSwitcher.api &&
        typeof script.presentationSwitcher.api.previous === 'function') {
        script.presentationSwitcher.api.previous();
    } else {
        print("❌ Could not call previous() method on PresentationSwitcher");
    }
}

// Call onAwake when the script starts
var startEvent = script.createEvent("OnStartEvent");
startEvent.bind(onAwake);