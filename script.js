import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Water } from '../objects/water/WaterFlow.js';
import * as Fishes from '../objects/fishes/fishes.js';

//Canvas
let canvas = document.querySelector('#gl-canvas');

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Scene
const scene = new THREE.Scene();

// Constant
const clock = new THREE.Clock();
const blocker = document.querySelector("#blocker");
const instructions = document.querySelector("#instructions");

// Global variables
let camera, light, controls, FPControls, fishes, water;
var FishTankSizeX = 0, FishTankSizeY = 0, FishTankSizeZ = 0;
let cameraPostionTempZ;
let mtlLoader, objLoader;

let isDay = false;
let dayLightAdded = false;
let nightLightAdded = false;
const { directionalLight, ambientLight } = dayLight();
const { spotLight, pointLight } = nightLight();
new RGBELoader().load('textures/day.hdr', function (dayTexture) {
    dayTexture.mapping = THREE.EquirectangularReflectionMapping;
    // Load the night texture
    new RGBELoader().load('textures/night.hdr', function (nightTexture) {
        nightTexture.mapping = THREE.EquirectangularReflectionMapping;        
        // Function to switch between day and night
        function switchBackground() {
            const realTime = new Date();
            // const gameHoursPerRealSecond = 24;
            // const gameHour = (realTime.getSeconds() + realTime.getMinutes() * 60) * gameHoursPerRealSecond / 24 % 24;
            const gameHour = 8
            console.log("Time:",gameHour);
            if (gameHour >= 6 && gameHour < 18) {           
                isDay = true;
            }
            else {
                isDay = false;
            }

            if (isDay) {
                nightLightAdded = false;
                scene.background = dayTexture;
                scene.remove(spotLight);
                scene.remove(spotLight.target);
                scene.remove(pointLight);
                if (!dayLightAdded) {
                    // The light has not been added yet, so add it
                    scene.add(directionalLight);
                    scene.add(ambientLight);                    
                    dayLightAdded = true; // Remember that the light has been added
                }                
            }
            else {
                dayLightAdded = false;
                scene.background = nightTexture;
                scene.remove(directionalLight);
                scene.remove(ambientLight);
                if (!nightLightAdded) {
                    // The night light has not been added yet, so add it
                    scene.add(spotLight);
                    scene.add(spotLight.target); // Don't forget to add the target of the spot light to the scene
                    scene.add(pointLight);
                    nightLightAdded = true; // Remember that the light has been added
                }
            }
        }
        // Call the function to set the initial background
        switchBackground();
        // Call the function every minute to update the background
        setInterval(switchBackground, 1000);
    });
});

function initThree() {
    // Fixed Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 20000);
    camera.position.set(0, 300, 500);
    camera.lookAt(0, 0, 0);

    // Controls
    controls = new OrbitControls(camera, canvas);
}

function dayLight() {
    // Lights
    const directionalLight = new THREE.DirectionalLight(0xF0F0F0, 1);
    directionalLight.position.set(0, 1, 0);

    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    return {directionalLight, ambientLight};
}

function nightLight() {
    const spotLight = new THREE.SpotLight(0xffffff, 10);
    {
        spotLight.position.set(0, 150, 0);
        spotLight.castShadow = true;
        spotLight.penumbra = 0.3;
        spotLight.distance = 100;
        spotLight.shadow.mapSize = new THREE.Vector2(1024, 1024);
        spotLight.shadow.mapSize.width = 1024;
        spotLight.shadow.mapSize.height = 1024;
        spotLight.shadow.camera.near = 1;
        spotLight.shadow.camera.far = 4000;
        spotLight.shadow.camera.fov = 75;
        spotLight.target.position.set(0, 150, 0);
    }

    // Fish Tank Light
    const color = 0x06125d;
    const intensity = 20;
    const distance = 250;
    const pointLight = new THREE.PointLight(color, intensity, distance);
    {
        pointLight.castShdow = true;
        pointLight.shadow.mapSize = new THREE.Vector2(1024, 1024);
        pointLight.position.set(0, 50, 0);
    }
    return { spotLight, pointLight };
}

const onProgress = function (xhr) {
    if (xhr.lengthComputable) {
        const percentComplete = xhr.loaded / xhr.total * 100;
        console.log(Math.round(percentComplete, 2) + '% downloaded');
    }
}

function frameArea(sizeToFitOnScreen, boxSize, boxCenter, camera) {
    const halfSizeToFitOnScreen = sizeToFitOnScreen * 0.5;
    const halfFovY = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const distance = halfSizeToFitOnScreen / Math.tan(halfFovY);

    // Compute a unit vector that points
    // In the direction the camera is now in the x, z plane from the center of the box
    const direction = new THREE.Vector3()
        .subVectors(camera.position, boxCenter)
        .multiply(new THREE.Vector3(1, 0, 1))
        .normalize();

    // Move the camera to a position distance units way
    // From the center in whatever direction the camera was from the center already
    camera.position.copy(direction.multiplyScalar(distance).add(boxCenter));

    // Pick some near and far values for the frustum
    // That will contain the box
    camera.near = boxSize / 100;
    camera.far = boxSize * 100;

    camera.updateProjectionMatrix();

    // Point the camera to look at the center of the box
    camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z);

    // Variable to return to the initial camera position
    // When the viewpoint is changed
    cameraPostionTempZ = camera.position.z;
}

function createFishTank() {
    mtlLoader = new MTLLoader();
    mtlLoader.load('models/fishTank/fishTank.mtl', function (materials) {
        materials.preload();
        materials.side = THREE.DoubleSide
        new OBJLoader().setMaterials(materials).load('models/fishTank/fishTank.obj', function (object) {
            object.rotation.x = Math.PI * -0.5;
            object.scale.set(7.5, 15, 7.5);
            object.receiveShadow = true;
            object.castShadow = true;
            scene.add(object);

            // Compute the box that contains all the stuff
            // From root and below
            const boundingBox = new THREE.Box3().setFromObject(object);
            const boxSize = boundingBox.getSize(new THREE.Vector3()).length();
            const boxCenter = boundingBox.getCenter(new THREE.Vector3());

            FishTankSizeX = boundingBox.max.x - boundingBox.min.x
            FishTankSizeY = boundingBox.max.y - boundingBox.min.y
            FishTankSizeZ = boundingBox.max.z - boundingBox.min.z

            // Set the camera to frame the box
            frameArea(boxSize * 1, boxSize, boxCenter, camera);

            // Update the Trackball controls to handle the new size
            controls.target.copy(boxCenter);
            controls.minDistance = 5;
            controls.maxDistance = 1000;
        }, onProgress);
    });
}

/* Create the table that located under the Fish Tank */
function createTable() {
    mtlLoader = new MTLLoader();
    mtlLoader.load('models/table/table.mtl', function (materials) {
        materials.preload();
        materials.side = THREE.DoubleSide
        new OBJLoader().setMaterials(materials).load('models/table/table.obj', function (root) {
            root.scale.set(130, 135, 130);
            root.rotation.y = Math.PI * 0.25;
            root.position.set(0, -194, 0);
            root.receiveShadow = true;
            scene.add(root);
        });
    });
}

function createWater() {
    // Water surface
    const waterGeometry = new THREE.PlaneGeometry(218, 176);
    const textureLoader = new THREE.TextureLoader();
    const flowMap = textureLoader.load('models/water/Water_1_M_Flow.jpg');

    water = new Water(waterGeometry, {
        scale: 2,
        textureWidth: 1024,
        textureHeight: 1024,
        flowMap: flowMap
    });

    water.castShadow = true;
    water.receiveShadow = true;
    water.position.y = 90;
    water.rotation.x = -Math.PI / 2;
    scene.add(water);

    // Undersea
    let materialArray = [];
    materialArray.push(new THREE.MeshPhongMaterial({ color: 0x77E6FE, transparent: true, opacity: 0.1 }));
    materialArray.push(new THREE.MeshPhongMaterial({ color: 0x77E6FE, transparent: true, opacity: 0.1 }));
    materialArray.push(new THREE.MeshPhongMaterial({ color: 0x77E6FE, transparent: true, opacity: 0.1 }));
    materialArray.push(new THREE.MeshPhongMaterial({ color: 0x77E6FE, transparent: true, opacity: 0.1 }));
    materialArray.push(new THREE.MeshPhongMaterial({ color: 0x77E6FE, transparent: true, opacity: 0.1 }));
    materialArray.push(new THREE.MeshPhongMaterial({ color: 0x77E6FE, transparent: true, opacity: 0.1 }));
    for (let i = 0; i < 6; i++) materialArray[i].side = THREE.DoubleSide;

    const waterBlocksGeometry = new THREE.BoxGeometry(230, 140, 175);
    const waterBlocks = new THREE.Mesh(waterBlocksGeometry, materialArray);
    waterBlocks.position.y = 55;
    scene.add(waterBlocks);
}

function createFish() {
    fishes = new Fishes.Fishes();
    fishes.createFishes(scene);
}

function initObj() {
    createFishTank();
    createTable();
    createWater();
    createFish();
}

function render() {
    fishes.move();
    renderer.render(scene, camera);

    requestAnimationFrame(render);
}

window.onload = function init() {
    initThree();
    initObj();
    render();
};