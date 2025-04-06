//@input Asset.RemoteServiceModule remoteServiceModule
//@input Asset.RemoteMediaModule remoteMediaModule
//@input Component.Image slideImage
//@input Component.Text speakerNotes
//@input Component.ScriptComponent webSocketController

var imageUrls = [];
var textBlocks = [];
var currentIndex = 0;

// Expose the functions on script.api
script.api.next = next;
script.api.previous = previous;


function fetchSlides() {
    var url = "https://ar-notes-backend-immersegt-eddf3c030982.herokuapp.com/upload_notes_result";
    var request = new Request(url, { method: "GET" });

    script.remoteServiceModule.fetch(request).then(function (response) {
        if (response.status !== 200) {
            print("❌ Failed to fetch slides, status: " + response.status);
            return;
        }
        return response.json();
    }).then(function (data) {
        if (!data) return;

        imageUrls = data.images;
        textBlocks = data.texts;

        if (imageUrls.length === 0) {
            print("⚠️ No images found in API response");
            return;
        }

        print("✅ Loaded " + imageUrls.length + " slides from API");
        loadSlide(currentIndex);
    }).catch(function (error) {
        print("❌ Error fetching slide data: " + error);
    });
}

function loadSlide(index) {
    if (index < 0 || index >= imageUrls.length) {
        print("❌ Invalid slide index: " + index);
        return;
    }

    var imageUrl = imageUrls[index];
    var resource = script.remoteServiceModule.makeResourceFromUrl(imageUrl);

    script.remoteMediaModule.loadResourceAsImageTexture(
        resource,
        function (texture) {
            script.slideImage.mainMaterial.mainPass.baseTex = texture;
            print("🖼️ Slide " + (index + 1) + " image loaded");
        },
        function (error) {
            print("❌ Error loading slide image: " + error);
        }
    );

    // Load speaker notes
    if (textBlocks[index]) {
        script.speakerNotes.text = textBlocks[index];
        print("📄 Slide " + (index + 1) + " notes loaded");
    } else {
        script.speakerNotes.text = "No speaker notes";
    }

    currentIndex = index;
}

// Exposed to other scripts via script.api
function next() {
    if (currentIndex < imageUrls.length - 1) {
        currentIndex++;
        loadSlide(currentIndex);
        // If you want to notify WebSocket
        if (script.webSocketController && script.webSocketController.api.next) {
            script.webSocketController.api.next();
        }
    }
}

function previous() {
    if (currentIndex > 0) {
        currentIndex--;
        loadSlide(currentIndex);
        // If you want to notify WebSocket
        if (script.webSocketController && script.webSocketController.api.previous) {
            script.webSocketController.api.previous();
        }
    }
}

var startEvent = script.createEvent("OnStartEvent");
startEvent.bind(function () {
    print("🚀 Starting Heroku Slide Bridge");
    fetchSlides();
});

// Optional WebSocket sync handling (receiving commands)
var updateEvent = script.createEvent("UpdateEvent");
updateEvent.bind(function () {
    if (!script.webSocketController || !script.webSocketController.api) return;

    if (script.webSocketController.api.wasNextCommandReceived) {
        if (script.webSocketController.api.wasNextCommandReceived(0)) {
            script.webSocketController.api.clearLastCommand();
            next();
        }
    }

    if (script.webSocketController.api.wasPreviousCommandReceived) {
        if (script.webSocketController.api.wasPreviousCommandReceived(0)) {
            script.webSocketController.api.clearLastCommand();
            previous();
        }
    }
});
