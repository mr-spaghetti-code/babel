import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 0, 50);

// Set a helper text element to inform users about the room
document.getElementById('info').textContent = 'You are in a hexagonal room. Use WASD to move and mouse to look around.';

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 1.6; // Average eye height
camera.position.z = 0; // Center of the room

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x808080);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Add additional light sources
const pointLight1 = new THREE.PointLight(0xffffff, 0.8, 20);
pointLight1.position.set(0, 2, 0);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0xffffcc, 0.6, 15);
pointLight2.position.set(3, 2, 0);
scene.add(pointLight2);

// Add more lights to illuminate the hexagonal room evenly
const pointLight3 = new THREE.PointLight(0xffffcc, 0.6, 15);
pointLight3.position.set(-3, 2, 0);
scene.add(pointLight3);

const pointLight4 = new THREE.PointLight(0xffffcc, 0.6, 15);
pointLight4.position.set(0, 2, 3);
scene.add(pointLight4);

const pointLight5 = new THREE.PointLight(0xffffcc, 0.6, 15);
pointLight5.position.set(0, 2, -3);
scene.add(pointLight5);

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

// Wall dimensions
const wallWidth = 5;
const wallHeight = 3;
const wallThickness = 0.2;

// Materials
const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513,
    roughness: 0.6,
    metalness: 0.2
});

// Hexagonal room configuration
const roomRadius = 5; // Distance from center to each vertex
const roomHeight = 3; // Height of the room from floor to ceiling

// Door configuration
const doorWidth = 1.8;
const doorHeight = 2.2;
const doorColor = 0x4169E1; // Royal blue for doors

// Define room mapping system using axial coordinates (q,r)
// Where (0,0) is the center room
const rooms = new Map();
const currentRoom = { q: 0, r: 0 };
let maxRing = 5; // Increased from 2 to allow for more rooms

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

// Additional materials for floor and ceiling
const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x654321,  // Darker brown for the floor
    roughness: 0.8,
    metalness: 0.1
});

const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0xA18262,  // Lighter brown for the ceiling
    roughness: 0.7,
    metalness: 0.1
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

// Function to calculate the ring number of a hexagonal cell at coordinates (q,r)
function calculateRing(q, r) {
    return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q-r));
}

// Function to convert wall number to direction in axial coordinates
function wallToDirection(wallNumber) {
    // Direction mapping based on wall numbers (using the convention from the spiral algorithm)
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

// Function to find the opposite wall number
function getOppositeWall(wallNumber) {
    return (wallNumber + 3) % 6;
}

// Function to determine which walls should have doors in a room
function determineDoorsForRoom(q, r) {
    const ring = calculateRing(q, r);
    
    // Center room special case
    if (ring === 0) {
        return [0, 3]; // East and West doors for better consistency
    }
    
    // Direction vectors for the six walls
    const directions = [
        {q: 1, r: 0},    // 0: East
        {q: 1, r: -1},   // 1: Southeast
        {q: 0, r: -1},   // 2: Southwest
        {q: -1, r: 0},   // 3: West
        {q: -1, r: 1},   // 4: Northwest
        {q: 0, r: 1}     // 5: Northeast
    ];
    
    // Every room needs exactly two doors
    const doors = [];
    
    // Check each possible neighboring cell
    const neighbors = [];
    for (let i = 0; i < 6; i++) {
        const direction = directions[i];
        const neighborQ = q + direction.q;
        const neighborR = r + direction.r;
        const neighborRing = calculateRing(neighborQ, neighborR);
        
        if (neighborRing <= maxRing) {
            neighbors.push({
                wallIndex: i,
                q: neighborQ, 
                r: neighborR,
                ring: neighborRing
            });
        }
    }
    
    // If this is the outermost ring, we want exactly one door (to inner ring)
    if (ring === maxRing) {
        // Find the neighbor with the lowest ring number (closest to center)
        neighbors.sort((a, b) => a.ring - b.ring);
        if (neighbors.length > 0) {
            doors.push(neighbors[0].wallIndex);
        }
        return doors;
    }
    
    // For all other rooms, pick two doors on opposite sides
    if (doors.length < 2) {
        // First try to place doors on opposite walls (0-3, 1-4, 2-5)
        // This provides a consistent east-west passage through most rooms
        if (!doors.includes(0) && !doors.includes(3)) {
            doors.push(0); // East
            doors.push(3); // West
        } else if (!doors.includes(1) && !doors.includes(4)) {
            doors.push(1); // Southeast
            doors.push(4); // Northwest
        } else if (!doors.includes(2) && !doors.includes(5)) {
            doors.push(2); // Southwest
            doors.push(5); // Northeast
        } else {
            // If we can't place doors on opposite walls, place them 2 walls apart
            if (!doors.includes(0) && !doors.includes(2)) {
                doors.push(0);
                doors.push(2);
            } else if (!doors.includes(1) && !doors.includes(3)) {
                doors.push(1);
                doors.push(3);
            } else if (!doors.includes(2) && !doors.includes(4)) {
                doors.push(2);
                doors.push(4);
            } else if (!doors.includes(3) && !doors.includes(5)) {
                doors.push(3);
                doors.push(5);
            } else if (!doors.includes(4) && !doors.includes(0)) {
                doors.push(4);
                doors.push(0);
            } else if (!doors.includes(5) && !doors.includes(1)) {
                doors.push(5);
                doors.push(1);
            }
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

// Function to create a hexagonal room with doors
function createHexagonalRoom(q, r) {
    const room = new THREE.Group();
    room.userData = { q: q, r: r, type: 'room' };
    
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
    
    // Create floor mesh and rotate to lie flat on XZ plane
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = Math.PI / 2;
    floor.position.y = 0; // Position exactly at y=0 to be flush with walls
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
    
    // Wall labels - change naming convention to match the spiral algorithm
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
            
            // Get direction to the next room
            const dir = wallToDirection(index);
            
            // Set door's target room coordinates
            door.userData.targetQ = q + dir.q;
            door.userData.targetR = r + dir.r;
            
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
            
            // Create meshes for each wall section
            const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
            const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
            const topWall = new THREE.Mesh(topWallGeometry, wallMaterial);
            
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
            
            // Calculate face normal to verify orientation
            const normal = calculateNormal(points[0], points[1], points[2]);
            
            // Calculate wall center
            const wallCenter = calculateWallCenter(points[0], points[1], points[2], points[3]);
            
            // Vector from wall center to hexagon center (which is at 0,0,0)
            const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, wallCenter.y, 0), wallCenter);
            
            // Check if the normal points toward the center (dot product > 0)
            const dotProduct = normal.dot(toCenter);
            
            // Create the wall mesh
            const wall = new THREE.Mesh(geometry, wallMaterial);
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
    
    return room;
}

// Function to calculate room position in 3D space
function calculateRoomPosition(q, r) {
    // Convert axial coordinates to 3D position
    // Each room is positioned on a hexagonal grid
    const x = roomRadius * 2 * (q * 0.75);
    const z = roomRadius * 2 * (r * Math.sqrt(3)/2 + q * Math.sqrt(3)/4);
    
    return { x, y: 0, z };
}

// Function to create rooms up to a certain ring number
function createRooms(maxRing) {
    // Create center room first
    createAndAddRoom(0, 0);
    
    // Direction vectors for the six walls
    const directions = [
        {q: 1, r: 0},    // 0: East
        {q: 1, r: -1},   // 1: Southeast
        {q: 0, r: -1},   // 2: Southwest
        {q: -1, r: 0},   // 3: West
        {q: -1, r: 1},   // 4: Northwest
        {q: 0, r: 1}     // 5: Northeast
    ];
    
    // Start at the center
    let q = 0;
    let r = 0;
    
    // For each ring
    for (let ring = 1; ring <= maxRing; ring++) {
        // Move to the first room in this ring (0,ring)
        q = 0;
        r = ring;
        
        // Create the first room of the ring
        createAndAddRoom(q, r);
        
        // Follow the ring edges in order
        for (let edge = 0; edge < 6; edge++) {
            const dirIndex = edge; // Direction to move along this edge
            
            // Move 'ring' steps along this edge
            for (let i = 0; i < ring; i++) {
                // Skip the first step on the first edge because we already created that room
                if (!(edge === 0 && i === 0)) {
                    // Move to the next position
                    q += directions[dirIndex].q;
                    r += directions[dirIndex].r;
                    
                    // Create room at this position
                    createAndAddRoom(q, r);
                }
            }
        }
    }
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
    // Completely recreate the room to ensure all doors are properly created
    recreateSingleRoom();
    
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
    // This is the wall opposite to the exit wall (doorWallIndex)
    // Wall 0 (East) is opposite to Wall 3 (West)
    // Wall 1 (Southeast) is opposite to Wall 4 (Northwest)
    // Wall 2 (Southwest) is opposite to Wall 5 (Northeast)
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
    
    // Point toward the center of the room
    const playerPos = new THREE.Vector3(x, camera.position.y, z);
    const dirToCenter = new THREE.Vector3().subVectors(roomCenter, playerPos).normalize();
    
    // Calculate the angle to face the center (in the XZ plane)
    const facingAngle = Math.atan2(-dirToCenter.x, -dirToCenter.z);
    
    // Reset camera's rotation completely
    camera.rotation.set(0, 0, 0);
    
    // Apply the new facing angle
    camera.rotation.y = facingAngle;
    
    // Update controls to match camera rotation
    controls.getObject().position.copy(camera.position);
    controls.getObject().rotation.y = facingAngle;
    
    // Update transition history
    doorTransitionHistory.cameraRotation = facingAngle;
    doorTransitionHistory.lastEntryWall = wallIndex;
    
    console.log(`Positioned in front of door at wall ${wallIndex}, at exact wall center: (${wallCenter.x.toFixed(2)}, ${wallCenter.z.toFixed(2)})`);
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
                    
                    // Log ring transition info for spiral navigation
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
    
    // Add a help text for spiral navigation
    const helpText = document.createElement('div');
    helpText.id = 'help-text';
    helpText.textContent = 'Follow the spiral pattern to explore all rooms';
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

// Function to draw a simple hexagonal map
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
    
    // Draw hexagons for all rooms up to maxRing
    for (let ringNum = 0; ringNum <= maxRing; ringNum++) {
        if (ringNum === 0) {
            // Center hexagon
            const centerPos = axialToPixel(0, 0);
            drawHexagon(ctx, centerPos.x, centerPos.y, hexSize, (0 === currentRoom.q && 0 === currentRoom.r));
        } else {
            // Start at the top-right corner of the ring
            let q = 0;
            let r = ringNum;
            
            // For each of the 6 sides of the ring
            for (let side = 0; side < 6; side++) {
                // For each step along the side
                for (let step = 0; step < ringNum; step++) {
                    // Draw hexagon at current coordinates
                    const pos = axialToPixel(q, r);
                    drawHexagon(ctx, pos.x, pos.y, hexSize, (q === currentRoom.q && r === currentRoom.r));
                    
                    // Move to next position along the ring
                    switch (side) {
                        case 0: q++; r--; break; // Move southeast
                        case 1: q++; break;      // Move east
                        case 2: r--; break;      // Move southwest
                        case 3: q--; break;      // Move west
                        case 4: q--; r++; break; // Move northwest
                        case 5: r++; break;      // Move northeast
                    }
                }
            }
        }
    }
    
    // Add a legend to show direction
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText('N', centerX, 15);
    ctx.fillText('S', centerX, canvas.height - 5);
    ctx.fillText('E', canvas.width - 15, centerY);
    ctx.fillText('W', 5, centerY);
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
    } else {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
    }
    ctx.fill();
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
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