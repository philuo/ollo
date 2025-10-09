// Fragment shader for infinite canvas tilemap
struct FragmentInput {
    @location(0) gridCoord: vec2i,
    @location(1) instanceType: u32,
    @location(2) localPosition: vec2f,
}

struct FragmentOutput {
    @location(0) color: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn fs_main(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    
    let gridSize = uniforms.gridSize;
    let borderWidth = uniforms.gridConfig.z;
    let borderSize = borderWidth * 2.0;
    let cellSize = gridSize + borderSize;
    
    // Local position within the grid cell (0 to 1)
    let localPos = (input.localPosition + 1.0) * 0.5;
    
    if (input.instanceType == 0u) {
        // Grid cell rendering
        let borderThreshold = borderWidth / cellSize;
        
        // Check if we're on the border
        let onBorder = (localPos.x < borderThreshold) || 
                      (localPos.x > (1.0 - borderThreshold)) ||
                      (localPos.y < borderThreshold) || 
                      (localPos.y > (1.0 - borderThreshold));
        
        if (onBorder) {
            output.color = uniforms.gridColor;
        } else {
            output.color = uniforms.backgroundColor;
        }
    } else if (input.instanceType == 1u) {
        // Highlight rendering
        let highlightColor = vec4f(0.2, 0.6, 1.0, 0.5); // Light blue with transparency
        output.color = highlightColor;
    } else {
        // Background rendering
        output.color = uniforms.backgroundColor;
    }
    
    return output;
}