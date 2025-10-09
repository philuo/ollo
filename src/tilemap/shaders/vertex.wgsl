// Vertex shader for infinite canvas tilemap
struct Uniforms {
    viewMatrix: mat3x3f,
    gridSize: vec2f,
    gridConfig: vec4f,     // rows, cols, borderWidth, padding
    gridColor: vec4f,
    backgroundColor: vec4f,
}

struct VertexInput {
    @location(0) position: vec2f,        // Vertex position (-1 to 1)
    @location(1) gridCoord: vec2i,       // Grid coordinate (row, col)
    @location(2) instanceType: u32,      // 0=grid, 1=highlight, 2=background
}

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(0) gridCoord: vec2i,
    @location(1) instanceType: u32,
    @location(2) localPosition: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Calculate world position
    let gridSize = uniforms.gridSize;
    let borderSize = uniforms.gridConfig.z * 2.0; // Border width on both sides
    let cellSize = gridSize + borderSize;
    
    let worldX = f32(input.gridCoord.x) * cellSize + input.position.x * gridSize;
    let worldY = f32(input.gridCoord.y) * cellSize + input.position.y * gridSize;
    
    let worldPos = vec3f(worldX, worldY, 1.0);
    
    // Apply view transformation
    let transformedPos = uniforms.viewMatrix * worldPos;
    output.clipPosition = vec4f(transformedPos.xy, 0.0, 1.0);
    
    // Pass through varying data
    output.gridCoord = input.gridCoord;
    output.instanceType = input.instanceType;
    output.localPosition = input.position;
    
    return output;
}