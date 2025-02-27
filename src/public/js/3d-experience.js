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
    floor.position.y = 0; // Position exactly at y=0 to be flush with walls
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
    
    // Create floor and ceiling vertices arrays that we'll use for walls
    const floorVertices = [];
    const ceilingVertices = [];
    
    // Generate 3D vertices for floor and ceiling perimeter
    for (let i = 0; i < 6; i++) {
        const point = hexPoints[i];
        floorVertices.push(new THREE.Vector3(point.x, 0, point.y)); // Floor vertices at y=0
        ceilingVertices.push(new THREE.Vector3(point.x, roomHeight, point.y));
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
    
    // Helper function to create a wall from 4 points (ensuring proper winding order)
    function createWall(points, index) {
        // Create geometry from points
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
        
        // Create and add label to the wall
        const label = createTextLabel(wallLabels[index]);
        
        // Calculate wall normal vector (pointing inward)
        const wallNormal = normal.clone();
        // Make sure it points inward
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
        
        wall.add(label);
        return wall;
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