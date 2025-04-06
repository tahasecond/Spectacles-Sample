//@input Component.RenderMeshVisual renderMesh
//@input Component.Transform transform

// UI Configurable Inputs
//@input vec2 innerSize = {"label":"Inner Size", "default": {"x": 32, "y": 32}}
//@input float border = 7.0
//@input vec2 constantPadding = {"label":"Padding", "default": {"x": 0.0, "y": 0.0}}

// Constants
var scaleFactor = 50;
var magicScalar = 0.1213592233;
var scaleZ = 1;
var zScaleAdjuster = 15;

// Initialization
var currentBorder = script.border;
var targetSize = script.innerSize;
var lastPadding = script.constantPadding.uniformScale(1);

function updateVisuals() {
    if (!script.renderMesh || !script.renderMesh.mainMaterial) {
        print("ResizableContainer: Missing RenderMesh or material");
        return;
    }

    var mat = script.renderMesh.mainMaterial;

    var doubleMargin = currentBorder * 2;
    var meshEdges = scaleFactor * magicScalar;

    mat.mainPass.frameMargin = currentBorder;
    mat.mainPass.scaleFactor = scaleFactor;
    mat.mainPass.scaleZ = scaleZ / zScaleAdjuster;

    mat.mainPass.scaleX = targetSize.x + doubleMargin - meshEdges + script.constantPadding.x;
    mat.mainPass.scaleY = targetSize.y + doubleMargin - meshEdges + script.constantPadding.y;
    mat.mainPass.rawScale = new vec2(targetSize.x + script.constantPadding.x, targetSize.y + script.constantPadding.y);

    var fullScale = new vec2(
        targetSize.x + script.constantPadding.x + doubleMargin,
        targetSize.y + script.constantPadding.y + doubleMargin
    );
    mat.mainPass.fullScale = fullScale;

    var aspectRatio = new vec2(1, 1);
    if (fullScale.x > fullScale.y) {
        aspectRatio.y = fullScale.x / fullScale.y;
    } else {
        aspectRatio.x = fullScale.y / fullScale.x;
    }
    mat.mainPass.aspectRatio = aspectRatio;

    mat.mainPass.originalScale = new vec2(targetSize.x + currentBorder, targetSize.y + currentBorder);

    script.transform.setLocalScale(new vec3(scaleFactor + magicScalar, scaleFactor + magicScalar, scaleZ * zScaleAdjuster));
}

// Expose API to update size externally
script.api.setSize = function (newSize) {
    targetSize = newSize;
    updateVisuals();
};

// Initial draw
updateVisuals();
