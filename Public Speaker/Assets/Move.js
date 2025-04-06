//@input Component.ScreenTransform screenTransform

var isDragging = false;

function onTouchStart(eventData) {
    isDragging = true;
}

function onTouchEnd(eventData) {
    isDragging = false;
}

function onTouchMove(eventData) {
    if (isDragging) {
        var touchPos = eventData.getTouchPosition();
        script.screenTransform.position = touchPos;
    }
}

script.createEvent("TouchStartEvent").bind(onTouchStart);
script.createEvent("TouchEndEvent").bind(onTouchEnd);
script.createEvent("TouchMoveEvent").bind(onTouchMove);