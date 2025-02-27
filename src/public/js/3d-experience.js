import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// Constants for the library structure
const WALLS = 4;    // Walls with shelves (2 walls don't have shelves)
const SHELVES = 5;  // Shelves per wall
const BOOKS = 32;   // Books per shelf
const PAGES = 410;  // Pages per book
