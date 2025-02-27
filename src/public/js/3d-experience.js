import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 0, 50);

// Add environment map for better reflections
const envMapIntensity = 0.8;
const envMapTexture = new THREE.TextureLoader().load('/3d-assets/floor/1K-woodparquet_18_ambientocclusion.jpg', function(texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
});

// Set a helper text element to inform users about the room
document.getElementById('info').textContent = 'You are in a hexagonal room. Use WASD to move and mouse to look around.';

// Wall dimensions
const wallWidth = 5;
const wallHeight = 4.5; // Increased from 3 to 4.5
const wallThickness = 0.2;

// Materials (defining the basic structure first, we'll add textures later)
const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xA67D3D, // Use a visible sandstone color instead of relying on textures
    roughness: 0.7,
    metalness: 0.3,
    side: THREE.DoubleSide // Ensure walls are visible from both sides
});

// Hexagonal room configuration
const roomRadius = 5; // Distance from center to each vertex
const roomHeight = 4.5; // Increased from 3 to 4.5 (Height of room from floor to ceiling)

// Door configuration
const doorWidth = 1.8;
const doorHeight = 2.5; // Increased from 2.2 to 2.5
const doorColor = 0x4169E1; // Royal blue for doors

// Define room mapping system using axial coordinates (q,r)
// Where (0,0) is the center room
const rooms = new Map();
const currentRoom = { q: 0, r: 0 };
let maxRing = 5; // Maximum ring number for exploration

// Track visited rooms and their door placements
const visitedRooms = new Map();
// Format: Map<"q,r", { doors: [wallIndex1, wallIndex2], neighbors: Map<wallIndex, {q,r}> }>

// Single room reference - we'll only have one physical room
let singleRoom = null;

// Portal effect
const portalEffect = {
    active: false,
    duration: 0.5, // seconds
    timer: 0,
    startQ: 0,
    startR: 0,
    targetQ: 0,
    targetR: 0,
    exitWall: null,
    entryWall: null
};

// Door material
const doorMaterial = new THREE.MeshStandardMaterial({
    color: doorColor,
    roughness: 0.4,
    metalness: 0.3
});

// Door frame material
const doorFrameMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B0000, // Dark red for door frames
    roughness: 0.5,
    metalness: 0.2
});

// Portal effect material
const portalMaterial = new THREE.MeshBasicMaterial({
    color: 0xFFFFFF,
    transparent: true,
    opacity: 0
});

// Load floor textures
const textureLoader = new THREE.TextureLoader();
const floorTextures = {
    baseColor: textureLoader.load('/3d-assets/floor/1K-woodparquet_18_basecolor.jpg'),
    normal: textureLoader.load('/3d-assets/floor/1K-woodparquet_18_normal.jpg'),
    roughness: textureLoader.load('/3d-assets/floor/1K-woodparquet_18_roughness.jpg'),
    metallic: textureLoader.load('/3d-assets/floor/1K-woodparquet_18_metallic.jpg'),
    ao: textureLoader.load('/3d-assets/floor/1K-woodparquet_18_ambientocclusion.jpg'),
    height: textureLoader.load('/3d-assets/floor/1K-woodparquet_18_height.jpg')
};

// Now load wall textures after textureLoader is defined
const wallTextures = {
    baseColor: textureLoader.load('/3d-assets/walls/1K-ceramic_decorative_6-diffuse.jpg', 
        texture => console.log('Wall baseColor texture loaded successfully'),
        null,
        error => console.error('Error loading wall baseColor texture:', error)),
    normal: textureLoader.load('/3d-assets/walls/1K-ceramic_decorative_6-normal.jpg',
        texture => console.log('Wall normal texture loaded successfully'),
        null,
        error => console.error('Error loading wall normal texture:', error)),
    roughness: textureLoader.load('/3d-assets/walls/1K-ceramic_decorative_6-specular.jpg',
        texture => console.log('Wall roughness texture loaded successfully'),
        null,
        error => console.error('Error loading wall roughness texture:', error)),
    ao: textureLoader.load('/3d-assets/walls/1K-ceramic_decorative_6-ao.jpg',
        texture => console.log('Wall AO texture loaded successfully'),
        null,
        error => console.error('Error loading wall AO texture:', error)),
    displacement: textureLoader.load('/3d-assets/walls/1K-ceramic_decorative_6-displacement.jpg',
        texture => console.log('Wall displacement texture loaded successfully'),
        null,
        error => console.error('Error loading wall displacement texture:', error))
};

// Set texture wrapping and repeat for all floor textures
Object.values(floorTextures).forEach(texture => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3); // Adjust repeat as needed for proper scale
});

// Set texture wrapping and repeat for all wall textures
Object.values(wallTextures).forEach(texture => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.5, 1); // Adjusted from 2, 1 to 1.5, 1 for better scale
});

// Now update the wall material with the loaded textures
// Disable the normal map first, as it might be causing the black walls
wallMaterial.map = wallTextures.baseColor;
// wallMaterial.normalMap = wallTextures.normal; // Temporarily disable normal map
wallMaterial.roughnessMap = wallTextures.roughness;
wallMaterial.metalnessMap = null; // Ceramic has no metalness map
wallMaterial.aoMap = wallTextures.ao;
// wallMaterial.displacementMap = wallTextures.displacement; // Temporarily disable displacement
wallMaterial.displacementScale = 0.0; // Set to 0 for now
wallMaterial.metalness = 0.0; // Ceramic is not metallic
wallMaterial.roughness = 0.7; // Ceramic is more rough
wallMaterial.color = new THREE.Color(0xFFFFFF); // White base color for accurate texture display
wallMaterial.shadowSide = THREE.FrontSide; // Makes sure shadows are received properly
wallMaterial.side = THREE.DoubleSide; // Ensure walls are visible from both sides
wallMaterial.envMap = scene.environment; // Use the environment map for reflections
wallMaterial.envMapIntensity = 0.7; // Reduced from 1.0 to 0.7
wallMaterial.transparent = false; // Make sure it's not transparent
wallMaterial.wireframe = false; // Make sure wireframe is off
wallMaterial.flatShading = false; // Use smooth shading
wallMaterial.needsUpdate = true; // Ensure material updates

// Log material properties to help debug
console.log('Wall material configuration:', {
    hasBaseColorMap: !!wallMaterial.map,
    hasNormalMap: !!wallMaterial.normalMap,
    hasRoughnessMap: !!wallMaterial.roughnessMap,
    hasMetalnessMap: !!wallMaterial.metalnessMap,
    hasAOMap: !!wallMaterial.aoMap,
    hasDisplacementMap: !!wallMaterial.displacementMap,
    metalness: wallMaterial.metalness,
    roughness: wallMaterial.roughness,
    colorValue: wallMaterial.color.getHexString()
});

// Additional materials for floor and ceiling
const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTextures.baseColor,
    normalMap: floorTextures.normal,
    roughnessMap: floorTextures.roughness,
    metalnessMap: floorTextures.metallic,
    aoMap: floorTextures.ao,
    displacementMap: floorTextures.height,
    displacementScale: 0.05, // Subtle displacement for realism
    roughness: 0.8,
    metalness: 0.1,
    shadowSide: THREE.FrontSide, // Makes sure shadows are received properly
    envMapIntensity: 0.5 // Reduce environment map intensity
});

const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0xC8B99D,  // Light beige color for the ceiling
    roughness: 0.8,    // Slightly less rough than walls
    metalness: 0.1,    // Very slight metallic quality
    envMapIntensity: 0.2, // More subtle environment reflections
    side: THREE.DoubleSide // Ensure it's visible from both sides
});

// Additional materials for text labels
const textMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,  // White color for text
    roughness: 0.1,
    metalness: 0.3
});

// Add door history tracking for consistency
const doorTransitionHistory = {
    lastExitWall: null,
    lastEntryWall: null,
    cameraRotation: null,
    cameraForward: new THREE.Vector3()
};

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 1.6; // Average eye height
camera.position.z = 0; // Center of the room

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// Enable shadows in the renderer
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows

// Fix the black walls issue with proper renderer settings
renderer.toneMapping = THREE.ReinhardToneMapping; // Change to Reinhard for better highlights
renderer.toneMappingExposure = 0.2; // Set exposure to 0.2 as requested
renderer.outputColorSpace = THREE.SRGBColorSpace; // Use proper color space for modern Three.js

document.body.appendChild(renderer.domElement);

// Create a procedural environment map for the metallic reflections
console.log('Creating darker procedural environment map for gold reflections');
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// Create a high-contrast environment map with dramatic lighting
const canvas = document.createElement('canvas');
canvas.width = 512;
canvas.height = 512;
const context = canvas.getContext('2d');

// Start with a dark gradient
const gradient = context.createLinearGradient(0, 0, 0, 512);
gradient.addColorStop(0, '#050510'); // Nearly black at top
gradient.addColorStop(1, '#151208'); // Very dark at bottom
context.fillStyle = gradient;
context.fillRect(0, 0, 512, 512);

// Add dramatic light source
context.fillStyle = 'rgba(255, 200, 120, 0.3)';
context.beginPath();
context.arc(400, 100, 60, 0, Math.PI * 2);
context.fill();

// Add a second smaller light source
context.fillStyle = 'rgba(200, 255, 255, 0.2)';
context.beginPath();
context.arc(100, 150, 40, 0, Math.PI * 2);
context.fill();

// Add small pinpoints of light to create sparkles in reflections
context.fillStyle = 'rgba(255, 255, 255, 0.8)';
for (let i = 0; i < 12; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 200; // Keep most in upper half
    const size = 1 + Math.random() * 3;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
}

const texture = new THREE.CanvasTexture(canvas);
const envMap = pmremGenerator.fromEquirectangular(texture).texture;
scene.environment = envMap;

texture.dispose();
pmremGenerator.dispose();

// Optimize textures after renderer is created AND after floorTextures are defined
Object.values(floorTextures).forEach(texture => {
    // Add texture optimization
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
});

// Optimize wall textures too
Object.values(wallTextures).forEach(texture => {
    // Add texture optimization
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
});

// Add chandelier model loader
const gltfLoader = new GLTFLoader();
let chandelierModel = null;

// Load the chandelier model once and reuse it
gltfLoader.load('/3d-assets/chandelier/scene.gltf', (gltf) => {
    console.log('Chandelier model loaded successfully');
    chandelierModel = gltf.scene;
    
    // Scale the model to 50% smaller (0.25 instead of 0.5)
    chandelierModel.scale.set(0.25, 0.25, 0.25);
    
    // Traverse the model to ensure textures are loaded and applied
    chandelierModel.traverse((child) => {
        if (child.isMesh) {
            console.log('Found mesh in chandelier model:', child.name);
            
            // Enable shadows
            child.castShadow = true;
            child.receiveShadow = true;
            
            // If the material has textures, make sure they're loaded
            if (child.material) {
                if (child.material.map) {
                    console.log('Texture found:', child.material.map.name);
                    // Ensure texture is using the correct path
                    child.material.map.needsUpdate = true;
                }
                
                // Make sure the material properties are set for good rendering
                child.material.needsUpdate = true;
            }
        }
    });
    
    // Enable shadows for the whole model
    chandelierModel.castShadow = true;
    chandelierModel.receiveShadow = true;
    
    // If we already have a room, add the chandelier to it
    // This is safe now because addChandelierToRoom is defined after this point
    if (singleRoom) {
        addChandelierToRoom(singleRoom);
    }
}, 
(xhr) => {
    console.log(`Chandelier loading: ${(xhr.loaded / xhr.total) * 100}% loaded`);
},
(error) => {
    console.error('Error loading chandelier model:', error);
});

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Increased from original value to 0.7
scene.add(ambientLight);

// Add directional light for better shadows and definition
const directionalLight = new THREE.DirectionalLight(0xFFDCB8, 0.8); // Increased to 0.8
directionalLight.position.set(1, 3, 1);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
scene.add(directionalLight);

// Add more directional lights to ensure walls are properly lit from multiple angles
const directionalLight2 = new THREE.DirectionalLight(0xFFDCB8, 0.8); // Increased to 0.8
directionalLight2.position.set(-1, 2, -1);
directionalLight2.castShadow = true;
directionalLight2.shadow.mapSize.width = 1024;
directionalLight2.shadow.mapSize.height = 1024;
scene.add(directionalLight2);

// Add the main chandelier light (warm and bright)
const chandelierLight = new THREE.PointLight(0xFFD6AA, 1.0, 20); // Increased to 1.0 and range to 20
chandelierLight.position.set(0, 3, 0); // Position near the ceiling
chandelierLight.castShadow = true;
chandelierLight.shadow.mapSize.width = 512;
chandelierLight.shadow.mapSize.height = 512;
scene.add(chandelierLight);

// Add accent lights with increased intensity
const accentLight1 = new THREE.PointLight(0xE09A70, 0.6, 10); // Increased to 0.6 and 10
accentLight1.position.set(3, 1.5, 0);
scene.add(accentLight1);

const accentLight2 = new THREE.PointLight(0xE09A70, 0.6, 10); // Increased to 0.6 and 10
accentLight2.position.set(-3, 1.5, 0);
scene.add(accentLight2);

// Controls
const controls = new PointerLockControls(camera, document.body);

document.addEventListener('click', function() {
    if (!controls.isLocked) {
        controls.lock();
    }
});

controls.addEventListener('lock', function() {
    document.getElementById('info').style.display = 'none';
});

controls.addEventListener('unlock', function() {
    document.getElementById('info').style.display = 'block';
});

// Movement
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

document.addEventListener('keydown', function(event) {
    switch (event.code) {
        case 'KeyW':
            moveForward = true;
            break;
        case 'KeyA':
            moveLeft = true;
            break;
        case 'KeyS':
            moveBackward = true;
            break;
        case 'KeyD':
            moveRight = true;
            break;
    }
});

document.addEventListener('keyup', function(event) {
    switch (event.code) {
        case 'KeyW':
            moveForward = false;
            break;
        case 'KeyA':
            moveLeft = false;
            break;
        case 'KeyS':
            moveBackward = false;
            break;
        case 'KeyD':
            moveRight = false;
            break;
    }
});

// Function to calculate the ring number of a hexagonal cell at coordinates (q,r)
function calculateRing(q, r) {
    return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q-r));
}

// Function to convert wall number to direction in axial coordinates
function wallToDirection(wallNumber) {
    // Direction mapping based on wall numbers
    // Wall 0: East, Wall 1: Southeast, Wall 2: Southwest,
    // Wall 3: West, Wall 4: Northwest, Wall 5: Northeast
    const directions = [
        {q: 1, r: 0},    // Wall 0 - East
        {q: 1, r: -1},   // Wall 1 - Southeast  
        {q: 0, r: -1},   // Wall 2 - Southwest
        {q: -1, r: 0},   // Wall 3 - West
        {q: -1, r: 1},   // Wall 4 - Northwest
        {q: 0, r: 1}     // Wall 5 - Northeast
    ];
    return directions[wallNumber];
}

// Function to get direction from coordinates
function directionToWall(dirQ, dirR) {
    const directions = [
        {q: 1, r: 0},    // Wall 0 - East
        {q: 1, r: -1},   // Wall 1 - Southeast  
        {q: 0, r: -1},   // Wall 2 - Southwest
        {q: -1, r: 0},   // Wall 3 - West
        {q: -1, r: 1},   // Wall 4 - Northwest
        {q: 0, r: 1}     // Wall 5 - Northeast
    ];
    
    for (let i = 0; i < directions.length; i++) {
        if (directions[i].q === dirQ && directions[i].r === dirR) {
            return i;
        }
    }
    return -1; // Not found
}

// Function to find the opposite wall number
function getOppositeWall(wallNumber) {
    return (wallNumber + 3) % 6;
}

// Function to determine which walls should have doors in a room
function determineDoorsForRoom(q, r) {
    // Get visited room info if it exists
    const roomKey = `${q},${r}`;
    
    if (visitedRooms.has(roomKey)) {
        const roomData = visitedRooms.get(roomKey);
        // If room already has two doors, return them
        if (roomData.doors.length === 2) {
            return roomData.doors;
        }
        
        // If room has only one door (during initial transition setup),
        // we need to determine the second door
        if (roomData.doors.length === 1) {
            const doors = [...roomData.doors]; // Copy existing door
            const neighbors = new Map(roomData.neighbors); // Copy existing neighbors
            
            // Now place a second door (randomly, but with constraints)
            const availableWalls = [0, 1, 2, 3, 4, 5].filter(w => !doors.includes(w));
            
            // Try placing on each available wall, checking constraints
            const validWalls = [];
            for (const wallIndex of availableWalls) {
                const directionToNeighbor = wallToDirection(wallIndex);
                const neighborQ = q + directionToNeighbor.q;
                const neighborR = r + directionToNeighbor.r;
                const neighborKey = `${neighborQ},${neighborR}`;
                
                // Check if the neighbor already exists and has two doors
                if (visitedRooms.has(neighborKey)) {
                    const neighborDoors = visitedRooms.get(neighborKey).doors;
                    // Skip if neighbor already has two doors
                    if (neighborDoors.length >= 2) continue;
                    
                    // Skip if the opposite wall in the neighbor already has a door
                    const oppositeWall = getOppositeWall(wallIndex);
                    if (neighborDoors.includes(oppositeWall)) continue;
                }
                
                // This wall is valid for a door
                validWalls.push(wallIndex);
            }
            
            // Choose a random valid wall for the second door
            if (validWalls.length > 0) {
                const randomIndex = Math.floor(Math.random() * validWalls.length);
                const chosenWall = validWalls[randomIndex];
                doors.push(chosenWall);
                
                // Record the connection to the neighbor
                const directionToNeighbor = wallToDirection(chosenWall);
                const neighborQ = q + directionToNeighbor.q;
                const neighborR = r + directionToNeighbor.r;
                neighbors.set(chosenWall, { q: neighborQ, r: neighborR });
            } else {
                // If no valid walls, place a door on a wall that doesn't lead to a visited room
                for (const wallIndex of availableWalls) {
                    const directionToNeighbor = wallToDirection(wallIndex);
                    const neighborQ = q + directionToNeighbor.q;
                    const neighborR = r + directionToNeighbor.r;
                    const neighborKey = `${neighborQ},${neighborR}`;
                    
                    if (!visitedRooms.has(neighborKey)) {
                        doors.push(wallIndex);
                        neighbors.set(wallIndex, { q: neighborQ, r: neighborR });
                        break;
                    }
                }
            }
            
            // If we still don't have a second door, just place it on the first available wall
            if (doors.length < 2 && availableWalls.length > 0) {
                const wallIndex = availableWalls[0];
                doors.push(wallIndex);
                
                // Record the connection to the neighbor
                const directionToNeighbor = wallToDirection(wallIndex);
                const neighborQ = q + directionToNeighbor.q;
                const neighborR = r + directionToNeighbor.r;
                neighbors.set(wallIndex, { q: neighborQ, r: neighborR });
            }
            
            // Update the room's door configuration
            roomData.doors = doors;
            roomData.neighbors = neighbors;
            
            // Validate that we have exactly 2 doors
            if (doors.length !== 2) {
                console.error("Failed to place exactly 2 doors for room", q, r, doors);
            }
            
            return doors;
        }
    }
    
    // This is a completely new room we're generating
    const doors = [];
    const neighbors = new Map();
    
    // Check if we're coming from an adjacent room - if so, we must have a door on the opposite wall
    // Iterate through all previously visited rooms
    for (const [visitedRoomKey, visitedRoomData] of visitedRooms.entries()) {
        const [visitedQ, visitedR] = visitedRoomKey.split(',').map(Number);
        
        // Check if this visited room is adjacent to our current room
        const deltaQ = q - visitedQ;
        const deltaR = r - visitedR;
        
        // If adjacent (difference corresponds to one of our direction vectors)
        const adjacentWallIndex = directionToWall(deltaQ, deltaR);
        if (adjacentWallIndex !== -1) {
            // Check if the visited room has a door pointing to this room
            for (const [doorWall, neighbor] of visitedRoomData.neighbors.entries()) {
                if (neighbor.q === q && neighbor.r === r) {
                    // This visited room has a door to our current room
                    // We must place a door on the opposite wall
                    const oppositeWall = getOppositeWall(doorWall);
                    doors.push(oppositeWall);
                    neighbors.set(oppositeWall, { q: visitedQ, r: visitedR });
                    break;
                }
            }
        }
    }
    
    // If no door placed yet (this is the first room), place first door
    if (doors.length === 0) {
        // First room gets default doors on east and west (0 and 3)
        doors.push(0); // East
        
        // Calculate the neighbor coordinates
        const eastNeighborQ = q + wallToDirection(0).q;
        const eastNeighborR = r + wallToDirection(0).r;
        
        // Add to neighbors map
        neighbors.set(0, { q: eastNeighborQ, r: eastNeighborR });
    }
    
    // Now place a second door (randomly, but with constraints)
    const availableWalls = [0, 1, 2, 3, 4, 5].filter(w => !doors.includes(w));
    
    // Try placing on each available wall, checking constraints
    const validWalls = [];
    for (const wallIndex of availableWalls) {
        const directionToNeighbor = wallToDirection(wallIndex);
        const neighborQ = q + directionToNeighbor.q;
        const neighborR = r + directionToNeighbor.r;
        const neighborKey = `${neighborQ},${neighborR}`;
        
        // Check if the neighbor already exists and has two doors
        if (visitedRooms.has(neighborKey)) {
            const neighborDoors = visitedRooms.get(neighborKey).doors;
            // Skip if neighbor already has two doors
            if (neighborDoors.length >= 2) continue;
            
            // Skip if the opposite wall in the neighbor already has a door
            const oppositeWall = getOppositeWall(wallIndex);
            if (neighborDoors.includes(oppositeWall)) continue;
        }
        
        // This wall is valid for a door
        validWalls.push(wallIndex);
    }
    
    // Choose a random valid wall for the second door
    if (validWalls.length > 0) {
        const randomIndex = Math.floor(Math.random() * validWalls.length);
        const chosenWall = validWalls[randomIndex];
        doors.push(chosenWall);
        
        // Record the connection to the neighbor
        const directionToNeighbor = wallToDirection(chosenWall);
        const neighborQ = q + directionToNeighbor.q;
        const neighborR = r + directionToNeighbor.r;
        neighbors.set(chosenWall, { q: neighborQ, r: neighborR });
    } else {
        // If no valid walls, place a door on a wall that doesn't lead to a visited room
        let doorPlaced = false;
        for (const wallIndex of availableWalls) {
            const directionToNeighbor = wallToDirection(wallIndex);
            const neighborQ = q + directionToNeighbor.q;
            const neighborR = r + directionToNeighbor.r;
            const neighborKey = `${neighborQ},${neighborR}`;
            
            if (!visitedRooms.has(neighborKey)) {
                doors.push(wallIndex);
                neighbors.set(wallIndex, { q: neighborQ, r: neighborR });
                doorPlaced = true;
                break;
            }
        }
        
        // If still no door placed, pick any available wall
        if (!doorPlaced && availableWalls.length > 0) {
            const wallIndex = availableWalls[0];
            doors.push(wallIndex);
            
            // Record the connection to the neighbor
            const directionToNeighbor = wallToDirection(wallIndex);
            const neighborQ = q + directionToNeighbor.q;
            const neighborR = r + directionToNeighbor.r;
            neighbors.set(wallIndex, { q: neighborQ, r: neighborR });
        }
    }
    
    // Save this room's door configuration
    visitedRooms.set(roomKey, { doors, neighbors });
    
    // Validate that we have exactly 2 doors
    if (doors.length !== 2) {
        console.error("Failed to place exactly 2 doors for room", q, r, doors);
        
        // Force a second door if we somehow don't have one
        if (doors.length < 2 && availableWalls.length > 0) {
            const wallIndex = availableWalls[0];
            doors.push(wallIndex);
            
            // Record the connection
            const directionToNeighbor = wallToDirection(wallIndex);
            const neighborQ = q + directionToNeighbor.q;
            const neighborR = r + directionToNeighbor.r;
            neighbors.set(wallIndex, { q: neighborQ, r: neighborR });
            
            // Update the room data
            visitedRooms.set(roomKey, { doors, neighbors });
        }
    }
    
    return doors;
}

// Function to create a door in a wall
function createDoor(wallIndex, doorWidth, doorHeight) {
    // Create door frame group
    const doorGroup = new THREE.Group();
    
    // Create door geometry
    const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, wallThickness * 0.5);
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.userData.isDoor = true; // Mark the mesh itself as a door for easier detection
    
    // Position door correctly - this depends on wall orientation
    // The specific positioning will be handled when adding the door to a wall
    
    // Create door frame (slightly larger than the door)
    const frameThickness = 0.15;
    const frameWidth = doorWidth + frameThickness * 2;
    const frameHeight = doorHeight + frameThickness;
    
    // Top of frame
    const topFrameGeometry = new THREE.BoxGeometry(frameWidth, frameThickness, wallThickness * 0.7);
    const topFrame = new THREE.Mesh(topFrameGeometry, doorFrameMaterial);
    topFrame.position.y = doorHeight/2 + frameThickness/2;
    
    // Sides of frame
    const sideFrameGeometry = new THREE.BoxGeometry(frameThickness, doorHeight, wallThickness * 0.7);
    
    const leftFrame = new THREE.Mesh(sideFrameGeometry, doorFrameMaterial);
    leftFrame.position.x = -doorWidth/2 - frameThickness/2;
    
    const rightFrame = new THREE.Mesh(sideFrameGeometry, doorFrameMaterial);
    rightFrame.position.x = doorWidth/2 + frameThickness/2;
    
    // Add all parts to the door group
    doorGroup.add(door);
    doorGroup.add(topFrame);
    doorGroup.add(leftFrame);
    doorGroup.add(rightFrame);
    
    // Get direction to the next room based on wall index
    const dir = wallToDirection(wallIndex);
    
    // Get the opposite wall index (for the connected room)
    const oppositeWall = getOppositeWall(wallIndex);
    
    // Set userData properties on the group
    doorGroup.userData = { 
        isDoor: true,
        wallIndex: wallIndex,
        targetQ: 0,  // Will be set when placed
        targetR: 0,  // Will be set when placed
        oppositeWall: oppositeWall  // The wall index in the target room that should have a door back to this room
    };
    
    return doorGroup;
}

// Function to validate door connections before creating them
function validateDoorConnection(roomQ, roomR, wallIndex) {
    // Get direction to the next room
    const dir = wallToDirection(wallIndex);
    
    // Calculate target room coordinates
    const targetQ = roomQ + dir.q;
    const targetR = roomR + dir.r;
    
    // Get opposite wall index
    const oppositeWall = getOppositeWall(wallIndex);
    
    // Check if target room exists in our data structure
    const targetRoomKey = `${targetQ},${targetR}`;
    if (visitedRooms.has(targetRoomKey)) {
        // Target room exists, verify it has a door on the opposite wall
        const targetRoom = visitedRooms.get(targetRoomKey);
        
        // Check if target room has a door on the opposite wall
        if (!targetRoom.doors.includes(oppositeWall)) {
            console.warn(`Room (${targetQ},${targetR}) doesn't have a door on wall ${oppositeWall} (opposite to wall ${wallIndex} of room (${roomQ},${roomR}))`);
            
            // Fix the target room by adding or replacing a door
            if (targetRoom.doors.length < 2) {
                console.log(`Adding door to wall ${oppositeWall} in target room (${targetQ},${targetR})`);
                targetRoom.doors.push(oppositeWall);
                targetRoom.neighbors.set(oppositeWall, { q: roomQ, r: roomR });
            } else {
                console.log(`Replacing a door in target room (${targetQ},${targetR}) to create door on wall ${oppositeWall}`);
                
                // Find a door to replace (one that doesn't connect back to our room)
                const doorToReplace = targetRoom.doors.find(door => 
                    door !== oppositeWall && 
                    (!targetRoom.neighbors.has(door) || 
                     targetRoom.neighbors.get(door).q !== roomQ || 
                     targetRoom.neighbors.get(door).r !== roomR)
                );
                
                if (doorToReplace !== undefined) {
                    const idx = targetRoom.doors.indexOf(doorToReplace);
                    targetRoom.doors[idx] = oppositeWall;
                    targetRoom.neighbors.set(oppositeWall, { q: roomQ, r: roomR });
                } else {
                    console.error(`Could not find a door to replace in target room (${targetQ},${targetR})`);
                }
            }
        } else {
            // Door exists, verify it points back to our room
            const hasCorrectNeighbor = 
                targetRoom.neighbors.has(oppositeWall) && 
                targetRoom.neighbors.get(oppositeWall).q === roomQ && 
                targetRoom.neighbors.get(oppositeWall).r === roomR;
            
            if (!hasCorrectNeighbor) {
                console.warn(`Door on wall ${oppositeWall} in room (${targetQ},${targetR}) doesn't point back to room (${roomQ},${roomR})`);
                
                // Fix the neighbor connection
                targetRoom.neighbors.set(oppositeWall, { q: roomQ, r: roomR });
            }
        }
    }
    
    return { targetQ, targetR, oppositeWall };
}

// Function to add bookshelves to a room on walls without doors
function addBookshelvesToRoom(room, doorWalls) {
    // Define bookshelf dimensions
    const shelfWidth = 3.6;  // Increased width from 2.4 to 3.6 to fit more books
    const shelfHeight = 0.3; // Height of each shelf
    const shelfDepth = 0.35; // Depth of the bookshelf
    const shelfSpacing = 0.8; // Vertical spacing between shelves
    const shelfOffsetFromWall = 0.05; // Small offset from wall
    
    // Create a bookshelf material with wood texture
    const shelfMaterial = new THREE.MeshStandardMaterial({
        color: 0x5c4033, // Brown wood color
        roughness: 0.7,
        metalness: 0.1,
        bumpScale: 0.02
    });
    
    // Create materials for the books with more varied colors
    const bookMaterials = [
        new THREE.MeshStandardMaterial({ color: 0x880000, roughness: 0.9 }), // Dark red
        new THREE.MeshStandardMaterial({ color: 0x000088, roughness: 0.9 }), // Dark blue
        new THREE.MeshStandardMaterial({ color: 0x008800, roughness: 0.9 }), // Dark green
        new THREE.MeshStandardMaterial({ color: 0x884400, roughness: 0.9 }), // Brown
        new THREE.MeshStandardMaterial({ color: 0x663399, roughness: 0.9 }), // Purple
        new THREE.MeshStandardMaterial({ color: 0x006666, roughness: 0.9 }), // Teal
        new THREE.MeshStandardMaterial({ color: 0x996633, roughness: 0.9 }), // Tan
        new THREE.MeshStandardMaterial({ color: 0x990099, roughness: 0.9 })  // Magenta
    ];
    
    // For each wall (0-5), check if it has a door
    for (let wallIndex = 0; wallIndex < 6; wallIndex++) {
        // Skip walls with doors
        if (doorWalls.includes(wallIndex)) continue;
        
        // Get the wall points using the same function used for doors
        const wallPoints = calculateWallPoints(wallIndex);
        
        // Calculate wall center using the same function used for door placement
        const wallCenter = calculateWallCenter(wallPoints[0], wallPoints[1], wallPoints[2], wallPoints[3]);
        
        // Calculate wall normal
        const normal = calculateNormal(wallPoints[0], wallPoints[1], wallPoints[2]);
        
        // Create a rotation to align the bookshelf with the wall normal
        const wallAngle = Math.atan2(normal.x, normal.z);
        
        // Create bookshelf group for this wall
        const wallBookshelfGroup = new THREE.Group();
        wallBookshelfGroup.name = `bookshelf${wallIndex}`;
        
        // Add a subtle light to illuminate the bookshelf
        const shelfLight = new THREE.PointLight(0xFFF0DD, 0.4, 3); // Warm, subtle light with short range
        shelfLight.position.set(0, 0, shelfDepth/2); // Position slightly in front of the shelf
        
        // Add a slight random flicker effect to simulate candle-like lighting
        shelfLight.userData.baseIntensity = 0.4;
        shelfLight.userData.pulseSpeed = 0.5 + (Math.random() * 0.5); // Random speed
        shelfLight.userData.pulseAmount = 0.05; // Small intensity variation
        
        // Create update function for shelf light flickering
        shelfLight.userData.update = function(delta) {
            // Add subtle flickering to the shelf light
            const light = this;
            light.intensity = light.userData.baseIntensity + 
                Math.sin(Date.now() * 0.001 * light.userData.pulseSpeed) * light.userData.pulseAmount;
        };
        
        wallBookshelfGroup.add(shelfLight);
        
        // Calculate wall width based on the distance between the two floor points
        const wallWidth = new THREE.Vector3().subVectors(wallPoints[1], wallPoints[0]).length();
        
        // Add decorative trim to the bookshelf
        const trimHeight = 0.1;
        const trimWidth = shelfWidth + 0.2;
        const trimDepth = shelfDepth + 0.05;
        const trimGeometry = new THREE.BoxGeometry(trimWidth, trimHeight, trimDepth);
        const trimMaterial = new THREE.MeshStandardMaterial({
            color: 0x3d2817, // Darker wood color for trim
            roughness: 0.7,
            metalness: 0.2
        });
        
        // Top trim
        const topTrim = new THREE.Mesh(trimGeometry, trimMaterial);
        topTrim.position.set(0, 0.7 + (5 * shelfSpacing) + (trimHeight/2), 0);
        wallBookshelfGroup.add(topTrim);
        
        // Bottom trim
        const bottomTrim = new THREE.Mesh(trimGeometry, trimMaterial);
        bottomTrim.position.set(0, 0.7 - (trimHeight/2), 0);
        wallBookshelfGroup.add(bottomTrim);
        
        // Add 5 bookshelves at different heights on the wall
        for (let shelfLevel = 0; shelfLevel < 5; shelfLevel++) {
            // Calculate y position for this shelf
            const yPosition = 0.7 + (shelfLevel * shelfSpacing);
            
            // Create shelf (base) with rounded edges
            const shelfGeometry = new THREE.BoxGeometry(shelfWidth, shelfHeight, shelfDepth);
            const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
            
            // Position the shelf relative to the wall center
            shelf.position.set(0, yPosition - (wallCenter.y), 0);
            
            // Add the shelf to the group
            wallBookshelfGroup.add(shelf);
            
            // Add books to this shelf
            const bookWidth = 0.09; // Slightly thinner books to fit more (was 0.1)
            const bookSpacing = 0.015; // Reduced spacing between books (was 0.02)
            const maxBooksPerShelf = Math.floor((shelfWidth - 0.2) / (bookWidth + bookSpacing));
            
            // Ensure we have at least 32 books per shelf
            const minBooks = 32;
            const booksOnThisShelf = Math.max(minBooks, maxBooksPerShelf - Math.floor(Math.random() * 2));
            
            // Calculate start position for books (centered on shelf)
            const bookStartX = -(shelfWidth / 2) + 0.1;
            
            // Create a group for this shelf's books
            const shelfBooksGroup = new THREE.Group();
            
            // Place books on this shelf
            for (let bookIndex = 0; bookIndex < booksOnThisShelf; bookIndex++) {
                // Reduce the chance of gaps to ensure we have enough books (5% chance instead of 10%)
                if (Math.random() < 0.05 && bookIndex > 0 && shelfBooksGroup.children.length >= minBooks) {
                    continue; // Skip this position to create a gap, but only if we already have enough books
                }
                
                // Create a book with random height and slight random tilt
                const bookHeight = 0.5 + (Math.random() * 0.3); // Random height between 0.5 and 0.8
                const bookDepth = shelfDepth - 0.1; // Slightly less deep than the shelf
                
                const bookGeometry = new THREE.BoxGeometry(bookWidth, bookHeight, bookDepth);
                const randomMaterial = bookMaterials[Math.floor(Math.random() * bookMaterials.length)];
                const book = new THREE.Mesh(bookGeometry, randomMaterial);
                
                // Position the book on the shelf with spacing
                const bookX = bookStartX + (bookIndex * (bookWidth + bookSpacing));
                const bookY = yPosition + (shelfHeight / 2) + (bookHeight / 2) - (wallCenter.y);
                book.position.set(bookX, bookY, 0);
                
                // Add slight random rotation to some books (15% chance)
                if (Math.random() < 0.15) {
                    // Tilt the book slightly
                    const tiltAngle = (Math.random() * 0.1) - 0.05; // Small random angle
                    book.rotation.z = tiltAngle;
                }
                
                // Add the book to the shelf group
                shelfBooksGroup.add(book);
                
                // Occasionally add a small decorative object between books (3% chance instead of 5%)
                // Only add decorations if we have enough books and we're not near the end
                if (Math.random() < 0.03 && bookIndex < booksOnThisShelf - 3 && shelfBooksGroup.children.length >= minBooks) {
                    // Create a small decorative object (like a bookend or small statue)
                    const decorSize = 0.15;
                    const decorGeometry = new THREE.SphereGeometry(decorSize/2, 8, 8);
                    const decorMaterial = new THREE.MeshStandardMaterial({
                        color: 0xD4AF37, // Gold color
                        metalness: 0.7,
                        roughness: 0.3
                    });
                    const decor = new THREE.Mesh(decorGeometry, decorMaterial);
                    
                    // Position the decoration
                    const decorX = bookX + bookWidth/2 + bookSpacing + decorSize/2;
                    const decorY = yPosition + (shelfHeight / 2) + (decorSize / 2) - (wallCenter.y);
                    decor.position.set(decorX, decorY, 0);
                    
                    // Add to shelf group
                    shelfBooksGroup.add(decor);
                    
                    // Skip the next position
                    bookIndex++;
                }
            }
            
            // Add all books for this shelf to the bookshelf group
            wallBookshelfGroup.add(shelfBooksGroup);
        }
        
        // Position the entire bookshelf group at the wall center
        wallBookshelfGroup.position.copy(wallCenter);
        
        // Move bookshelf slightly away from wall toward room center
        // Calculate direction vector from wall center to room center
        const roomCenter = new THREE.Vector3(0, wallCenter.y, 0);
        const dirFromWallToCenter = new THREE.Vector3().subVectors(roomCenter, wallCenter).normalize();
        
        // Offset the bookshelf slightly from the wall
        wallBookshelfGroup.position.add(dirFromWallToCenter.clone().multiplyScalar(shelfDepth/2 + shelfOffsetFromWall));
        
        // Rotate the bookshelf to face into the room
        wallBookshelfGroup.rotation.y = wallAngle;
        
        // Add the bookshelf group to the room
        room.add(wallBookshelfGroup);
    }
}

// Helper function to calculate wall center point
function calculateWallCenter(p1, p2, p3, p4) {
    return new THREE.Vector3(
        (p1.x + p2.x + p3.x + p4.x) / 4,
        (p1.y + p2.y + p3.y + p4.y) / 4,
        (p1.z + p2.z + p3.z + p4.z) / 4
    );
}

// Helper function to calculate face normal from 3 points
function calculateNormal(p1, p2, p3) {
    const v1 = new THREE.Vector3().subVectors(p2, p1);
    const v2 = new THREE.Vector3().subVectors(p3, p1);
    return new THREE.Vector3().crossVectors(v1, v2).normalize();
}

// Function to create a hexagonal room with doors
function createHexagonalRoom(q, r) {
    const room = new THREE.Group();
    room.userData = { q: q, r: r, type: 'room' };
    
    // Ensure this room has exactly 2 doors before creating
    const roomKey = `${q},${r}`;
    const roomData = visitedRooms.get(roomKey);
    if (!roomData || roomData.doors.length !== 2) {
        console.warn(`Room ${roomKey} has invalid door configuration, fixing...`);
        determineDoorsForRoom(q, r);
    }

    // Calculate vertices for the hexagon
    const hexPoints = [];
    for (let i = 0; i < 6; i++) {
        // 30° offset to align hexagon correctly
        const angle = i * Math.PI / 3 + Math.PI / 6;
        const x = roomRadius * Math.cos(angle);
        const z = roomRadius * Math.sin(angle);
        hexPoints.push(new THREE.Vector2(x, z));
    }
    
    // Create floor shape and geometry
    const floorShape = new THREE.Shape(hexPoints);
    const floorGeometry = new THREE.ExtrudeGeometry(floorShape, {
        depth: wallThickness,
        bevelEnabled: false
    });
    
    // Add UV2 coordinates for ambient occlusion map
    floorGeometry.setAttribute('uv2', floorGeometry.getAttribute('uv'));
    
    // Create floor mesh and rotate to lie flat on XZ plane
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = Math.PI / 2;
    floor.position.y = 0; // Position exactly at y=0 to be flush with walls
    floor.receiveShadow = true; // Enable shadow receiving
    room.add(floor);
    
    // Create ceiling (same shape as floor but positioned at room height)
    const ceiling = new THREE.Mesh(floorGeometry.clone(), ceilingMaterial);
    ceiling.rotation.x = -Math.PI / 2; // Rotate opposite of floor
    ceiling.position.y = roomHeight;
    room.add(ceiling);
    
    // Create portal effect plane (covers entire room)
    const portalPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(roomRadius * 3, roomRadius * 3),
        portalMaterial.clone()
    );
    portalPlane.rotation.x = Math.PI / 2;
    portalPlane.position.y = roomHeight / 2;
    portalPlane.visible = false;
    portalPlane.name = "portalEffect";
    room.add(portalPlane);
    
    // Wall labels - change naming convention to match the room navigation
    const wallLabels = ['WALL 0', 'WALL 1', 'WALL 2', 'WALL 3', 'WALL 4', 'WALL 5'];
    
    // Create a canvas for each label
    function createTextLabel(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;  // Increased canvas size for better resolution
        canvas.height = 256;
        
        // Draw background with slight transparency for better readability
        context.fillStyle = 'rgba(50, 50, 50, 0.6)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add border for better visibility
        context.strokeStyle = 'white';
        context.lineWidth = 8;
        context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        // Draw text
        context.font = 'Bold 90px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create material with the texture
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Create plane geometry - wider to better accommodate the text
        const geometry = new THREE.PlaneGeometry(3, 1.5);
        
        // Create mesh
        const label = new THREE.Mesh(geometry, material);
        
        return label;
    }
    
    // Create floor and ceiling vertices arrays that we'll use for walls
    const floorVertices = [];
    const ceilingVertices = [];
    
    // Generate 3D vertices for floor and ceiling perimeter
    for (let i = 0; i < 6; i++) {
        const point = hexPoints[i];
        floorVertices.push(new THREE.Vector3(point.x, 0, point.y)); // Floor vertices at y=0
        ceilingVertices.push(new THREE.Vector3(point.x, roomHeight, point.y));
    }
    
    // Determine which walls should have doors
    const doorWalls = determineDoorsForRoom(q, r);
    
    // Add text to indicate room coordinates and ring number
    const coordsLabel = createTextLabel(`ROOM (${q},${r}) - RING ${calculateRing(q, r)}`);
    coordsLabel.position.set(0, roomHeight - 0.5, 0);
    coordsLabel.rotation.x = Math.PI / 2;
    coordsLabel.name = "roomCoordinates";
    room.add(coordsLabel);
    
    // Helper function to create a wall from 4 points (ensuring proper winding order)
    function createWall(points, index) {
        const wallGroup = new THREE.Group();
        wallGroup.name = `wall${index}`;
        
        // Check if this wall should have a door
        const hasDoor = doorWalls.includes(index);
        
        if (hasDoor) {
            // Create door
            const door = createDoor(index, doorWidth, doorHeight);
            door.name = `door${index}`;
            
            // Validate connection before setting door target
            const { targetQ, targetR } = validateDoorConnection(q, r, index);
            
            // Set door's target room coordinates
            door.userData.targetQ = targetQ;
            door.userData.targetR = targetR;
            
            // Position door in the center of the wall
            const wallCenter = calculateWallCenter(points[0], points[1], points[2], points[3]);
            door.position.set(wallCenter.x, doorHeight / 2, wallCenter.z);
            
            // Rotate door to face perpendicular to the wall
            // Calculate wall normal
            const normal = calculateNormal(points[0], points[1], points[2]);
            
            // Create a rotation to align the door with the wall normal
            const wallAngle = Math.atan2(normal.x, normal.z);
            door.rotation.y = wallAngle;
            
            // Add door to the wall group
            wallGroup.add(door);
            
            // Add a point light at the door position for better visibility
            const doorLight = new THREE.PointLight(0xFFC773, 0.5, 4); // Warmer color for door light
            doorLight.position.set(wallCenter.x, doorHeight / 2, wallCenter.z);
            
            // Add a subtle pulsing effect to door lights
            doorLight.userData.baseIntensity = 0.5;
            doorLight.userData.pulseSpeed = 0.8 + (Math.random() * 0.4); // Between 0.8 and 1.2
            doorLight.userData.pulseAmount = 0.15; // Intensity variation
            
            // Create update function for door light pulsing
            doorLight.userData.update = function(delta) {
                // Add subtle pulsing to the door light
                const light = this;
                light.intensity = light.userData.baseIntensity + 
                    Math.sin(Date.now() * 0.001 * light.userData.pulseSpeed) * light.userData.pulseAmount;
            };
            
            wallGroup.add(doorLight);
            wallGroup.userData.doorLight = doorLight;
            
            // Create partial walls (left and right of the door)
            // We'll create new points for these partial walls
            
            // Wall height vector
            const heightVec = new THREE.Vector3(0, roomHeight, 0);
            
            // Wall width vector (normalized and scaled)
            const wallWidthVec = new THREE.Vector3().subVectors(points[1], points[0]).normalize();
            const doorWidthVec = wallWidthVec.clone().multiplyScalar(doorWidth / 2);
            
            // Door center at floor level
            const doorCenterBottom = new THREE.Vector3(
                wallCenter.x,
                0,
                wallCenter.z
            );
            
            // Calculate corners of the door
            const doorLeftBottom = doorCenterBottom.clone().sub(doorWidthVec);
            const doorRightBottom = doorCenterBottom.clone().add(doorWidthVec);
            const doorLeftTop = doorLeftBottom.clone().add(new THREE.Vector3(0, doorHeight, 0));
            const doorRightTop = doorRightBottom.clone().add(new THREE.Vector3(0, doorHeight, 0));
            
            // Calculate corners for the top part of the wall (above the door)
            const wallTopLeft = doorLeftTop.clone();
            const wallTopRight = doorRightTop.clone();
            const wallTopCeiling = wallTopLeft.clone().add(heightVec.clone().sub(new THREE.Vector3(0, doorHeight, 0)));
            const wallTopCeilingRight = wallTopRight.clone().add(heightVec.clone().sub(new THREE.Vector3(0, doorHeight, 0)));
            
            // Create geometry for wall sections
            // Left section of wall
            const leftWallGeometry = new THREE.BufferGeometry();
            leftWallGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                points[0].x, points[0].y, points[0].z,
                doorLeftBottom.x, doorLeftBottom.y, doorLeftBottom.z,
                doorLeftTop.x, doorLeftTop.y, doorLeftTop.z,
                
                points[0].x, points[0].y, points[0].z,
                doorLeftTop.x, doorLeftTop.y, doorLeftTop.z,
                points[3].x, points[3].y, points[3].z
            ]), 3));
            
            // Add UV coordinates for texture mapping
            const leftWallUvs = new Float32Array([
                0, 0,
                0.5, 0,
                0.5, doorHeight/roomHeight,
                
                0, 0,
                0.5, doorHeight/roomHeight,
                0, 1
            ]);
            leftWallGeometry.setAttribute('uv', new THREE.BufferAttribute(leftWallUvs, 2));
            // Add UV2 coordinates for ambient occlusion map
            leftWallGeometry.setAttribute('uv2', new THREE.BufferAttribute(leftWallUvs, 2));
            
            // Right section of wall
            const rightWallGeometry = new THREE.BufferGeometry();
            rightWallGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                doorRightBottom.x, doorRightBottom.y, doorRightBottom.z,
                points[1].x, points[1].y, points[1].z,
                points[2].x, points[2].y, points[2].z,
                
                doorRightBottom.x, doorRightBottom.y, doorRightBottom.z,
                points[2].x, points[2].y, points[2].z,
                doorRightTop.x, doorRightTop.y, doorRightTop.z
            ]), 3));
            
            // Add UV coordinates for texture mapping
            const rightWallUvs = new Float32Array([
                0.5, 0,
                1, 0,
                1, 1,
                
                0.5, 0,
                1, 1,
                0.5, doorHeight/roomHeight
            ]);
            rightWallGeometry.setAttribute('uv', new THREE.BufferAttribute(rightWallUvs, 2));
            // Add UV2 coordinates for ambient occlusion map
            rightWallGeometry.setAttribute('uv2', new THREE.BufferAttribute(rightWallUvs, 2));
            
            // Top section of wall (above door)
            const topWallGeometry = new THREE.BufferGeometry();
            topWallGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                doorLeftTop.x, doorLeftTop.y, doorLeftTop.z,
                doorRightTop.x, doorRightTop.y, doorRightTop.z,
                wallTopCeilingRight.x, wallTopCeilingRight.y, wallTopCeilingRight.z,
                
                doorLeftTop.x, doorLeftTop.y, doorLeftTop.z,
                wallTopCeilingRight.x, wallTopCeilingRight.y, wallTopCeilingRight.z,
                wallTopCeiling.x, wallTopCeiling.y, wallTopCeiling.z
            ]), 3));
            
            // Add UV coordinates for texture mapping
            const topWallUvs = new Float32Array([
                0, doorHeight/roomHeight,
                1, doorHeight/roomHeight,
                1, 1,
                
                0, doorHeight/roomHeight,
                1, 1,
                0, 1
            ]);
            topWallGeometry.setAttribute('uv', new THREE.BufferAttribute(topWallUvs, 2));
            // Add UV2 coordinates for ambient occlusion map
            topWallGeometry.setAttribute('uv2', new THREE.BufferAttribute(topWallUvs, 2));
            
            // Create meshes for each wall section
            const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
            leftWall.castShadow = true;
            leftWall.receiveShadow = true;
            
            const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
            rightWall.castShadow = true;
            rightWall.receiveShadow = true;
            
            const topWall = new THREE.Mesh(topWallGeometry, wallMaterial);
            topWall.castShadow = true;
            topWall.receiveShadow = true;
            
            // Add wall sections to the wall group
            wallGroup.add(leftWall);
            wallGroup.add(rightWall);
            wallGroup.add(topWall);
        } else {
            // Create a normal full wall if no door
            const geometry = new THREE.BufferGeometry();
            
            // Define the vertices in the correct winding order for two triangles
            const vertices = new Float32Array([
                // First triangle
                points[0].x, points[0].y, points[0].z,
                points[1].x, points[1].y, points[1].z,
                points[2].x, points[2].y, points[2].z,
                // Second triangle
                points[0].x, points[0].y, points[0].z,
                points[2].x, points[2].y, points[2].z,
                points[3].x, points[3].y, points[3].z
            ]);
            
            // Set position attribute
            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            
            // Add UV coordinates for texture mapping
            const uvs = new Float32Array([
                0, 0,
                1, 0,
                1, 1,
                
                0, 0,
                1, 1,
                0, 1
            ]);
            geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            // Add UV2 coordinates for ambient occlusion
            geometry.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2));
            
            // Calculate face normal to verify orientation
            const normal = calculateNormal(points[0], points[1], points[2]);
            
            // Calculate wall center
            const wallCenter = calculateWallCenter(points[0], points[1], points[2], points[3]);
            
            // Vector from wall center to hexagon center (which is at 0,0,0)
            const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, wallCenter.y, 0), wallCenter);
            
            // Check if the normal points toward the center (dot product > 0)
            const dotProduct = normal.dot(toCenter);
            
            // Create the wall mesh with proper shadow settings
            const wall = new THREE.Mesh(geometry, wallMaterial);
            wall.castShadow = true;
            wall.receiveShadow = true;
            wallGroup.add(wall);
            
            // Validate and log the wall orientation
            if (dotProduct > 0) {
                console.log(`Wall ${wallLabels[index]}: Correctly facing inward (dot product: ${dotProduct.toFixed(2)})`);
            } else {
                console.log(`Wall ${wallLabels[index]}: WARNING! Facing outward (dot product: ${dotProduct.toFixed(2)})`);
                // Flip the geometry by swapping vertices to reverse the faces
                // This shouldn't happen with our improved algorithm, but added as a safeguard
                geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                    // First triangle (reversed)
                    points[0].x, points[0].y, points[0].z,
                    points[2].x, points[2].y, points[2].z,
                    points[1].x, points[1].y, points[1].z,
                    // Second triangle (reversed)
                    points[0].x, points[0].y, points[0].z,
                    points[3].x, points[3].y, points[3].z,
                    points[2].x, points[2].y, points[2].z
                ]), 3));
                
                // Update UV coordinates for flipped vertices
                geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
                    0, 0,
                    1, 1,
                    1, 0,
                    
                    0, 0,
                    0, 1,
                    1, 1
                ]), 2));
                
                // Update UV2 coordinates for ambient occlusion
                geometry.setAttribute('uv2', new THREE.BufferAttribute(new Float32Array([
                    0, 0,
                    1, 1,
                    1, 0,
                    
                    0, 0,
                    0, 1,
                    1, 1
                ]), 2));
            }
        }
        
        // Create and add label to the wall
        const label = createTextLabel(wallLabels[index]);
        label.name = `wallLabel${index}`;
        
        // Calculate wall normal vector (pointing inward)
        const normal = calculateNormal(points[0], points[1], points[2]);
        // Make sure it points inward
        const wallCenter = calculateWallCenter(points[0], points[1], points[2], points[3]);
        const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, wallCenter.y, 0), wallCenter);
        const dotProduct = normal.dot(toCenter);
        const wallNormal = normal.clone();
        if (dotProduct < 0) {
            wallNormal.negate();
        }
        
        // Calculate the wall's face center
        const wallFaceCenter = new THREE.Vector3(
            wallCenter.x,
            roomHeight / 2, // Center height of the wall
            wallCenter.z
        );
        
        // Position label slightly in front of the wall (inward)
        // Small offset to prevent z-fighting
        const labelOffset = 0.02;
        label.position.copy(wallFaceCenter.clone().add(wallNormal.multiplyScalar(labelOffset)));
        
        // Make the label face the same direction as the wall normal (inward)
        // We create a lookAt target point by extending the normal from the label position
        const lookTarget = label.position.clone().add(wallNormal.clone().multiplyScalar(1));
        label.lookAt(lookTarget);
        
        // Rotate the label to be right-side up
        label.rotation.z = 0;
        
        wallGroup.add(label);
        return wallGroup;
    }
    
    // Create all six walls with consistent winding order
    for (let i = 0; i < 6; i++) {
        // Define points in counterclockwise order (when viewed from inside)
        const floorPoint1 = floorVertices[i];
        const floorPoint2 = floorVertices[(i+1) % 6];
        const ceilingPoint2 = ceilingVertices[(i+1) % 6];
        const ceilingPoint1 = ceilingVertices[i];
        
        // Create wall with consistent winding order that ensures inward-facing normals
        const wall = createWall([
            floorPoint1,
            floorPoint2,
            ceilingPoint2,
            ceilingPoint1
        ], i);
        
        // Add wall to the room
        room.add(wall);
    }
    
    // Add a chandelier to the room
    addChandelierToRoom(room);
    
    // Add bookshelves to walls without doors
    addBookshelvesToRoom(room, doorWalls);
    
    return room;
}

// Function to add a chandelier to a room
function addChandelierToRoom(room) {
    if (!chandelierModel) {
        console.log('Chandelier model not loaded yet');
        return;
    }
    
    // Clone the model so we can use it multiple times
    const chandelier = chandelierModel.clone();
    
    // Position in center of the room near the ceiling
    // We'll position it a bit below the ceiling to create nice light distribution
    chandelier.position.set(0, roomHeight - 1.0, 0);
    
    // Add a point light to the chandelier to create a warm glow
    const chandelierGlow = new THREE.PointLight(0xFFC773, 1.2, 8);
    chandelierGlow.position.set(0, -0.5, 0); // Position slightly below the chandelier model
    chandelierGlow.castShadow = true;
    chandelierGlow.shadow.mapSize.width = 512;
    chandelierGlow.shadow.mapSize.height = 512;
    chandelier.add(chandelierGlow);
    
    // Add properties for the flickering effect
    chandelierGlow.userData.baseIntensity = 1.2; // Same as the initial intensity above
    chandelierGlow.userData.flickerSpeed = 0.05;
    chandelierGlow.userData.flickerIntensity = 0.2;
    
    // Create the update function in a way that preserves 'this' context
    chandelierGlow.userData.update = function(delta) {
        // Add subtle random flickering to the light
        const light = this;
        light.intensity = light.userData.baseIntensity + 
            Math.sin(Date.now() * light.userData.flickerSpeed) * light.userData.flickerIntensity * Math.random();
    };
    
    // Make the chandelier materials emit light (glow)
    chandelier.traverse(child => {
        if (child.isMesh && child.material) {
            // Clone the material to avoid modifying the original
            if (Array.isArray(child.material)) {
                child.material = child.material.map(mat => mat.clone());
                child.material.forEach(mat => {
                    mat.emissive = new THREE.Color(0xFFA726); // Warm orange glow
                    mat.emissiveIntensity = 0.4; // Not too intense
                });
            } else {
                child.material = child.material.clone();
                child.material.emissive = new THREE.Color(0xFFA726);
                child.material.emissiveIntensity = 0.4;
            }
        }
    });
    
    // Add to the room
    room.add(chandelier);
    
    // Store a reference to this chandelier light in the room's userData
    room.userData.chandelierLight = chandelierGlow;
    
    return chandelier;
}

// Function to calculate room position in 3D space
function calculateRoomPosition(q, r) {
    // Convert axial coordinates to 3D position
    // Each room is positioned on a hexagonal grid
    const x = roomRadius * 2 * (q * 0.75);
    const z = roomRadius * 2 * (r * Math.sqrt(3)/2 + q * Math.sqrt(3)/4);
    
    return { x, y: 0, z };
}

// Function to create rooms up to a certain ring number - REMOVED
// Now we only create rooms as the player explores
function createRooms(maxRing) {
    // We now only create the center room initially
    createAndAddRoom(0, 0);
}

// Function to create a room and add it to the scene
function createAndAddRoom(q, r) {
    if (rooms.has(`${q},${r}`)) return; // Skip if room already exists
    
    const room = createHexagonalRoom(q, r);
    const position = calculateRoomPosition(q, r);
    room.position.set(position.x, position.y, position.z);
    
    // Store room reference in the rooms map
    rooms.set(`${q},${r}`, room);
    
    // Add room to scene (only if it's the current room or adjacent)
    const distanceToCurrentRoom = Math.max(
        Math.abs(currentRoom.q - q),
        Math.abs(currentRoom.r - r),
        Math.abs(currentRoom.q + currentRoom.r - q - r)
    );
    
    if (distanceToCurrentRoom <= 1) {
        scene.add(room);
    }
}

// Function to create a single hexagonal room and add it to the scene
function createSingleRoom() {
    // Initialize the visited rooms data structure for the first room if needed
    const roomKey = `${currentRoom.q},${currentRoom.r}`;
    if (!visitedRooms.has(roomKey)) {
        determineDoorsForRoom(currentRoom.q, currentRoom.r);
    } else {
        // Make sure the room has exactly 2 doors
        const roomData = visitedRooms.get(roomKey);
        if (roomData.doors.length !== 2) {
            console.log(`Fixing room ${roomKey} door count: ${roomData.doors.length}`);
            determineDoorsForRoom(currentRoom.q, currentRoom.r);
        }
    }
    
    singleRoom = createHexagonalRoom(currentRoom.q, currentRoom.r);
    scene.add(singleRoom);
}

// Helper function to properly recreate the single room with all doors
function recreateSingleRoom() {
    // Remove old room
    if (singleRoom) {
        scene.remove(singleRoom);
    }
    
    // Create a new room
    singleRoom = createHexagonalRoom(currentRoom.q, currentRoom.r);
    scene.add(singleRoom);
    
    // Return the new room
    return singleRoom;
}

// Function to update the single room to represent coordinates (q,r)
function updateRoomAppearance(q, r) {
    // Ensure this room has exactly 2 doors before recreating
    const roomKey = `${q},${r}`;
    if (visitedRooms.has(roomKey)) {
        const roomData = visitedRooms.get(roomKey);
        if (roomData.doors.length !== 2) {
            console.log(`Fixing room ${roomKey} with ${roomData.doors.length} doors before recreating`);
            determineDoorsForRoom(q, r);
        }
    } else {
        // Room should always exist at this point but just in case
        determineDoorsForRoom(q, r);
    }

    // Completely recreate the room to ensure all doors are properly created
    recreateSingleRoom();
    
    // Since recreateSingleRoom creates a new room instance, we need to add the chandelier
    // No need to add here as createHexagonalRoom will add the chandelier
    
    // Update user info
    document.getElementById('info').textContent = `You are in room (${q},${r}) on ring ${calculateRing(q, r)}. Use WASD to move and mouse to look around.`;
}

// Helper function to calculate wall points for a given wall index
function calculateWallPoints(wallIndex) {
    // Calculate vertices for the hexagon
    const hexPoints = [];
    for (let i = 0; i < 6; i++) {
        // 30° offset to align hexagon correctly
        const angle = i * Math.PI / 3 + Math.PI / 6;
        const x = roomRadius * Math.cos(angle);
        const z = roomRadius * Math.sin(angle);
        hexPoints.push(new THREE.Vector2(x, z));
    }
    
    // Convert to 3D points
    const floorPoint1 = new THREE.Vector3(hexPoints[wallIndex].x, 0, hexPoints[wallIndex].y);
    const floorPoint2 = new THREE.Vector3(hexPoints[(wallIndex+1) % 6].x, 0, hexPoints[(wallIndex+1) % 6].y);
    const ceilingPoint2 = new THREE.Vector3(hexPoints[(wallIndex+1) % 6].x, roomHeight, hexPoints[(wallIndex+1) % 6].y);
    const ceilingPoint1 = new THREE.Vector3(hexPoints[wallIndex].x, roomHeight, hexPoints[wallIndex].y);
    
    return [floorPoint1, floorPoint2, ceilingPoint2, ceilingPoint1];
}

// Function to start portal transition effect
function startPortalTransition(doorWallIndex, targetQ, targetR) {
    console.log(`Starting portal transition through wall ${doorWallIndex} from (${currentRoom.q},${currentRoom.r}) to (${targetQ},${targetR})`);
    
    // Store camera forward direction before transition
    const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    doorTransitionHistory.cameraForward.copy(camDir);
    doorTransitionHistory.cameraRotation = camera.rotation.y;
    doorTransitionHistory.lastExitWall = doorWallIndex;
    
    // Compute the opposite wall (entry wall in the target room)
    const entryWall = getOppositeWall(doorWallIndex);
    doorTransitionHistory.lastEntryWall = entryWall;
    
    // Set portal effect parameters
    portalEffect.active = true;
    portalEffect.timer = 0;
    portalEffect.startQ = currentRoom.q;
    portalEffect.startR = currentRoom.r;
    portalEffect.targetQ = targetQ;
    portalEffect.targetR = targetR;
    portalEffect.exitWall = doorWallIndex;
    portalEffect.entryWall = entryWall; // Opposite wall in target room
    
    // Show the portal effect plane
    const portalPlane = singleRoom.getObjectByName("portalEffect");
    if (portalPlane) {
        portalPlane.visible = true;
        portalPlane.material.opacity = 0;
    }
    
    // Update visited rooms data structure - ensure the neighbor connection
    const currentRoomKey = `${currentRoom.q},${currentRoom.r}`;
    const targetRoomKey = `${targetQ},${targetR}`;
    
    // Make sure current room is in visitedRooms
    if (!visitedRooms.has(currentRoomKey)) {
        const doors = determineDoorsForRoom(currentRoom.q, currentRoom.r);
        visitedRooms.set(currentRoomKey, { 
            doors, 
            neighbors: new Map()
        });
    }
    
    // Update current room's neighbor map
    const currentRoomData = visitedRooms.get(currentRoomKey);
    currentRoomData.neighbors.set(doorWallIndex, { q: targetQ, r: targetR });
    
    // Create entry in target room if needed
    if (!visitedRooms.has(targetRoomKey)) {
        // The room doesn't exist yet, so we'll need to ensure it has a door back to us
        const doorToPlaceFirst = entryWall; // The entry wall must have a door back to us
        
        // Create the room data with at least this one door
        const targetRoomNeighbors = new Map();
        targetRoomNeighbors.set(doorToPlaceFirst, { q: currentRoom.q, r: currentRoom.r });
        
        // We need to pre-register this room with at least the door back to our current room
        visitedRooms.set(targetRoomKey, {
            doors: [doorToPlaceFirst], // Start with just one door
            neighbors: targetRoomNeighbors
        });
        
        // Immediately determine the second door by calling determineDoorsForRoom
        // This will find the second door and update the room data
        determineDoorsForRoom(targetQ, targetR);
        
        // Verify we now have exactly 2 doors
        const updatedTargetRoom = visitedRooms.get(targetRoomKey);
        if (updatedTargetRoom.doors.length !== 2) {
            console.error(`Target room ${targetRoomKey} doesn't have exactly 2 doors after initialization`);
        }
    } else {
        // The room exists, make sure it has a door back to our current room
        const targetRoomData = visitedRooms.get(targetRoomKey);
        if (!targetRoomData.doors.includes(entryWall)) {
            // This should not happen if our logic is correct, but just in case
            console.warn(`Target room ${targetRoomKey} doesn't have a door on wall ${entryWall} back to ${currentRoomKey}`);
            
            // Add the door and connection if it doesn't exist
            if (targetRoomData.doors.length < 2) {
                targetRoomData.doors.push(entryWall);
                targetRoomData.neighbors.set(entryWall, { q: currentRoom.q, r: currentRoom.r });
            } else {
                console.error(`Cannot add door to room ${targetRoomKey} as it already has 2 doors`);
                
                // Force the correct door configuration by replacing one of the doors
                // This is a last resort to maintain consistency
                targetRoomData.doors[1] = entryWall; // Replace the second door
                targetRoomData.neighbors.set(entryWall, { q: currentRoom.q, r: currentRoom.r });
            }
        }
        
        // Verify we have exactly 2 doors
        if (targetRoomData.doors.length !== 2) {
            console.error(`Target room ${targetRoomKey} doesn't have exactly 2 doors`);
            
            // Add a second door if needed
            if (targetRoomData.doors.length < 2) {
                determineDoorsForRoom(targetQ, targetR);
            }
        }
    }
}

// Function to move to a new room
function moveToRoom(q, r, exitWallIndex) {
    // Don't move if already in transition
    if (portalEffect.active) return;
    
    // Start portal transition effect
    startPortalTransition(exitWallIndex, q, r);
    
    // Update info text
    document.getElementById('info').textContent = `Transitioning to room (${q},${r})...`;
}

// Function to update portal effect
function updatePortalEffect(delta) {
    if (!portalEffect.active) return;
    
    // Update timer
    portalEffect.timer += delta;
    
    // Get portal plane
    const portalPlane = singleRoom.getObjectByName("portalEffect");
    if (!portalPlane) return;
    
    if (portalEffect.timer < portalEffect.duration / 2) {
        // Fade in phase
        const progress = portalEffect.timer / (portalEffect.duration / 2);
        portalPlane.material.opacity = progress;
    } else if (portalEffect.timer < portalEffect.duration) {
        // Halfway point - update room appearance
        if (portalEffect.timer - delta < portalEffect.duration / 2) {
            // Update current room coordinates
            currentRoom.q = portalEffect.targetQ;
            currentRoom.r = portalEffect.targetR;
            
            // Update room appearance to match new coordinates
            updateRoomAppearance(currentRoom.q, currentRoom.r);
            
            // Update the room indicator
            updateRoomIndicator(currentRoom.q, currentRoom.r);
            
            // Position the player near the entry wall in the new room
            positionPlayerAtEntryWall(portalEffect.entryWall);
            
            console.log(`Now in Room (${currentRoom.q},${currentRoom.r}) - Ring ${calculateRing(currentRoom.q, currentRoom.r)}, entered through wall ${portalEffect.entryWall}`);
        }
        
        // Fade out phase
        const progress = 1 - ((portalEffect.timer - portalEffect.duration / 2) / (portalEffect.duration / 2));
        portalPlane.material.opacity = progress;
    } else {
        // Effect complete
        portalEffect.active = false;
        portalPlane.visible = false;
    }
}

// Position player at the appropriate entry wall in the new room
function positionPlayerAtEntryWall(wallIndex) {
    // Get the wall points using the same calculation used to position doors
    const wallPoints = calculateWallPoints(wallIndex);
    
    // Calculate wall center using the same function used for door placement
    const wallCenter = new THREE.Vector3(
        (wallPoints[0].x + wallPoints[1].x + wallPoints[2].x + wallPoints[3].x) / 4,
        (wallPoints[0].y + wallPoints[1].y + wallPoints[2].y + wallPoints[3].y) / 4,
        (wallPoints[0].z + wallPoints[1].z + wallPoints[2].z + wallPoints[3].z) / 4
    );
    
    // Calculate direction vector from wall center to room center
    const roomCenter = new THREE.Vector3(0, wallCenter.y, 0);
    const dirFromWallToCenter = new THREE.Vector3().subVectors(roomCenter, wallCenter).normalize();
    
    // Position player directly in front of the door (toward room center)
    const distanceFromWall = 1.8;
    const x = wallCenter.x + dirFromWallToCenter.x * distanceFromWall;
    const z = wallCenter.z + dirFromWallToCenter.z * distanceFromWall;
    
    // Set player position
    camera.position.x = x;
    camera.position.z = z;
    
    // Always point toward the center of the room
    camera.lookAt(new THREE.Vector3(0, camera.position.y, 0));
    
    // Update controls to match camera rotation
    controls.getObject().position.copy(camera.position);
    const facingAngle = Math.atan2(-dirFromWallToCenter.x, -dirFromWallToCenter.z);
    controls.getObject().rotation.y = facingAngle;
    
    // Update transition history
    doorTransitionHistory.cameraRotation = facingAngle;
    doorTransitionHistory.lastEntryWall = wallIndex;
    
    console.log(`Positioned in front of door at wall ${wallIndex}`);
}

// Create the single room
createSingleRoom();

// Position camera inside the room
camera.position.set(0, 1.6, 0);

// Collision detection
const raycaster = new THREE.Raycaster();
const direction = new THREE.Vector3();
let velocity = new THREE.Vector3();
const clock = new THREE.Clock();

// Add ray for door detection
const doorRaycaster = new THREE.Raycaster();
const doorCheckDistance = 1.5; // Increased from 1.2 for easier door detection
let nearDoor = null; // Track which door the player is near

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    // Update portal effect if active
    updatePortalEffect(delta);
    
    // Update chandelier flickering if it exists
    if (singleRoom && singleRoom.userData.chandelierLight) {
        const light = singleRoom.userData.chandelierLight;
        if (light && typeof light.userData.update === 'function') {
            try {
                // Call the update function with the light as 'this'
                light.userData.update.call(light, delta);
            } catch (e) {
                // Handle any errors silently to prevent animation loop from breaking
                console.log('Error updating chandelier light:', e);
            }
        }
    }
    
    // Update door lights pulsing effect
    if (singleRoom) {
        // Find all door wall groups
        singleRoom.traverse(object => {
            if (object.userData && object.userData.doorLight && 
                typeof object.userData.doorLight.userData.update === 'function') {
                try {
                    // Call the update function with the light as 'this'
                    object.userData.doorLight.userData.update.call(object.userData.doorLight, delta);
                } catch (e) {
                    // Handle any errors silently
                    console.log('Error updating door light:', e);
                }
            }
        });
        
        // Update bookshelf lights
        for (let wallIndex = 0; wallIndex < 6; wallIndex++) {
            const bookshelf = singleRoom.getObjectByName(`bookshelf${wallIndex}`);
            if (bookshelf) {
                // Find the light in the bookshelf children
                bookshelf.children.forEach(child => {
                    if (child instanceof THREE.PointLight && child.userData.update) {
                        try {
                            child.userData.update.call(child, delta);
                        } catch (e) {
                            console.log('Error updating bookshelf light:', e);
                        }
                    }
                });
            }
        }
    }
    
    const speed = 5.0;
    
    velocity.x = 0;
    velocity.z = 0;
    
    if (controls.isLocked && !portalEffect.active) {
        // Calculate movement direction
        if (moveForward) {
            velocity.z = speed * delta;
        }
        if (moveBackward) {
            velocity.z = -speed * delta;
        }
        if (moveLeft) {
            velocity.x = -speed * delta;
        }
        if (moveRight) {
            velocity.x = speed * delta;
        }
        
        // Apply movement in camera direction
        if (moveForward || moveBackward) {
            controls.moveForward(velocity.z);
        }
        if (moveLeft || moveRight) {
            controls.moveRight(velocity.x);
        }
        
        // Check for doors in front of player
        const camDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        nearDoor = isNearDoor(camera.position, camDirection, doorCheckDistance);
        
        if (nearDoor) {
            // If user is pressing forward and very close to door, transport to the next room
            if (moveForward) {
                // Check again with a shorter distance for actual teleportation
                const doorForTeleport = isNearDoor(camera.position, camDirection, 1.0);
                if (doorForTeleport && 
                    doorForTeleport.userData.targetQ !== undefined && 
                    doorForTeleport.userData.targetR !== undefined && 
                    doorForTeleport.userData.wallIndex !== undefined) {
                    
                    const exitWallIndex = doorForTeleport.userData.wallIndex;
                    const targetQ = doorForTeleport.userData.targetQ;
                    const targetR = doorForTeleport.userData.targetR;
                    
                    console.log("Teleporting to new room through wall", exitWallIndex, ":", targetQ, targetR);
                    
                    // Calculate the room ring
                    const targetRing = calculateRing(targetQ, targetR);
                    const currentRing = calculateRing(currentRoom.q, currentRoom.r);
                    
                    // Log ring transition info for navigation
                    if (targetRing !== currentRing) {
                        console.log(`Moving from ring ${currentRing} to ring ${targetRing}`);
                    }
                    
                    moveToRoom(targetQ, targetR, exitWallIndex);
                } else if (doorForTeleport) {
                    console.error("Door has invalid target room coordinates:", doorForTeleport);
                }
            }
        }
        
        // Update info text based on door proximity
        if (nearDoor && !portalEffect.active) {
            document.getElementById('info').textContent = 'Press W to go through the door';
        } else if (!portalEffect.active) {
            document.getElementById('info').textContent = `You are in room (${currentRoom.q},${currentRoom.r}) on ring ${calculateRing(currentRoom.q, currentRoom.r)}. Use WASD to move and mouse to look around.`;
        }
        
        // Simple collision detection to prevent going through walls
        // Skip collision detection near doors
        if (!nearDoor) {
            const collisionDistance = 0.5;
            
            for (let i = 0; i < 8; i++) {
                const angle = i * Math.PI / 4;
                direction.set(Math.sin(angle), 0, Math.cos(angle));
                direction.normalize();
                
                raycaster.set(camera.position, direction);
                const intersects = raycaster.intersectObjects(scene.children, true);
                
                // Skip collision with doors
                let hitWall = false;
                for (let j = 0; j < intersects.length; j++) {
                    let obj = intersects[j].object;
                    let isDoor = false;
                    
                    // Check if this object or any parent is a door
                    while (obj) {
                        if (obj.userData && obj.userData.isDoor) {
                            isDoor = true;
                            break;
                        }
                        obj = obj.parent;
                    }
                    
                    if (!isDoor && intersects[j].distance < collisionDistance) {
                        hitWall = true;
                        break;
                    }
                }
                
                if (hitWall) {
                    // Move player away from collision
                    const pushBack = 0.1;
                    camera.position.x += direction.x * -pushBack;
                    camera.position.z += direction.z * -pushBack;
                }
            }
        }
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize the experience
function init() {
    createRoomIndicator();
    setupLightingGUI();
    animate();
}

// Export the init function to be called from the 3d.pug file
export { init };

// Function to check if we're near a door and should ignore collision
function isNearDoor(position, direction, distance = 0.8) {
    // Use doorRaycaster to check for doors
    doorRaycaster.set(position, direction);
    const intersects = doorRaycaster.intersectObjects(scene.children, true);
    
    for (let i = 0; i < intersects.length; i++) {
        // Check if it's a door or part of a door
        let object = intersects[i].object;
        let doorObject = null;
        
        // Check if the object itself is a door
        if (object.userData && object.userData.isDoor) {
            doorObject = object;
        } else {
            // Walk up the hierarchy to find a door parent
            let parent = object.parent;
            while (parent && !doorObject) {
                if (parent.userData && parent.userData.isDoor) {
                    doorObject = parent;
                }
                parent = parent.parent;
            }
        }
        
        // If we found a door and we're close enough
        if (doorObject && intersects[i].distance < distance) {
            // Make sure we're using the door group's userData (which has the targetQ and targetR)
            // If the object is just a mesh part of the door, navigate up to find the group
            while (doorObject.parent && 
                  (!doorObject.userData.targetQ || !doorObject.userData.targetR || 
                   doorObject.userData.targetQ === undefined || doorObject.userData.targetR === undefined ||
                   doorObject.userData.wallIndex === undefined)) {
                if (doorObject.parent.userData && 
                    doorObject.parent.userData.targetQ !== undefined && 
                    doorObject.parent.userData.targetR !== undefined &&
                    doorObject.parent.userData.wallIndex !== undefined) {
                    doorObject = doorObject.parent;
                    break;
                }
                doorObject = doorObject.parent;
            }
            
            // Final check to make sure we have valid target coordinates and wall index
            if (doorObject.userData && 
                doorObject.userData.targetQ !== undefined && 
                doorObject.userData.targetR !== undefined && 
                doorObject.userData.wallIndex !== undefined) {
                
                // Log door information for debugging
                console.log(`Door detected: Wall ${doorObject.userData.wallIndex} leading to room (${doorObject.userData.targetQ},${doorObject.userData.targetR})`);
                console.log(`Entry wall will be ${getOppositeWall(doorObject.userData.wallIndex)}`);
                
                return doorObject;
            }
        }
    }
    
    return null;
}

// Create a prominent UI indicator for the current room
function createRoomIndicator() {
    const roomIndicator = document.createElement('div');
    roomIndicator.id = 'room-indicator';
    roomIndicator.style.position = 'fixed';
    roomIndicator.style.top = '10px';
    roomIndicator.style.left = '50%';
    roomIndicator.style.transform = 'translateX(-50%)';
    roomIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    roomIndicator.style.color = '#fff';
    roomIndicator.style.padding = '10px 20px';
    roomIndicator.style.borderRadius = '5px';
    roomIndicator.style.fontFamily = 'Arial, sans-serif';
    roomIndicator.style.fontSize = '18px';
    roomIndicator.style.zIndex = '1000';
    roomIndicator.style.border = '2px solid #4169E1';
    roomIndicator.style.transition = 'all 0.3s ease';
    document.body.appendChild(roomIndicator);
    
    // Add a map button
    const mapButton = document.createElement('button');
    mapButton.id = 'map-button';
    mapButton.textContent = 'Show Map';
    mapButton.style.position = 'fixed';
    mapButton.style.top = '60px';
    mapButton.style.left = '50%';
    mapButton.style.transform = 'translateX(-50%)';
    mapButton.style.padding = '5px 15px';
    mapButton.style.backgroundColor = '#4169E1';
    mapButton.style.color = 'white';
    mapButton.style.border = 'none';
    mapButton.style.borderRadius = '3px';
    mapButton.style.cursor = 'pointer';
    mapButton.style.fontFamily = 'Arial, sans-serif';
    mapButton.style.zIndex = '1000';
    document.body.appendChild(mapButton);
    
    // Add a help text for exploration
    const helpText = document.createElement('div');
    helpText.id = 'help-text';
    helpText.textContent = 'Explore the hexagonal rooms - each has exactly two doors';
    helpText.style.position = 'fixed';
    helpText.style.bottom = '20px';
    helpText.style.left = '50%';
    helpText.style.transform = 'translateX(-50%)';
    helpText.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    helpText.style.color = '#fff';
    helpText.style.padding = '10px 20px';
    helpText.style.borderRadius = '5px';
    helpText.style.fontFamily = 'Arial, sans-serif';
    helpText.style.fontSize = '14px';
    helpText.style.zIndex = '1000';
    document.body.appendChild(helpText);
    
    // Create the map container (initially hidden)
    const mapContainer = document.createElement('div');
    mapContainer.id = 'map-container';
    mapContainer.style.position = 'fixed';
    mapContainer.style.top = '50%';
    mapContainer.style.left = '50%';
    mapContainer.style.transform = 'translate(-50%, -50%)';
    mapContainer.style.width = '300px';
    mapContainer.style.height = '300px';
    mapContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    mapContainer.style.color = 'white';
    mapContainer.style.padding = '20px';
    mapContainer.style.borderRadius = '10px';
    mapContainer.style.display = 'none';
    mapContainer.style.zIndex = '1001';
    mapContainer.style.border = '2px solid #4169E1';
    mapContainer.innerHTML = `
        <h3 style="text-align: center; margin-top: 0;">Hexagonal Map</h3>
        <canvas id="map-canvas" width="250" height="250"></canvas>
        <button id="close-map" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
    `;
    document.body.appendChild(mapContainer);
    
    // Add event listeners for map toggle
    mapButton.addEventListener('click', () => {
        if (mapContainer.style.display === 'none') {
            mapContainer.style.display = 'block';
            drawMap();
            controls.unlock();
        } else {
            mapContainer.style.display = 'none';
        }
    });
    
    document.getElementById('close-map').addEventListener('click', () => {
        mapContainer.style.display = 'none';
    });
    
    updateRoomIndicator(currentRoom.q, currentRoom.r);
}

// Function to draw a simple hexagonal map showing visited rooms
function drawMap() {
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const hexSize = 15; // Size of each hexagon
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Function to convert axial coordinates to pixel coordinates
    function axialToPixel(q, r) {
        const x = centerX + hexSize * 1.5 * q;
        const y = centerY + hexSize * Math.sqrt(3) * (r + q/2);
        return { x, y };
    }
    
    // Verify and fix door connections before drawing
    // This ensures neighboring rooms have properly matching doors
    function verifyDoorConnections() {
        let fixedConnections = 0;
        
        // Check all visited rooms
        for (const [roomKey, roomData] of visitedRooms.entries()) {
            const [q, r] = roomKey.split(',').map(Number);
            
            // Check each door's connection
            for (const [wallIndex, neighbor] of roomData.neighbors.entries()) {
                const neighborKey = `${neighbor.q},${neighbor.r}`;
                
                // If neighbor exists, check if it has a corresponding door back
                if (visitedRooms.has(neighborKey)) {
                    const neighborRoom = visitedRooms.get(neighborKey);
                    const oppositeWall = getOppositeWall(wallIndex);
                    
                    // Check if neighbor has a door back to this room
                    let hasMatchingDoor = false;
                    for (const [neighborWall, neighborTarget] of neighborRoom.neighbors.entries()) {
                        if (neighborWall === oppositeWall && 
                            neighborTarget.q === q && 
                            neighborTarget.r === r) {
                            hasMatchingDoor = true;
                            break;
                        }
                    }
                    
                    // If no matching door, add one
                    if (!hasMatchingDoor) {
                        console.log(`Fixing door connection: Room ${neighborKey} missing door to ${roomKey}`);
                        
                        // Add the corresponding door in the neighbor room
                        if (neighborRoom.doors.includes(oppositeWall)) {
                            // The wall exists as a door but points to wrong room
                            neighborRoom.neighbors.set(oppositeWall, {q: q, r: r});
                        } else if (neighborRoom.doors.length < 2) {
                            // Add a new door
                            neighborRoom.doors.push(oppositeWall);
                            neighborRoom.neighbors.set(oppositeWall, {q: q, r: r});
                        } else {
                            // Replace a door if necessary
                            // Find a door that doesn't point to this room
                            const doorToReplace = neighborRoom.doors.find(door => 
                                !neighborRoom.neighbors.has(door) || 
                                (neighborRoom.neighbors.get(door).q !== q || 
                                 neighborRoom.neighbors.get(door).r !== r)
                            );
                            
                            if (doorToReplace !== undefined && doorToReplace !== getOppositeWall(wallIndex)) {
                                // Replace the door
                                const idx = neighborRoom.doors.indexOf(doorToReplace);
                                neighborRoom.doors[idx] = oppositeWall;
                                neighborRoom.neighbors.set(oppositeWall, {q: q, r: r});
                            }
                        }
                        
                        fixedConnections++;
                    }
                }
            }
            
            // Ensure the room has exactly 2 doors
            if (roomData.doors.length !== 2) {
                console.log(`Room ${roomKey} has ${roomData.doors.length} doors, fixing...`);
                determineDoorsForRoom(q, r);
                fixedConnections++;
            }
        }
        
        if (fixedConnections > 0) {
            console.log(`Fixed ${fixedConnections} door connections`);
        }
        
        return fixedConnections;
    }
    
    // Verify door connections until everything is correct
    // Limit to 3 iterations to prevent infinite loops
    for (let i = 0; i < 3; i++) {
        const fixedCount = verifyDoorConnections();
        if (fixedCount === 0) break;
    }
    
    // First draw connections between rooms
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
    ctx.lineWidth = 1;
    
    // Draw all connections first (behind rooms)
    for (const [roomKey, roomData] of visitedRooms.entries()) {
        const [q, r] = roomKey.split(',').map(Number);
        const pos = axialToPixel(q, r);
        
        // Draw connections to neighbors
        for (const [wallIndex, neighbor] of roomData.neighbors.entries()) {
            const neighborPos = axialToPixel(neighbor.q, neighbor.r);
            
            // Draw a line from room center to neighbor center
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(neighborPos.x, neighborPos.y);
            ctx.stroke();
        }
    }
    
    // Draw all visited rooms
    for (const [roomKey, roomData] of visitedRooms.entries()) {
        const [q, r] = roomKey.split(',').map(Number);
        const pos = axialToPixel(q, r);
        const isCurrent = (q === currentRoom.q && r === currentRoom.r);
        
        // Draw the hexagon for this room
        drawHexagon(ctx, pos.x, pos.y, hexSize, isCurrent);
        
        // Draw connections to neighbors (doors)
        for (const [wallIndex, neighbor] of roomData.neighbors.entries()) {
            const direction = wallToDirection(wallIndex);
            const doorX = pos.x + (hexSize * 0.7) * direction.q;
            const doorY = pos.y + (hexSize * 0.7) * Math.sqrt(3) * (direction.r + direction.q/2);
            
            // Draw a small circle for the door
            ctx.beginPath();
            ctx.arc(doorX, doorY, 2, 0, Math.PI * 2);
            
            // Use different colors for different door states
            if (roomData.doors.includes(wallIndex)) {
                ctx.fillStyle = 'red'; // Normal door
            } else {
                ctx.fillStyle = 'yellow'; // Connection without door (shouldn't happen)
                console.warn(`Room ${roomKey} has a connection on wall ${wallIndex} but no door`);
            }
            ctx.fill();
            
            // Add a small label for the wall index
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '6px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${wallIndex}`, doorX, doorY - 5);
        }
        
        // Draw room coordinates
        ctx.fillStyle = isCurrent ? 'white' : 'rgba(255, 255, 255, 0.7)';
        ctx.font = isCurrent ? 'bold 9px Arial' : '8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${q},${r}`, pos.x, pos.y + 3);
    }
    
    // Add a legend to show direction
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText('N', centerX, 15);
    ctx.fillText('S', centerX, canvas.height - 5);
    ctx.fillText('E', canvas.width - 15, centerY);
    ctx.fillText('W', 5, centerY);
    
    // Display current coordinates in the corner
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Current: (${currentRoom.q},${currentRoom.r})`, 5, canvas.height - 5);
    
    // Add wall index legend
    ctx.textAlign = 'right';
    ctx.fillText('Wall Index:', canvas.width - 5, canvas.height - 20);
    for (let i = 0; i < 6; i++) {
        ctx.fillText(`${i}: ${getWallDirectionName(i)}`, canvas.width - 5, canvas.height - 20 + (i+1) * 10);
    }
}

// Function to get wall direction name based on index
function getWallDirectionName(wallIndex) {
    const names = ['East', 'Southeast', 'Southwest', 'West', 'Northwest', 'Northeast'];
    return names[wallIndex];
}

// Function to draw a hexagon on the canvas
function drawHexagon(ctx, x, y, size, isCurrent) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(hx, hy);
        } else {
            ctx.lineTo(hx, hy);
        }
    }
    ctx.closePath();
    
    // Set different styles for current room vs. other rooms
    if (isCurrent) {
        ctx.fillStyle = '#4169E1'; // Highlight current room
        
        // Add a highlight effect - glow
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 10;
    } else {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        ctx.shadowBlur = 0;
    }
    ctx.fill();
    
    // Reset shadow for next drawings
    ctx.shadowBlur = 0;
    
    ctx.strokeStyle = isCurrent ? 'white' : 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = isCurrent ? 2 : 1;
    ctx.stroke();
}

// Update the room indicator
function updateRoomIndicator(q, r) {
    const ring = calculateRing(q, r);
    const roomIndicator = document.getElementById('room-indicator');
    if (roomIndicator) {
        roomIndicator.textContent = `Room (${q},${r}) - Ring ${ring}`;
        // Flash effect for room change
        roomIndicator.style.backgroundColor = 'rgba(65, 105, 225, 0.9)';
        setTimeout(() => {
            roomIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        }, 500);
    }
    
    // If the map is visible, update it
    if (document.getElementById('map-container').style.display !== 'none') {
        drawMap();
    }
}

// Add a container for lighting controls
const lightingControls = {
    ambientLightIntensity: 0.4, // Reduced from 0.6
    directionalLightIntensity: 0.5, // Reduced from 0.6
    directionalLight2Intensity: 0.3, // Reduced from 0.4
    chandelierLightIntensity: 0.6, // Reduced from 0.7
    chandelierLightColor: '#FFD6AA',
    accentLightIntensity: 0.2, // Reduced from 0.3
    wallMetalness: 0.7,
    wallRoughness: 0.3,
    exposure: 0.8, // Add exposure control
    physicalCamera: false, // Add physical camera option
    preset: 'Custom', // Current preset
    resetToDefaults: function() {
        // Reset to default values
        this.ambientLightIntensity = 0.4;
        this.directionalLightIntensity = 0.5;
        this.directionalLight2Intensity = 0.3;
        this.chandelierLightIntensity = 0.6;
        this.chandelierLightColor = '#FFD6AA';
        this.accentLightIntensity = 0.2;
        this.wallMetalness = 0.7;
        this.wallRoughness = 0.3;
        this.exposure = 0.8;
        this.physicalCamera = false;
        this.preset = 'Default';
        
        // Apply all changes
        updateLightingFromControls();
        
        // Save to localStorage
        saveLightingSettings();
    },
    saveSettings: function() {
        saveLightingSettings();
        alert('Lighting settings saved!');
    },
    applyPreset: function(presetName) {
        const preset = lightingPresets[presetName];
        if (preset) {
            // Apply all preset values
            Object.assign(this, preset);
            this.preset = presetName;
            
            // Update all controls with new values
            updateLightingFromControls();
            
            // Refresh GUI if needed
            if (this.guiControllers) {
                for (const controller of Object.values(this.guiControllers)) {
                    controller.updateDisplay();
                }
            }
        }
    }
};

// Define lighting presets
const lightingPresets = {
    'Default': {
        ambientLightIntensity: 0.4,
        directionalLightIntensity: 0.5,
        directionalLight2Intensity: 0.3,
        chandelierLightIntensity: 0.6,
        chandelierLightColor: '#FFD6AA',
        accentLightIntensity: 0.2,
        wallMetalness: 0.7,
        wallRoughness: 0.3,
        exposure: 0.8,
        physicalCamera: false
    },
    'Dramatic': {
        ambientLightIntensity: 0.2,
        directionalLightIntensity: 0.8,
        directionalLight2Intensity: 0.1,
        chandelierLightIntensity: 1.0,
        chandelierLightColor: '#FFC773',
        accentLightIntensity: 0.3,
        wallMetalness: 0.9,
        wallRoughness: 0.1,
        exposure: 0.7,
        physicalCamera: true
    },
    'Warm': {
        ambientLightIntensity: 0.5,
        directionalLightIntensity: 0.6,
        directionalLight2Intensity: 0.4,
        chandelierLightIntensity: 0.8,
        chandelierLightColor: '#FFBB77',
        accentLightIntensity: 0.4,
        wallMetalness: 0.6,
        wallRoughness: 0.3,
        exposure: 0.9,
        physicalCamera: false
    },
    'Cool': {
        ambientLightIntensity: 0.3,
        directionalLightIntensity: 0.5,
        directionalLight2Intensity: 0.4,
        chandelierLightIntensity: 0.6,
        chandelierLightColor: '#AAD6FF',
        accentLightIntensity: 0.2,
        wallMetalness: 0.8,
        wallRoughness: 0.2,
        exposure: 0.75,
        physicalCamera: true
    },
    'Dark': {
        ambientLightIntensity: 0.1,
        directionalLightIntensity: 0.3,
        directionalLight2Intensity: 0.2,
        chandelierLightIntensity: 0.5,
        chandelierLightColor: '#FFD6AA',
        accentLightIntensity: 0.1,
        wallMetalness: 0.8,
        wallRoughness: 0.4,
        exposure: 0.6,
        physicalCamera: false
    }
};

// Function to save lighting settings to localStorage
function saveLightingSettings() {
    try {
        const settings = {
            ambientLightIntensity: lightingControls.ambientLightIntensity,
            directionalLightIntensity: lightingControls.directionalLightIntensity,
            directionalLight2Intensity: lightingControls.directionalLight2Intensity,
            chandelierLightIntensity: lightingControls.chandelierLightIntensity,
            chandelierLightColor: lightingControls.chandelierLightColor,
            accentLightIntensity: lightingControls.accentLightIntensity,
            wallMetalness: lightingControls.wallMetalness,
            wallRoughness: lightingControls.wallRoughness,
            exposure: lightingControls.exposure,
            physicalCamera: lightingControls.physicalCamera,
            preset: lightingControls.preset
        };
        localStorage.setItem('hexRoomLightingSettings', JSON.stringify(settings));
        console.log('Lighting settings saved successfully');
    } catch (e) {
        console.error('Error saving lighting settings:', e);
    }
}

// Function to load lighting settings from localStorage
function loadLightingSettings() {
    try {
        const savedSettings = localStorage.getItem('hexRoomLightingSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            
            // Update control values with saved settings
            lightingControls.ambientLightIntensity = settings.ambientLightIntensity;
            lightingControls.directionalLightIntensity = settings.directionalLightIntensity;
            lightingControls.directionalLight2Intensity = settings.directionalLight2Intensity;
            lightingControls.chandelierLightIntensity = settings.chandelierLightIntensity;
            lightingControls.chandelierLightColor = settings.chandelierLightColor;
            lightingControls.accentLightIntensity = settings.accentLightIntensity;
            lightingControls.wallMetalness = settings.wallMetalness;
            lightingControls.wallRoughness = settings.wallRoughness;
            lightingControls.exposure = settings.exposure || 0.8; // Default if not in saved settings
            lightingControls.physicalCamera = settings.physicalCamera || false;
            lightingControls.preset = settings.preset || 'Custom';
            
            // Apply the loaded settings
            updateLightingFromControls();
            console.log('Lighting settings loaded successfully');
        }
    } catch (e) {
        console.error('Error loading lighting settings:', e);
    }
}

// Function to initialize the GUI
function setupLightingGUI() {
    const gui = new GUI({ title: 'Lighting Controls' });
    gui.width = 300;
    
    // Load saved settings if available
    loadLightingSettings();
    
    // Store controllers for later updating
    lightingControls.guiControllers = {};
    
    // Add preset selector at the top
    const presetOptions = Object.keys(lightingPresets);
    presetOptions.push('Custom');
    
    lightingControls.guiControllers.preset = gui.add(lightingControls, 'preset', presetOptions)
        .name('Lighting Preset')
        .onChange(value => {
            if (value !== 'Custom') {
                lightingControls.applyPreset(value);
            }
        });
    
    // Add renderer settings
    lightingControls.guiControllers.exposure = gui.add(lightingControls, 'exposure', 0.1, 2.0)
        .name('Exposure')
        .onChange(() => {
            renderer.toneMappingExposure = lightingControls.exposure;
            lightingControls.preset = 'Custom';
            lightingControls.guiControllers.preset.updateDisplay();
        });
        
    lightingControls.guiControllers.physicalCamera = gui.add(lightingControls, 'physicalCamera')
        .name('Physical Camera')
        .onChange(() => {
            if (lightingControls.physicalCamera) {
                camera.physicallyCorrectLights = true;
            } else {
                camera.physicallyCorrectLights = false;
            }
            lightingControls.preset = 'Custom';
            lightingControls.guiControllers.preset.updateDisplay();
        });
    
    // Folder for ambient lighting
    const ambientFolder = gui.addFolder('Ambient Light');
    lightingControls.guiControllers.ambientLightIntensity = ambientFolder.add(lightingControls, 'ambientLightIntensity', 0, 2)
        .name('Intensity')
        .onChange(() => {
            ambientLight.intensity = lightingControls.ambientLightIntensity;
            lightingControls.preset = 'Custom';
            lightingControls.guiControllers.preset.updateDisplay();
        });
    
    // Folder for directional lights
    const directionalFolder = gui.addFolder('Directional Lights');
    lightingControls.guiControllers.directionalLightIntensity = directionalFolder.add(lightingControls, 'directionalLightIntensity', 0, 2)
        .name('Main Intensity')
        .onChange(() => {
            directionalLight.intensity = lightingControls.directionalLightIntensity;
            lightingControls.preset = 'Custom';
            lightingControls.guiControllers.preset.updateDisplay();
        });
    lightingControls.guiControllers.directionalLight2Intensity = directionalFolder.add(lightingControls, 'directionalLight2Intensity', 0, 2)
        .name('Secondary Intensity')
        .onChange(() => {
            directionalLight2.intensity = lightingControls.directionalLight2Intensity;
            lightingControls.preset = 'Custom';
            lightingControls.guiControllers.preset.updateDisplay();
        });
    
    // Folder for chandelier light
    const chandelierFolder = gui.addFolder('Chandelier Light');
    lightingControls.guiControllers.chandelierLightIntensity = chandelierFolder.add(lightingControls, 'chandelierLightIntensity', 0, 2)
        .name('Intensity')
        .onChange(() => {
            chandelierLight.intensity = lightingControls.chandelierLightIntensity;
            
            // Also update the individual chandelier in the room if it exists
            if (singleRoom && singleRoom.userData.chandelierLight) {
                singleRoom.userData.chandelierLight.userData.baseIntensity = lightingControls.chandelierLightIntensity;
            }
            
            lightingControls.preset = 'Custom';
            lightingControls.guiControllers.preset.updateDisplay();
        });
    lightingControls.guiControllers.chandelierLightColor = chandelierFolder.addColor(lightingControls, 'chandelierLightColor')
        .name('Color')
        .onChange(() => {
            chandelierLight.color.set(lightingControls.chandelierLightColor);
            
            // Also update the individual chandelier in the room if it exists
            if (singleRoom && singleRoom.userData.chandelierLight) {
                singleRoom.userData.chandelierLight.color.set(lightingControls.chandelierLightColor);
            }
            
            lightingControls.preset = 'Custom';
            lightingControls.guiControllers.preset.updateDisplay();
        });
    
    // Folder for accent lights
    const accentFolder = gui.addFolder('Accent Lights');
    lightingControls.guiControllers.accentLightIntensity = accentFolder.add(lightingControls, 'accentLightIntensity', 0, 2)
        .name('Intensity')
        .onChange(() => {
            accentLight1.intensity = lightingControls.accentLightIntensity;
            accentLight2.intensity = lightingControls.accentLightIntensity;
            
            lightingControls.preset = 'Custom';
            lightingControls.guiControllers.preset.updateDisplay();
        });
    
    // Folder for material properties
    const materialFolder = gui.addFolder('Wall Material');
    lightingControls.guiControllers.wallMetalness = materialFolder.add(lightingControls, 'wallMetalness', 0, 1)
        .name('Metalness')
        .onChange(() => {
            wallMaterial.metalness = lightingControls.wallMetalness;
            wallMaterial.needsUpdate = true;
            
            lightingControls.preset = 'Custom';
            lightingControls.guiControllers.preset.updateDisplay();
        });
    lightingControls.guiControllers.wallRoughness = materialFolder.add(lightingControls, 'wallRoughness', 0, 1)
        .name('Roughness')
        .onChange(() => {
            wallMaterial.roughness = lightingControls.wallRoughness;
            wallMaterial.needsUpdate = true;
            
            lightingControls.preset = 'Custom';
            lightingControls.guiControllers.preset.updateDisplay();
        });
    
    // Add buttons for saving and resetting
    gui.add(lightingControls, 'saveSettings').name('Save Settings');
    gui.add(lightingControls, 'resetToDefaults').name('Reset to Defaults');
    
    // Position the GUI in the top-right corner
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '10px';
    gui.domElement.style.right = '10px';
    
    // Collapse folders by default
    ambientFolder.close();
    directionalFolder.close();
    chandelierFolder.close();
    accentFolder.close();
    materialFolder.close();
    
    return gui;
}

// Function to apply all lighting changes from controls
function updateLightingFromControls() {
    // Apply all lighting values
    ambientLight.intensity = lightingControls.ambientLightIntensity;
    directionalLight.intensity = lightingControls.directionalLightIntensity;
    directionalLight2.intensity = lightingControls.directionalLight2Intensity;
    chandelierLight.intensity = lightingControls.chandelierLightIntensity;
    chandelierLight.color.set(lightingControls.chandelierLightColor);
    accentLight1.intensity = lightingControls.accentLightIntensity;
    accentLight2.intensity = lightingControls.accentLightIntensity;
    
    // Apply material changes
    wallMaterial.metalness = lightingControls.wallMetalness;
    wallMaterial.roughness = lightingControls.wallRoughness;
    wallMaterial.needsUpdate = true;
    
    // Apply renderer changes
    renderer.toneMappingExposure = lightingControls.exposure;
    
    // Apply camera changes
    if (lightingControls.physicalCamera) {
        camera.physicallyCorrectLights = true;
    } else {
        camera.physicallyCorrectLights = false;
    }
    
    // Update the individual chandelier in the room if it exists
    if (singleRoom && singleRoom.userData.chandelierLight) {
        singleRoom.userData.chandelierLight.userData.baseIntensity = lightingControls.chandelierLightIntensity;
        singleRoom.userData.chandelierLight.color.set(lightingControls.chandelierLightColor);
    }
} 