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

// Function to create a hexagonal room
function createHexagonalRoom() {
    const room = new THREE.Group();
    
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
    floor.position.y = -wallThickness; // Slightly below y=0 to account for thickness
    room.add(floor);
    
    // Create ceiling (same shape as floor but positioned at room height)
    const ceiling = new THREE.Mesh(floorGeometry.clone(), ceilingMaterial);
    ceiling.rotation.x = -Math.PI / 2; // Rotate opposite of floor
    ceiling.position.y = roomHeight;
    room.add(ceiling);
    
    // Wall labels
    const wallLabels = ['WALL A', 'WALL B', 'WALL C', 'WALL D', 'WALL E', 'WALL F'];
    
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
    
    // Create an array to store walls
    const walls = [];
    
    // Helper function to create and position a wall
    function createWall(index) {
        const nextIndex = (index + 1) % 6;
        
        // Get two adjacent vertices for the wall
        const point1 = hexPoints[index];
        const point2 = hexPoints[nextIndex];
        
        // Calculate wall width (distance between vertices)
        const wallWidth = point1.distanceTo(point2);
        
        // Create wall geometry - width along X axis
        const wallGeometry = new THREE.BoxGeometry(wallWidth, roomHeight, wallThickness);
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        
        // Position the wall between the two vertices at half the room height
        const centerX = (point1.x + point2.x) / 2;
        const centerZ = (point1.y + point2.y) / 2; // Note: y of Vector2 is z in 3D
        wall.position.set(centerX, roomHeight / 2, centerZ);
        
        // Calculate the angle between the two points to align wall with hexagon edge
        const dx = point2.x - point1.x;
        const dz = point2.y - point1.y; // point.y in 2D = z in 3D
        const angleRadians = Math.atan2(dz, dx);
        
        // Apply the rotation - this aligns the wall with the edge
        wall.rotation.y = angleRadians;
        
        // Create and add label to this wall
        const label = createTextLabel(wallLabels[index]);
        
        // Position and orientation for the label
        label.position.set(0, roomHeight / 2, -wallThickness/2 - 0.05);
        label.rotation.y = Math.PI;
        wall.add(label);
        
        return wall;
    }
    
    // Helper function to create a group of two walls and rotate them 180 degrees
    function createRotatedWallGroup(index1, index2) {
        // Create a group for the walls
        const wallGroup = new THREE.Group();
        
        // Create the two walls
        const wall1 = createWall(index1);
        const wall2 = createWall(index2);
        
        // Store references to the walls
        walls[index1] = wall1;
        walls[index2] = wall2;
        
        // Add walls to the group
        wallGroup.add(wall1);
        wallGroup.add(wall2);
        
        // Calculate the center point between the walls to use as pivot
        const centerPoint = new THREE.Vector3();
        centerPoint.x = (wall1.position.x + wall2.position.x) / 2;
        centerPoint.z = (wall1.position.z + wall2.position.z) / 2;
        
        // Set the group position to the center point
        wallGroup.position.set(centerPoint.x, 0, centerPoint.z);
        
        // Move the individual walls relative to the group center
        wall1.position.set(
            wall1.position.x - centerPoint.x,
            wall1.position.y,
            wall1.position.z - centerPoint.z
        );
        
        wall2.position.set(
            wall2.position.x - centerPoint.x,
            wall2.position.y,
            wall2.position.z - centerPoint.z
        );
        
        // Rotate the group 180 degrees around Y axis
        wallGroup.rotation.y = Math.PI;
        
        return wallGroup;
    }
    
    // Create and add wall C (index 2)
    const wallC = createWall(2);
    walls[2] = wallC;
    room.add(wallC);
    
    // Create and add wall F (index 5)
    const wallF = createWall(5);
    walls[5] = wallF;
    room.add(wallF);
    
    // Create rotated group for walls A and B (indices 0 and 1)
    const wallsABGroup = createRotatedWallGroup(0, 1);
    room.add(wallsABGroup);
    
    // Create rotated group for walls E and D (indices 4 and 3)
    const wallsEDGroup = createRotatedWallGroup(4, 3);
    room.add(wallsEDGroup);
    
    return room;
}

// Create and add the hexagonal room to the scene
const hexRoom = createHexagonalRoom();
scene.add(hexRoom);

// Position camera inside the room
camera.position.set(0, 1.6, 0);

// Collision detection
const raycaster = new THREE.Raycaster();
const direction = new THREE.Vector3();
let velocity = new THREE.Vector3();
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    const speed = 5.0;
    
    velocity.x = 0;
    velocity.z = 0;
    
    if (controls.isLocked) {
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
        
        // Simple collision detection to prevent going through walls
        // This is a simplified approach - a more robust solution would check multiple rays
        const collisionDistance = 0.5;
        
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            direction.set(Math.sin(angle), 0, Math.cos(angle));
            direction.normalize();
            
            raycaster.set(camera.position, direction);
            const intersects = raycaster.intersectObjects(scene.children, true);
            
            if (intersects.length > 0 && intersects[0].distance < collisionDistance) {
                // Move player away from collision
                const pushBack = 0.1;
                camera.position.x += direction.x * -pushBack;
                camera.position.z += direction.z * -pushBack;
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
    animate();
}

// Export the init function to be called from the 3d.pug file
export { init }; 