import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 0, 50);

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 1.6; // Average eye height

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

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

// Create a single hexagonal room structure
const roomRadius = 5;
const roomHeight = 3;
const wallThickness = 0.2;

// Materials
const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513,
    roughness: 0.7,
    metalness: 0.2
});

const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x5D4037,
    roughness: 0.9,
    metalness: 0.1
});

const ceilingMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x795548,
    roughness: 0.8,
    metalness: 0.1
});

// Create hexagonal room
function createHexRoom(x, z) {
    const group = new THREE.Group();
    
    // Create a proper hexagonal shape for floor and ceiling
    const hexPoints = [];
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI / 3);
        hexPoints.push(new THREE.Vector2(
            roomRadius * Math.cos(angle),
            roomRadius * Math.sin(angle)
        ));
    }
    
    const hexShape = new THREE.Shape(hexPoints);
    
    // Floor
    const floorGeometry = new THREE.ShapeGeometry(hexShape);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x, 0, z);
    group.add(floor);
    
    // Ceiling
    const ceilingGeometry = new THREE.ShapeGeometry(hexShape);
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(x, roomHeight, z);
    group.add(ceiling);
    
    // Create walls using planes for better precision
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI / 3);
        const nextAngle = ((i + 1) * Math.PI / 3);
        
        const x1 = x + roomRadius * Math.cos(angle);
        const z1 = z + roomRadius * Math.sin(angle);
        const x2 = x + roomRadius * Math.cos(nextAngle);
        const z2 = z + roomRadius * Math.sin(nextAngle);
        
        createWall(group, x1, z1, x2, z2);
    }
    
    return group;
}

function createWall(group, x1, z1, x2, z2) {
    // Calculate the wall length (distance between vertices)
    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(z2 - z1, 2));
    
    // Create a wall geometry
    const wallGeometry = new THREE.BoxGeometry(length, roomHeight, wallThickness);
    
    // Move the pivot point to the left end of the box
    wallGeometry.translate(length / 2, 0, 0);
    
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    
    // Position the wall at the first vertex
    wall.position.set(x1, roomHeight / 2, z1);
    
    // Calculate the angle between the vertices
    const wallAngle = Math.atan2(z2 - z1, x2 - x1);
    
    // Rotate the wall to point toward the second vertex
    wall.rotation.y = wallAngle;
    
    group.add(wall);
}

// Create a single hexagonal room at the center
const singleRoom = createHexRoom(0, 0);
scene.add(singleRoom);

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
            velocity.z = -speed * delta;
        }
        if (moveBackward) {
            velocity.z = speed * delta;
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
        const playerHeight = 1.6;
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