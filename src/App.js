import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './App.css';

function App() {
  const [username, setUsername] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [activePlayers, setActivePlayers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const obstaclesPool = useRef([]);
  const orbsPool = useRef([]);
  const treesPool = useRef([]);
  const cloudsPool = useRef([]);
  const rollerCoasterCarRef = useRef(null);
  const socketRef = useRef(null);
  const messageQueue = useRef([]);
  const jumpTimerRef = useRef(null);
  const legAnimationRef = useRef({ angle: 0, direction: 1 });
  const cloudAnimationRef = useRef({ offset: 0 });
  const rollerCoasterAnimationRef = useRef({ t: 0 });

  useEffect(() => {
    if (!gameStarted) return;

    console.log('Game starting...');

    // ThreeJS Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87CEEB);
    camera.position.set(0, 5, 10);

    // Skybox
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: 0x87CEEB,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);

    // Fog for Depth
    scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

    // Ground (Grass) - Increased size and extended further back
    const groundGeometry = new THREE.PlaneGeometry(10000, 10000);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x228B22 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -1, 0);
    scene.add(ground);

    // Track - Extended to fill space behind panda
    const trackGeometry = new THREE.BoxGeometry(5, 0.5, 10000);
    const trackMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 });
    const track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.position.set(0, 0, 0);
    scene.add(track);

    // Player (3D Panda Model)
    const panda = new THREE.Group();

    // Body (white)
    const bodyGeometry = new THREE.SphereGeometry(0.6, 32, 32);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0.6, 0);
    panda.add(body);

    // Head (white)
    const headGeometry = new THREE.SphereGeometry(0.4, 32, 32);
    const headMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.2, -0.3);
    panda.add(head);

    // Ears (black)
    const earGeometry = new THREE.SphereGeometry(0.15, 32, 32);
    const earMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEar = new THREE.Mesh(earGeometry, earMaterial);
    leftEar.position.set(-0.3, 1.5, -0.3);
    const rightEar = new THREE.Mesh(earGeometry, earMaterial);
    rightEar.position.set(0.3, 1.5, -0.3);
    panda.add(leftEar, rightEar);

    // Eye Patches (black)
    const eyeGeometry = new THREE.SphereGeometry(0.1, 32, 32);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEyePatch = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEyePatch.position.set(-0.15, 1.2, -0.1);
    const rightEyePatch = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEyePatch.position.set(0.15, 1.2, -0.1);
    panda.add(leftEyePatch, rightEyePatch);

    // Legs (black and white) - For animation
    const legGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 32);
    const legMaterialWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const legMaterialBlack = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const frontLeftLeg = new THREE.Mesh(legGeometry, legMaterialBlack);
    frontLeftLeg.position.set(-0.3, 0.25, -0.3);
    const frontRightLeg = new THREE.Mesh(legGeometry, legMaterialBlack);
    frontRightLeg.position.set(0.3, 0.25, -0.3);
    const backLeftLeg = new THREE.Mesh(legGeometry, legMaterialWhite);
    backLeftLeg.position.set(-0.3, 0.25, 0.3);
    const backRightLeg = new THREE.Mesh(legGeometry, legMaterialWhite);
    backRightLeg.position.set(0.3, 0.25, 0.3);

    panda.add(frontLeftLeg, frontRightLeg, backLeftLeg, backRightLeg);

    // Tail (white)
    const tailGeometry = new THREE.SphereGeometry(0.1, 32, 32);
    const tailMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, 0.6, 0.6);
    panda.add(tail);

    panda.position.set(0, 0.75, 0);
    panda.rotation.y = Math.PI;
    scene.add(panda);
    playerRef.current = panda;

    // Drone
    const droneGeometry = new THREE.BoxGeometry(1, 1, 1);
    const droneMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const drone = new THREE.Mesh(droneGeometry, droneMaterial);
    drone.position.set(0, 0.5, -50);
    scene.add(drone);

    // Moving Clouds
    const initClouds = () => {
      for (let i = 0; i < 10; i++) {
        const cloudGeometry = new THREE.PlaneGeometry(20, 10);
        const cloudMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.8,
        });
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        cloud.position.set(
          (Math.random() - 0.5) * 400,
          100 + Math.random() * 50,
          (Math.random() - 0.5) * 400
        );
        scene.add(cloud);
        cloudsPool.current.push(cloud);
      }
    };
    initClouds();

    // Roller Coaster Below Panda
    const rollerCoasterPoints = [];
    for (let t = 0; t < 1; t += 0.01) {
      const x = Math.sin(t * Math.PI * 4) * 10;
      const y = -2 + Math.sin(t * Math.PI * 2) * 1;
      const z = (t - 0.5) * 100;
      rollerCoasterPoints.push(new THREE.Vector3(x, y, z));
    }
    const rollerCoasterCurve = new THREE.CatmullRomCurve3(rollerCoasterPoints, true);
    const rollerCoasterGeometry = new THREE.TubeGeometry(rollerCoasterCurve, 1000, 0.2, 8, true);
    const rollerCoasterMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
    const rollerCoasterTrack = new THREE.Mesh(rollerCoasterGeometry, rollerCoasterMaterial);
    scene.add(rollerCoasterTrack);

    // Roller Coaster Car
    const carGeometry = new THREE.BoxGeometry(0.5, 0.5, 1);
    const carMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const car = new THREE.Mesh(carGeometry, carMaterial);
    scene.add(car);
    rollerCoasterCarRef.current = { mesh: car, curve: rollerCoasterCurve };

    // Dense 3D Trees
    const initTrees = () => {
      for (let i = 0; i < 100; i++) {
        const xOffset = (i % 10 - 5) * 10;
        const zOffset = Math.floor(i / 10) * -100;
        if (Math.abs(xOffset) <= 5) continue;

        const trunkGeometry = new THREE.CylinderGeometry(0.4, 0.4, 3 + Math.random() * 2, 8);
        const trunkMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(xOffset + (Math.random() - 0.5) * 5, 1.5, -50 + zOffset);
        scene.add(trunk);

        const foliageGeometry = new THREE.ConeGeometry(2 + Math.random(), 4 + Math.random() * 2, 8);
        const foliageMaterial = new THREE.MeshBasicMaterial({ color: 0x228B22 });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.set(trunk.position.x, 3 + Math.random(), trunk.position.z);
        scene.add(foliage);

        treesPool.current.push({ trunk, foliage });
      }
    };
    initTrees();

    // Obstacles (Spiky Rocks) and Orbs Pool
    const initPool = () => {
      for (let i = 0; i < 5; i++) {
        const rockGeometry = new THREE.ConeGeometry(1, 3, 6);
        const rockMaterial = new THREE.MeshBasicMaterial({ color: 0x4A4A4A });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.visible = false;
        scene.add(rock);
        obstaclesPool.current.push(rock);

        const orbGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const orbMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const orb = new THREE.Mesh(orbGeometry, orbMaterial);
        orb.visible = false;
        scene.add(orb);
        orbsPool.current.push(orb);
      }
    };
    initPool();

    // WebSocket Setup
    socketRef.current = new WebSocket('ws://localhost:8080');
    socketRef.current.onopen = () => {
      console.log('WebSocket connected');
      messageQueue.current.forEach(msg => socketRef.current.send(JSON.stringify(msg)));
      messageQueue.current = [];
      socketRef.current.send(JSON.stringify({ type: 'join', username }));
    };
    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'scores') {
        setActivePlayers(data.active);
        setLeaderboard(data.leaderboard);
      }
    };
    socketRef.current.onerror = () => setError('Server connection failed.');
    socketRef.current.onclose = () => setError('Disconnected from server.');

    // Game Logic
    let speed = 0.05;
    let gameOver = false;
    let lastScoreUpdate = 0;
    let timeElapsed = 0;

    const spawnObject = (pool, isObstacle) => {
      const obj = pool.find(o => !o.visible);
      if (obj) {
        obj.visible = true;
        obj.position.set(
          (Math.random() - 0.5) * 3,
          isObstacle ? (Math.random() > 0.5 ? 1 : 0) : 0.5,
          -50
        );
        if (isObstacle && obj.position.y === 0) {
          obj.scale.set(2.5, 0.05, 1);
        } else {
          obj.scale.set(1, 1, 1);
        }
      }
    };

    const moveObjects = () => {
      obstaclesPool.current.forEach(obj => {
        if (obj.visible) {
          obj.position.z += speed;
          if (obj.position.z > 10) obj.visible = false;
        }
      });
      orbsPool.current.forEach(orb => {
        if (orb.visible) {
          orb.position.z += speed;
          if (orb.position.z > 10) orb.visible = false; // Fixed: 'obj' -> 'orb'
        }
      });
      drone.position.z += speed * 0.5;
      treesPool.current.forEach(tree => {
        tree.trunk.position.z += speed;
        tree.foliage.position.z += speed;
        if (tree.trunk.position.z > 10) {
          tree.trunk.position.z -= 1000;
          tree.foliage.position.z -= 1000;
        }
      });

      // Move Clouds
      cloudAnimationRef.current.offset += 0.02;
      cloudsPool.current.forEach(cloud => {
        cloud.position.x += 0.1;
        if (cloud.position.x > 200) cloud.position.x -= 400;
      });

      // Move Roller Coaster Car
      if (rollerCoasterCarRef.current) {
        rollerCoasterAnimationRef.current.t = (rollerCoasterAnimationRef.current.t + 0.001) % 1;
        const point = rollerCoasterCarRef.current.curve.getPointAt(rollerCoasterAnimationRef.current.t);
        rollerCoasterCarRef.current.mesh.position.copy(point);
        const tangent = rollerCoasterCarRef.current.curve.getTangentAt(rollerCoasterAnimationRef.current.t);
        rollerCoasterCarRef.current.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
      }
    };

    const checkCollisions = () => {
      if (timeElapsed < 1) return;
      obstaclesPool.current.forEach(obj => {
        if (obj.visible && playerRef.current) {
          const distance = playerRef.current.position.distanceTo(obj.position);
          if (distance < (obj.position.y > 0.5 ? 1 : 0.6)) {
            console.log('Obstacle collision at', playerRef.current.position.z, obj.position.z);
            gameOver = true;
            sendMessage({ type: 'gameOver', score });
          }
        }
      });
      orbsPool.current.forEach(orb => {
        if (orb.visible && playerRef.current) {
          const distance = playerRef.current.position.distanceTo(orb.position);
          if (distance < 0.7) {
            setScore(s => s + 5);
            orb.visible = false;
          }
        }
      });
    };

    const sendMessage = (msg) => {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(msg));
      } else {
        messageQueue.current.push(msg);
      }
    };

    // Controls
    const onKeyDown = (event) => {
      if (gameOver || !playerRef.current) return;
      const pos = playerRef.current.position;
      if (event.key === 'ArrowLeft' && pos.x > -1.5) pos.x -= 1.5;
      if (event.key === 'ArrowRight' && pos.x < 1.5) pos.x += 1.5;
      if (event.key === 'ArrowUp' && pos.y < 1) {
        pos.y = 2;
        if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
        jumpTimerRef.current = setTimeout(() => {
          if (playerRef.current) playerRef.current.position.y = 0.75;
        }, 1000);
      }
    };
    const onKeyUp = (event) => {
      // Handled by timer
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Animation Loop
    const animate = () => {
      if (gameOver) {
        setError('Game Over! Refresh to restart.');
        return;
      }
      requestAnimationFrame(animate);

      // Running Animation for Panda Legs
      if (playerRef.current) {
        const { angle, direction } = legAnimationRef.current;
        const newAngle = angle + 0.1 * direction;
        if (newAngle > Math.PI / 4 || newAngle < -Math.PI / 4) {
          legAnimationRef.current.direction *= -1;
        }
        legAnimationRef.current.angle = newAngle;

        playerRef.current.children[2].rotation.x = newAngle;
        playerRef.current.children[3].rotation.x = -newAngle;
        playerRef.current.children[4].rotation.x = -newAngle;
        playerRef.current.children[5].rotation.x = newAngle;
      }

      moveObjects();
      checkCollisions();
      timeElapsed += 0.016;
      if (timeElapsed > 10) speed = Math.min(speed + 0.0005, 0.3);
      const now = Date.now();
      if (now - lastScoreUpdate > 1000) {
        sendMessage({ type: 'update', score });
        lastScoreUpdate = now;
      }
      if (timeElapsed > 5 && Math.random() < 0.005) spawnObject(obstaclesPool.current, true);
      if (timeElapsed > 5 && Math.random() < 0.03) spawnObject(orbsPool.current, false);
      camera.position.set(0, 4, playerRef.current ? playerRef.current.position.z + 10 : 10);
      camera.lookAt(playerRef.current ? playerRef.current.position.x : 0, 0.75, playerRef.current ? playerRef.current.position.z - 10 : -10);
      track.position.z = playerRef.current ? playerRef.current.position.z : 0;
      ground.position.z = playerRef.current ? playerRef.current.position.z : 0;
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (socketRef.current) socketRef.current.close();
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    };
  }, [gameStarted, username]);

  const startGame = () => {
    setUsername(username || 'Runner' + Math.floor(Math.random() * 1000));
    setGameStarted(true);
  };

  return (
    <div className="App">
      {!gameStarted ? (
        <div className="username-prompt">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
          />
          <button onClick={startGame}>Start Running</button>
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} />
          <div className="hud">
            <div>Your Score: {score}</div>
            {activePlayers.length > 0 && (
              <div>
                Active Players:
                {activePlayers.map((player, i) => (
                  <div key={i}>{player.username}: {player.score}</div>
                ))}
              </div>
            )}
            <div>
              Leaderboard:
              {leaderboard.map((entry, i) => (
                <div key={i}>{entry.username}: {entry.score}</div>
              ))}
            </div>
          </div>
          {error && <div className="error">{error}</div>}
        </>
      )}
    </div>
  );
}

export default App;