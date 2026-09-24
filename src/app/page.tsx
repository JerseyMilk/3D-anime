'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Type extension (adding isBone property to THREE.Object3D)
declare module 'three' {
  interface Object3D {
    isBone?: boolean;
  }
}

// Type definitions
interface ModelData {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

interface Actions {
  [key: string]: THREE.AnimationAction;
}

// ThreeScene component handle type definition
export interface ThreeSceneHandle {
  playDanceAnimation: (index: number) => void;
}

// Model and motion path constants
const MODEL_PATHS = {
  CHARACTER: '/3d/kawaii22.glb',  // Main character model
  DANCE_MOTION: '/3d/motion.glb',  // Dance motion
  DANCE_MUSIC: '/3d/idle.mp3',     // Dance BGM
  ORIGINAL_VIDEO: '/3d/original_movie.mp4' // オリジナルビデオ
} as const;

// ThreeScene component property type definition
interface ThreeSceneProps {
  onModelLoaded: (loaded: boolean, error?: string) => void;
}

// Bone name mapping table
const boneMapping: { [key: string]: string } = {
  // motion bone name: kawaii bone name
  'hips_JNT': 'J_Bip_C_Hips',
  'spine_JNT': 'J_Bip_C_Spine',
  'spine1_JNT': 'J_Bip_C_Chest',
  'spine2_JNT': 'J_Bip_C_UpperChest',
  'neck_JNT': 'J_Bip_C_Neck',
  'head_JNT': 'J_Bip_C_Head',

  // Left arm
  'l_shoulder_JNT': 'J_Bip_L_Shoulder',
  'l_arm_JNT': 'J_Bip_L_UpperArm',
  'l_forearm_JNT': 'J_Bip_L_LowerArm',
  'l_hand_JNT': 'J_Bip_L_Hand',

  // Right arm
  'r_shoulder_JNT': 'J_Bip_R_Shoulder',
  'r_arm_JNT': 'J_Bip_R_UpperArm',
  'r_forearm_JNT': 'J_Bip_R_LowerArm',
  'r_hand_JNT': 'J_Bip_R_Hand',

  // Left leg
  'l_upleg_JNT': 'J_Bip_L_UpperLeg',
  'l_leg_JNT': 'J_Bip_L_LowerLeg',
  'l_foot_JNT': 'J_Bip_L_Foot',
  'l_toebase_JNT': 'J_Bip_L_ToeBase',

  // Right leg
  'r_upleg_JNT': 'J_Bip_R_UpperLeg',
  'r_leg_JNT': 'J_Bip_R_LowerLeg',
  'r_foot_JNT': 'J_Bip_R_Foot',
  'r_toebase_JNT': 'J_Bip_R_ToeBase',

  // Finger (Left hand)
  'l_handThumb1_JNT': 'J_Bip_L_Thumb1',
  'l_handThumb2_JNT': 'J_Bip_L_Thumb2',
  'l_handThumb3_JNT': 'J_Bip_L_Thumb3',
  'l_handIndex1_JNT': 'J_Bip_L_Index1',
  'l_handIndex2_JNT': 'J_Bip_L_Index2',
  'l_handIndex3_JNT': 'J_Bip_L_Index3',
  'l_handMiddle1_JNT': 'J_Bip_L_Middle1',
  'l_handMiddle2_JNT': 'J_Bip_L_Middle2',
  'l_handMiddle3_JNT': 'J_Bip_L_Middle3',
  'l_handRing1_JNT': 'J_Bip_L_Ring1',
  'l_handRing2_JNT': 'J_Bip_L_Ring2',
  'l_handRing3_JNT': 'J_Bip_L_Ring3',
  'l_handPinky1_JNT': 'J_Bip_L_Little1',
  'l_handPinky2_JNT': 'J_Bip_L_Little2',
  'l_handPinky3_JNT': 'J_Bip_L_Little3',

  // Finger (Right hand)
  'r_handThumb1_JNT': 'J_Bip_R_Thumb1',
  'r_handThumb2_JNT': 'J_Bip_R_Thumb2',
  'r_handThumb3_JNT': 'J_Bip_R_Thumb3',
  'r_handIndex1_JNT': 'J_Bip_R_Index1',
  'r_handIndex2_JNT': 'J_Bip_R_Index2',
  'r_handIndex3_JNT': 'J_Bip_R_Index3',
  'r_handMiddle1_JNT': 'J_Bip_R_Middle1',
  'r_handMiddle2_JNT': 'J_Bip_R_Middle2',
  'r_handMiddle3_JNT': 'J_Bip_R_Middle3',
  'r_handRing1_JNT': 'J_Bip_R_Ring1',
  'r_handRing2_JNT': 'J_Bip_R_Ring2',
  'r_handRing3_JNT': 'J_Bip_R_Ring3',
  'r_handPinky1_JNT': 'J_Bip_R_Little1',
  'r_handPinky2_JNT': 'J_Bip_R_Little2',
  'r_handPinky3_JNT': 'J_Bip_R_Little3'
};

// Model load duplicate prevention flag - maintained at module level
let isLoading = false;

// ThreeScene component
const ThreeScene = forwardRef<ThreeSceneHandle, ThreeSceneProps>((props, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Animation-related state
  const animationRef = useRef<number>(0);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const modelRef = useRef<THREE.Group | null>(null);
  const actionsRef = useRef<Actions>({});
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const danceModelRef = useRef<ModelData | null>(null);
  const danceAnimationsRef = useRef<THREE.AnimationClip[]>([]);
  const isComponentMounted = useRef(false);

  // GLB model paths
  const modelPath = MODEL_PATHS.CHARACTER;
  const dancePath = MODEL_PATHS.DANCE_MOTION;

  // Animation retargeting (for when bone structures are different)
  const retargetAnimation = (clip: THREE.AnimationClip): THREE.AnimationClip => {
    const newClip = THREE.AnimationClip.parse(THREE.AnimationClip.toJSON(clip));
    const newTracks: THREE.KeyframeTrack[] = [];

    newClip.tracks.forEach(track => {
      const [boneName, property] = track.name.split('.');
      if (boneMapping[boneName]) {
        const newTrack = new THREE.KeyframeTrack(
          `${boneMapping[boneName]}.${property}`,
          track.times,
          track.values.slice()
        );
        newTracks.push(newTrack);
      }
    });

    return new THREE.AnimationClip(clip.name, clip.duration, newTracks);
  };

  // Function to process external animations
  const processExternalAnimations = () => {
    if (!danceAnimationsRef.current.length || !modelRef.current || !mixerRef.current) {
      console.warn('Missing data required for animation processing');
      return;
    }

    try {
      danceAnimationsRef.current.forEach((clip, index) => {
        const retargetedClip = retargetAnimation(clip);
        const action = mixerRef.current!.clipAction(retargetedClip);
        actionsRef.current[`dance_${index}`] = action;
      });
    } catch (error) {
      console.error('Failed to process external animations:', error);
    }
  };

  // Function to load models
  const loadModels = async () => {
    if (isLoading) return;
    isLoading = true;

    try {
      const loader = new GLTFLoader();

      // Load main model
      const characterGltf = await loader.loadAsync(modelPath);
      modelRef.current = characterGltf.scene;

      // Adjust model scale and position
      modelRef.current.scale.set(1.5, 1.5, 1.5);
      modelRef.current.position.set(0, 0, 0);

      // Add model to scene
      if (sceneRef.current) {
        sceneRef.current.add(modelRef.current);
      }

      // Set up animation mixer
      mixerRef.current = new THREE.AnimationMixer(modelRef.current);

      // Set up original model animations
      if (characterGltf.animations && characterGltf.animations.length > 0) {
        characterGltf.animations.forEach((clip, index) => {
          const action = mixerRef.current!.clipAction(clip);
          actionsRef.current[`original_${index}`] = action;
        });
      }

      // Load dance model
      const danceGltf = await loader.loadAsync(dancePath);
      danceModelRef.current = danceGltf;
      danceAnimationsRef.current = danceGltf.animations;

      // Process dance animations
      if (danceAnimationsRef.current.length > 0) {
        processExternalAnimations();
      }

      props.onModelLoaded(true);
    } catch (error) {
      console.error('Failed to load model:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      props.onModelLoaded(false, errorMessage);
    } finally {
      isLoading = false;
    }
  };

  // Animation loop
  const animate = () => {
    if (!mountRef.current) return;

    const delta = clockRef.current.getDelta();

    // Update mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    // Update controls
    if (controlsRef.current) {
      controlsRef.current.update();
    }

    // Rendering
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    animationRef.current = requestAnimationFrame(animate);
  };

  // Scene initialization
  useEffect(() => {
    if (!mountRef.current || isComponentMounted.current) return;
    isComponentMounted.current = true;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000022);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 3);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.82, 0.1);
    controls.update();
    controlsRef.current = controls;

    // Light setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 10);
    scene.add(gridHelper);

    // Floor creation (with reflection effect)
    const floorGeometry = new THREE.CircleGeometry(10, 64);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x6666aa,
      metalness: 0.9,
      roughness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Fog addition
    scene.fog = new THREE.Fog(0x000022, 1, 15);

    // Load models
    loadModels();

    // Animation start
    animate();

    // Resize handler
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;

      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }

      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }

      if (sceneRef.current) {
        // Scene cleanup
        sceneRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (object.material instanceof THREE.Material) {
              object.material.dispose();
            } else if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            }
          }
        });
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      // Audio stop and cleanup
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      isComponentMounted.current = false;
    };
  }, []);

  // Method exposure
  useImperativeHandle(ref, () => ({
    // Play dance animation
    playDanceAnimation: (index: number) => {
      console.log(`playDanceAnimation(${index}) called`);

      // Stop existing animation
      if (currentActionRef.current) {
        currentActionRef.current.fadeOut(0.5);
        currentActionRef.current.stop();
      }

      // Music playback - 削除：ビデオの音声と重複するため無効化
      // if (!audioRef.current) {
      //   audioRef.current = new Audio(MODEL_PATHS.DANCE_MUSIC);
      //   audioRef.current.loop = true;
      // }
      // audioRef.current.play().catch(error => {
      //   console.warn('Failed to play music:', error);
      // });

      // Play specified dance animation
      const animationName = `dance_${index}`;
      if (mixerRef.current && actionsRef.current[animationName]) {
        currentActionRef.current = actionsRef.current[animationName];
        currentActionRef.current.reset();
        currentActionRef.current.fadeIn(0.5);
        currentActionRef.current.play();
        currentActionRef.current.setLoop(THREE.LoopRepeat, Infinity);
        console.log(`Playing dance animation ${index}`);
      } else {
        console.warn(`Dance animation ${animationName} not found`);
      }
    }
  }));

  return (
    <div
      ref={mountRef}
      className="w-full h-full"
      style={{ overflow: 'hidden' }}
    />
  );
});

ThreeScene.displayName = 'ThreeScene';

// VideoOverlay component
interface VideoOverlayProps {
  isVisible: boolean;
  videoSrc: string;
  onClose: () => void;
}

const VideoOverlay: React.FC<VideoOverlayProps> = ({ isVisible, videoSrc, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative max-w-5xl w-full">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white text-2xl hover:text-red-500"
        >
          ✕
        </button>
        <video
          controls
          autoPlay
          className="w-full rounded-lg shadow-2xl"
        >
          <source src={videoSrc} type="video/mp4" />
          お使いのブラウザはビデオタグをサポートしていません。
        </video>
      </div>
    </div>
  );
};

// PictureInPictureVideo component
interface PiPVideoProps {
  isVisible: boolean;
  videoSrc: string;
  onClose: () => void;
}

const PictureInPictureVideo: React.FC<PiPVideoProps> = ({ isVisible, videoSrc, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // ビデオが表示/非表示になったときの処理
  useEffect(() => {
    if (isVisible && videoRef.current) {
      // ビデオが表示されたら再生を確実に開始
      const playVideo = async () => {
        try {
          // 先にビデオをロードしておく
          videoRef.current!.load();
          // 少し待ってから再生開始 (ダンスアニメーションとの同期を改善)
          await new Promise(resolve => setTimeout(resolve, 100));
          await videoRef.current!.play();
        } catch (error) {
          console.warn('Failed to play video:', error);
        }
      };

      playVideo();
    } else if (!isVisible && videoRef.current) {
      // 非表示になったら一時停止
      videoRef.current.pause();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-20 w-48 md:w-64 lg:w-80 shadow-xl rounded-lg overflow-hidden">
      <div className="relative bg-black">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-white text-xl bg-black/50 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-500/80 z-10"
        >
          ✕
        </button>
        <video
          ref={videoRef}
          controls
          autoPlay
          loop
          muted
          className="w-full"
          preload="auto"
          playsInline
        >
          <source src={videoSrc} type="video/mp4" />
          お使いのブラウザはビデオタグをサポートしていません。
        </video>
      </div>
    </div>
  );
};

// Credits modal component
interface CreditsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const CreditsModal: React.FC<CreditsModalProps> = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-2xl rounded-lg bg-gray-900 p-6 sm:p-8">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-2xl text-white hover:text-red-500"
        >
          ✕
        </button>
        <h2 className="mb-4 text-2xl font-bold text-white">クレジット</h2>
        <div className="space-y-4 text-gray-300">
          <div>
            <h3 className="mb-2 text-xl font-semibold">ダンスモーション</h3>
            <p>三桜じゅり【じゅりんぐる】</p>
            <a
              href="https://www.youtube.com/shorts/gYZzVHGrRcA"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              参考動画
            </a>
          </div>
          <div>
            <h3 className="mb-2 text-xl font-semibold">音楽</h3>
            <p>YOASOBI「アイドル」Official Music</p>
            <a
              href="https://www.youtube.com/watch?v=ZRtdQ81jPUQ"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              YouTubeで見る
            </a>
          </div>
          <div>
            <h3 className="mb-2 text-xl font-semibold">アニメキャラクター</h3>
            <p>VRoid Studioで作成</p>
            <a
              href="https://vroid.com/en/studio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              VRoid Studio
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// Controls component
interface ControlsProps {
  onIntergalactiaDance: () => void;
  isModelLoaded: boolean;
  githubUrl?: string;
}

const Controls: React.FC<ControlsProps> = ({
  onIntergalactiaDance,
  isModelLoaded,
  githubUrl = "https://github.com"
}) => {
  const [showCredits, setShowCredits] = useState(false);

  const buttonClass = `
    px-3.5 py-2.5 sm:px-5
    rounded-lg
    text-sm sm:text-base
    font-medium
    text-white
    shadow-lg
    transition-all
    duration-200
    disabled:opacity-50
    disabled:cursor-not-allowed
    transform hover:-translate-y-1 hover:shadow-xl
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-opacity-50
  `;

  const handleReset = () => {
    window.location.reload();
  };

  const handleGithub = () => {
    window.open(githubUrl, '_blank');
  };

  return (
    <>
      <div className="absolute bottom-3 left-3 right-3 z-10 rounded-xl border border-white/10 bg-black/70 p-3 text-white shadow-lg backdrop-blur-md sm:bottom-5 sm:left-5 sm:right-auto sm:p-4">
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
          <button
            onClick={onIntergalactiaDance}
            disabled={!isModelLoaded}
            className={`${buttonClass} bg-green-600 hover:bg-green-700 focus:ring-green-500`}
          >
            ダンス再生
          </button>

          <button
            onClick={handleReset}
            className={`${buttonClass} bg-gray-600 hover:bg-gray-700 focus:ring-gray-500`}
          >
            リセット
          </button>

          <button
            onClick={handleGithub}
            className={`${buttonClass} bg-purple-600 hover:bg-purple-700 focus:ring-purple-500 flex items-center justify-center gap-2`}
          >
            <svg
              className="h-4 w-4 sm:h-5 sm:w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.12.83-.26.83-.57v-2c-3.34.73-4.03-1.6-4.03-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.08-.74.08-.73.08-.73 1.2.08 1.83 1.23 1.83 1.23 1.07 1.84 2.8 1.3 3.5 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.3.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 016 0c2.28-1.55 3.3-1.23 3.3-1.23.64 1.66.24 2.88.12 3.18.76.84 1.23 1.9 1.23 3.22 0 4.6-2.8 5.63-5.48 5.92.42.36.8 1.1.8 2.2v3.3c0 .3.2.7.82.57C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </button>

          <button
            onClick={() => setShowCredits(true)}
            className={`${buttonClass} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 flex items-center justify-center gap-2`}
          >
            <svg
              className="h-4 w-4 sm:h-5 sm:w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            クレジット
          </button>
        </div>
      </div>

      <CreditsModal
        isVisible={showCredits}
        onClose={() => setShowCredits(false)}
      />
    </>
  );
};

// ErrorNotice component
interface ErrorNoticeProps {
  isVisible: boolean;
  message?: string;
}

const ErrorNotice: React.FC<ErrorNoticeProps> = ({ isVisible, message }) => {
  if (!isVisible) return null;

  return (
    <div className="absolute left-3 right-3 top-20 z-10 max-w-3xl rounded-lg bg-red-700/80 p-4 text-sm leading-relaxed text-white shadow-lg backdrop-blur-md sm:left-5 sm:right-5 sm:top-16">
      <h3 className="mb-2 mt-0 text-lg font-bold text-pink-100">⚠️ エラーが発生しました</h3>

      {message ? (
        <p>{message}</p>
      ) : (
        <>
          <p>このデモを動かすには GLB ファイルが必要です。</p>
          <code className="m-1 inline-block rounded bg-black/30 px-2 py-1 font-mono">{MODEL_PATHS.CHARACTER}</code>
          <code className="m-1 inline-block rounded bg-black/30 px-2 py-1 font-mono">{MODEL_PATHS.DANCE_MOTION}</code>
          <p>正しい場所にファイルを置いてページを再読み込みしてください。</p>
        </>
      )}
    </div>
  );
};

interface InstructionPanelProps {
  isModelLoaded: boolean;
  loadingStatus: string;
  isMenuOpen: boolean;
  onToggle: () => void;
}

const InstructionPanel: React.FC<InstructionPanelProps> = ({
  isModelLoaded,
  loadingStatus,
  isMenuOpen,
  onToggle,
}) => (
  <div className="pointer-events-none fixed left-3 top-3 z-[999] w-[min(84vw,18rem)] sm:left-4 sm:top-4">
    <div className="pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.22em] text-cyan-300">Menu</p>
          <h1 className="mt-1 truncate text-lg font-bold sm:text-xl">3D Anime</h1>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
              isModelLoaded ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {isModelLoaded ? 'OK' : loadingStatus || '読込中'}
          </span>

          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-slate-100 transition hover:bg-white/10"
          >
            {isMenuOpen ? '閉じる' : 'メニュー'}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="border-t border-white/10 px-3 py-3 sm:px-4">
          <ul className="space-y-2 text-xs leading-relaxed text-slate-200 sm:text-sm">
            <li>• ドラッグでキャラを回転</li>
            <li>• スクロールで拡大・縮小</li>
            <li>• 「ダンス再生」でアニメ開始</li>
            <li>• 「リセット」で再読み込み</li>
          </ul>
        </div>
      )}
    </div>
  </div>
);

// Main Home component
const Home = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingStatus, setLoadingStatus] = useState('読込中...');
  const [showVideo, setShowVideo] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const threeSceneRef = useRef<ThreeSceneHandle>(null);
  const loadStartTime = useRef<number>(Date.now());
  const isFirstLoad = useRef<boolean>(true);
  const videoPreloadRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ページロード時にビデオを事前にロード
  useEffect(() => {
    // ビデオを事前にロードしておく
    videoPreloadRef.current = new Audio(MODEL_PATHS.ORIGINAL_VIDEO) as unknown as HTMLVideoElement;
    videoPreloadRef.current.preload = 'auto';
    videoPreloadRef.current.load();

    return () => {
      if (videoPreloadRef.current) {
        videoPreloadRef.current.src = '';
      }
    };
  }, []);

  // Animation function
  const handleIntergalactiaDance = () => {
    if (threeSceneRef.current) {
      setShowVideo(true);

      // 音楽を最初から再生
      if (!audioRef.current) {
        audioRef.current = new Audio(MODEL_PATHS.DANCE_MUSIC);
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(error => {
        console.warn('Failed to play music:', error);
      });

      setTimeout(() => {
        threeSceneRef.current!.playDanceAnimation(0);
      }, 50);
    }
  };

  // ビデオを閉じる関数
  const handleCloseVideo = () => {
    setShowVideo(false);

    // 動画を閉じた時に音楽を再生
    if (!audioRef.current) {
      audioRef.current = new Audio(MODEL_PATHS.DANCE_MUSIC);
      audioRef.current.loop = true;
    }
    audioRef.current.play().catch(error => {
      console.warn('Failed to play music:', error);
    });
  };

  // Model load state handler
  const handleModelLoad = (loaded: boolean, error?: string) => {
    console.log("Model load state:", { loaded, error });

    // Avoid duplicate processing if already loaded
    if (isModelLoaded && !error && !isFirstLoad.current) {
      console.log("Model is already loaded");
      return;
    }

    isFirstLoad.current = false;

    if (error) {
      setErrorMessage(error.includes("Not Found") ?
        "GLB ファイルが見つかりません。'/public/3d/' にモデルを置いてください。" :
        error
      );
      setLoadingStatus('モデル読込エラー');
    } else {
      const loadTime = Date.now() - loadStartTime.current;
      console.log(`Model load completion time: ${loadTime}ms`);
      setIsModelLoaded(loaded);
      setLoadingStatus('');
      setErrorMessage('');
    }
  };

  // Model load progress display
  useEffect(() => {
    loadStartTime.current = Date.now();

    const loadingTimer = setTimeout(() => {
      if (!isModelLoaded && !errorMessage) {
        setLoadingStatus('読み込み中...少々お待ちください');
      }
    }, 3000);

    return () => clearTimeout(loadingTimer);
  }, [isModelLoaded, errorMessage]);

  // Inline styles (Tailwind compatibility workaround)
  const forceStyles = {
    container: {
      position: 'relative' as const,
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      zIndex: 0,
      background: '#111'
    },
    title: {
      textShadow: '0 0 10px rgba(255,255,255,0.5)'
    },
    threeContainer: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 1
    }
  };

  return (
    <div style={forceStyles.container} className="relative w-full h-screen overflow-hidden">
      {!isModelLoaded && !errorMessage && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 p-4 rounded-lg text-white backdrop-blur-md z-20">
          <p className="text-center">{loadingStatus}</p>
        </div>
      )}

      <ErrorNotice
        isVisible={!!errorMessage}
        message={errorMessage}
      />

      <InstructionPanel
        isModelLoaded={isModelLoaded}
        loadingStatus={loadingStatus}
        isMenuOpen={isMenuOpen}
        onToggle={() => setIsMenuOpen((prev) => !prev)}
      />

      <Controls
        onIntergalactiaDance={handleIntergalactiaDance}
        isModelLoaded={isModelLoaded}
        githubUrl="https://github.com/masaaki-imai/3D-anime/blob/main/src/app/page.tsx"
      />

      <div
        style={forceStyles.threeContainer}
        className="absolute inset-0 z-1"
      >
        <ThreeScene
          ref={threeSceneRef}
          onModelLoaded={handleModelLoad}
        />
      </div>

      <PictureInPictureVideo
        isVisible={showVideo}
        videoSrc={MODEL_PATHS.ORIGINAL_VIDEO}
        onClose={handleCloseVideo}
      />
    </div>
  );
};

export default Home;
