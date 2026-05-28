import { Muxer, ArrayBufferTarget } from 'webm-muxer';

// Pull the pristine asset URLs directly through Vite's file host system
import ttsWrapperUrl from './wasm/sherpa-onnx-tts.js?url';
import emscriptenGlueUrl from './wasm/sherpa-onnx-wasm-nodejs.js?url';
import wasmBinaryUrl from './wasm/sherpa-onnx-wasm-nodejs.wasm?url';

let ttsEngine = null;
let isTtsReady = false;

let slides = [
  { id: 1, type: 'text', text: 'In the future we will have landscapes without ugly electricity pylons, because everyone will have a free energy device at home that draws the omnipresent and freely available energy from the aether.', imageSrc: null, imgObject: null },
  { id: 2, type: 'title', text: 'VISIONS OF THE FUTURE\nCities that feel like paradise', imageSrc: null, imgObject: null }
];
let nextSlideId = 3;

// DOM Elements
const slidesListEl = document.getElementById('slidesList');
const addSlideBtn = document.getElementById('addSlideBtn');
const vlogifyBtn = document.getElementById('vlogifyBtn');
const statusEl = document.getElementById('status');
const bgAudioInput = document.getElementById('bgAudioInput');

// Initialize App Systems
renderSlidesUI();
initOfflineTtsSystem();

/**
 * Initializes the unified WebAssembly module inside your web browser
 */
async function initOfflineTtsSystem() {
  try {
    statusEl.textContent = "Loading offline speech synthesis engine...";
    vlogifyBtn.disabled = true;

    // 1. Establish robust, persistent environment shims BEFORE script injection
    window.module = { exports: {} };
    window.exports = window.module.exports;
    
    // Create a complete, immutable mock path architecture
    const mockPathModule = {
      posix: {
        join: (...args) => args.join('/').replace(/\/+/g, '/'),
        normalize: (p) => p,
        resolve: (...args) => args.join('/')
      },
      join: (...args) => args.join('/').replace(/\/+/g, '/'),
      normalize: (p) => p,
      resolve: (...args) => args.join('/')
    };

    // Keep require persistent during the execution phase
    window.require = function(mod) {
      if (mod === 'path') return mockPathModule;
      if (mod === 'fs') {
        return {
          readFileSync: () => new Uint8Array(),
          mkdirSync: () => {},
          statSync: () => ({ isDirectory: () => true })
        };
      }
      return undefined;
    };

    // Force global assignments so internal closures can always fallback correctly
    window.nodePath = mockPathModule;

    // 2. Inject the main Emscripten infrastructure layer
    await injectScript(emscriptenGlueUrl);

    // 3. Inject the specific Kaldi TTS features layer
    await injectScript(ttsWrapperUrl);

    // 4. Capture the exported factory instantiation handler safely
    let targetFactory = null;
    if (window.module && window.module.exports) {
      targetFactory = window.module.exports;
    }

    if (!targetFactory || typeof targetFactory !== 'function') {
      throw new Error("The downloaded script did not export a valid module factory function.");
    }

    // 5. Define our low-level static file routing interceptor
    // We attach the mock variables directly onto the configuration block 
    // to override any internal cached exceptions during the runtime lifecycle.
    const wasmConfiguration = {
      nodePath: mockPathModule,
      locateFile: (path) => {
        if (path.endsWith('.wasm')) {
          return wasmBinaryUrl; // Explicitly map straight to Vite's static file asset location
        }
        return path;
      }
    };

    // 6. Compile and instantiate the underlying Emscripten API interface layout
    const sherpa_onnx = await targetFactory(wasmConfiguration);
    
    if (!sherpa_onnx || !sherpa_onnx.loadWasm) {
      throw new Error("Speech engine failed to compile the WebAssembly API surface.");
    }

    window.sherpa_onnx = sherpa_onnx;

    // 7. Hydrate the active WebAssembly memory runtime heap allocation structures
    const ttsModule = await sherpa_onnx.loadWasm();

    // 8. Pass target asset tracking definitions straight to the live WASM environment context
    const config = {
      model: {
        vits: {
          model: './kitten-nano-en-v0_1-fp16/model.fp16.onnx',
          lexicon: '', 
          tokens: './kitten-nano-en-v0_1-fp16/tokens.txt',
          dataDir: './kitten-nano-en-v0_1-fp16/espeak-ng-data',
          noiseScale: 0.667,
          noiseScaleW: 0.8,
          lengthScale: 1.0 
        }
      },
      maxNumSentences: 1
    };

    // Instantiate your live local audio presentation synthesis pipeline!
    ttsEngine = new ttsModule.OfflineTts(config);
    
    // 9. CLEANUP SCOPE SANITIZATION: Safely strip global trackers now that initialization is successful
    delete window.module;
    delete window.exports;
    delete window.require;
    delete window.nodePath;

    isTtsReady = true;
    statusEl.textContent = "Speech modules loaded natively. Ready to Vlogify!";
    vlogifyBtn.disabled = false;
  } catch (err) {
    console.error("WASM Engine initialization breakdown:", err);
    statusEl.textContent = "Error setting up voice assets.";
    
    // Clean up on failure to keep the window clear
    delete window.module;
    delete window.exports;
    delete window.require;
    delete window.nodePath;
  }
}

function injectScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load asset: ${url}`));
    document.head.appendChild(script);
  });
}

addSlideBtn.addEventListener('click', () => {
  slides.push({ id: nextSlideId++, type: 'text', text: '', imageSrc: null, imgObject: null });
  renderSlidesUI();
});

vlogifyBtn.addEventListener('click', startVlogifyPresentation);

function renderSlidesUI() {
  slidesListEl.innerHTML = '';
  slides.forEach((slide, index) => {
    const card = document.createElement('div');
    card.className = 'slide-card';
    card.dataset.id = slide.id;

    card.innerHTML = `
      <div class="slide-main">
        <div class="slide-header-row">
          <span class="slide-num">Slide #${index + 1}</span>
          <select class="slide-type-select">
            <option value="text" ${slide.type === 'text' ? 'selected' : ''}>Standard Narrative Slide</option>
            <option value="title" ${slide.type === 'title' ? 'selected' : ''}>Big Title Overlay Slide</option>
          </select>
        </div>
        <textarea class="slide-text-input" placeholder="Type narration text here...">${slide.text}</textarea>
      </div>
      <div class="slide-meta">
        <div class="image-input-container">
          ${slide.imageSrc ? `<img src="${slide.imageSrc}">` : `<div class="image-label">📁 Click or drop background picture</div>`}
          <input type="file" class="slide-image-file" accept="image/*">
        </div>
        ${slides.length > 1 ? `<button class="btn-delete">Delete</button>` : '<div></div>'}
      </div>
    `;

    card.querySelector('.slide-type-select').addEventListener('change', (e) => { slide.type = e.target.value; renderSlidesUI(); });
    card.querySelector('.slide-text-input').addEventListener('input', (e) => { slide.text = e.target.value; });
    card.querySelector('.slide-image-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => { slide.imageSrc = event.target.result; renderSlidesUI(); };
        reader.readAsDataURL(file);
      }
    });
    const deleteBtn = card.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => { slides = slides.filter(s => s.id !== slide.id); renderSlidesUI(); });
    }
    slidesListEl.appendChild(card);
  });
}

function instantiateHTMLImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Splits strings into punctuation-bounded fragments for timed display
 */
function splitTextByPunctuation(text) {
  const rawPhrases = text.split(/([,.!?]+)/);
  const textChunks = [];
  for (let i = 0; i < rawPhrases.length; i += 2) {
    const phraseText = rawPhrases[i]?.trim();
    const punctuation = rawPhrases[i + 1] || '';
    if (phraseText && phraseText.length > 0) {
      textChunks.push(phraseText + punctuation);
    }
  }
  return textChunks;
}

/**
 * Generates raw PCM buffers from the WASM heap and calculates phrase timelines
 */
async function generateWasmSpeechTrack(text, audioCtx) {
  if (!text || !isTtsReady) return { duration: 4.0, chunks: [], audioBuffer: null };

  const textChunks = splitTextByPunctuation(text);
  const phraseTimings = [];
  let currentTimelinePointer = 0.4; // Initial head room padding

  // Request raw audio samples using configuration object context
  const audioObj = ttsEngine.generate({ text: text, speakerId: 0 });
  const rawSamples = audioObj.samples; // Float32Array containing mono speech
  const modelSampleRate = audioObj.sampleRate || 16000;

  if (!rawSamples || rawSamples.length === 0) {
    throw new Error("WASM synthesis returned an empty audio buffer.");
  }

  // Wrap into a native AudioBuffer blueprint context
  const sourceAudioBuffer = audioCtx.createBuffer(1, rawSamples.length, modelSampleRate);
  sourceAudioBuffer.getChannelData(0).set(rawSamples);

  // Distribute timeline markings proportionally by text word count balance
  const totalWords = textChunks.reduce((sum, chunk) => sum + chunk.split(' ').length, 0);
  const totalDuration = sourceAudioBuffer.duration;
  const durationPerWord = totalDuration / Math.max(1, totalWords);

  textChunks.forEach((phraseText) => {
    const wordCount = phraseText.split(' ').filter(w => w.length > 0).length;
    const estimatedDuration = Math.max(1.4, wordCount * durationPerWord);

    phraseTimings.push({
      text: phraseText,
      startTime: currentTimelinePointer,
      endTime: currentTimelinePointer + estimatedDuration
    });

    currentTimelinePointer += estimatedDuration;
  });

  // Cleanly upsample to 48000Hz to match our destination webm-muxer configuration
  const upsampledBuffer = await upsampleAudioTrack(sourceAudioBuffer, 48000);

  // Garbage collect WASM memory layout allocations immediately
  if (audioObj.free) audioObj.free();

  return {
    duration: upsampledBuffer.duration + 0.8,
    chunks: phraseTimings,
    audioBuffer: upsampledBuffer
  };
}

/**
 * Uses an OfflineAudioContext to resample speech buffers cleanly into dual stereo channels
 */
function upsampleAudioTrack(sourceBuffer, targetSampleRate) {
  const offlineCtx = new OfflineAudioContext(
    2, // Output dual stereo channels
    Math.ceil(sourceBuffer.duration * targetSampleRate),
    targetSampleRate
  );
  
  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = sourceBuffer;
  sourceNode.connect(offlineCtx.destination);
  sourceNode.start();
  
  return offlineCtx.startRendering();
}

/**
 * Draws wrapped subtitles across up to three lines inside canvas boundaries safely
 */
function drawThreeRowWrappedText(ctx, text, centerX, baseLineY, maxWidth, lineHeight) {
  const words = text.split(' ');
  let lines = [];
  let currentLine = '';

  for (let n = 0; n < words.length; n++) {
    let testLine = currentLine + words[n] + ' ';
    let metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(currentLine.trim());
      currentLine = words[n] + ' ';
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine.trim());

  // Clip array to 3 lines maximum to prevent boundary overflowing
  if (lines.length > 3) lines = lines.slice(0, 3);

  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, baseLineY + (index * lineHeight));
  });
}

/**
 * Master compilation orchestrator loop
 */
async function startVlogifyPresentation() {
  if (!isTtsReady) return alert("WASM text-to-speech engine is still initializing!");
  
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  vlogifyBtn.disabled = true;
  statusEl.textContent = "Processing assets and running offline WASM text-to-speech loops...";

  try {
    // 1. Resolve Background Images
    for (let slide of slides) {
      if (slide.imageSrc) slide.imgObject = await instantiateHTMLImage(slide.imageSrc);
    }

    // 2. Synthesize High-Quality Speech via local WASM buffers
    const processedSlides = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (slide.type === 'text' && slide.text) {
        statusEl.textContent = `Generating offline studio voice track for Slide #${i + 1}...`;
        const speechData = await generateWasmSpeechTrack(slide.text, audioCtx);
        processedSlides.push({
          ...slide,
          duration: speechData.duration,
          chunks: speechData.chunks,
          audioBuffer: speechData.audioBuffer
        });
      } else {
        processedSlides.push({ ...slide, duration: 5.0, chunks: [], audioBuffer: null });
      }
    }

    // 3. Ambient Track Audio Adjustments
    let bgMusicBuffer = null;
    const audioFile = bgAudioInput.files[0];
    if (audioFile) {
      statusEl.textContent = "Decoding music tracking arrays...";
      const arrayBuffer = await audioFile.arrayBuffer();
      const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
      bgMusicBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
      decodeCtx.close();
    }

    // 4. Offscreen Compositing Canvas Layout Setup (1280x720 Rendering Box)
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = 1280;
    renderCanvas.height = 720;
    const ctx = renderCanvas.getContext('2d');
    
    const fps = 30;
    const timelineSlides = processedSlides.map(slide => ({
      ...slide,
      totalFrames: Math.ceil(slide.duration * fps)
    }));

    const totalFrames = timelineSlides.reduce((sum, s) => sum + s.totalFrames, 0);

    // 5. Initialize WebM Core Targets
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'V_VP8', width: 1280, height: 720 },
      audio: { codec: 'A_OPUS', sampleRate: 48000, numberOfChannels: 2 }
    });

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => console.error(e)
    });
    videoEncoder.configure({ codec: 'vp8', width: 1280, height: 720, bitrate: 4_000_000, framerate: fps });

    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => console.error(e)
    });
    audioEncoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 });

    let frameCounter = 0;
    let totalAudioSamplesProcessed = 0;

    // 6. Presentation Production Rendering Loop
    for (let i = 0; i < timelineSlides.length; i++) {
      const slide = timelineSlides[i];
      const frameLimit = slide.totalFrames;

      for (let f = 0; f < frameLimit; f++) {
        statusEl.textContent = `Assembling and processing video frames: ${Math.floor((frameCounter / totalFrames) * 100)}%`;

        ctx.fillStyle = '#121214';
        ctx.fillRect(0, 0, 1280, 720);

        // Render Motion Imagery Actions (Ken Burns style panning effect)
        if (slide.imgObject) {
          const img = slide.imgObject;
          const scaleFit = Math.max(1280 / img.width, 720 / img.height);
          const lerpFactor = f / frameLimit;
          const scaleCurrent = scaleFit * (1.01 + lerpFactor * 0.04);
          
          const w = img.width * scaleCurrent;
          const h = img.height * scaleCurrent;
          ctx.drawImage(img, (1280 - w) / 2, (720 - h) / 2, w, h);
        } else {
          const fillGradient = ctx.createLinearGradient(0, 0, 1280, 720);
          fillGradient.addColorStop(0, '#1a1a24');
          fillGradient.addColorStop(1, '#0c0c0e');
          ctx.fillStyle = fillGradient;
          ctx.fillRect(0, 0, 1280, 720);
        }

        // Render Slide Text Blocks (Full title cards vs 3-Row Lower Third subtitles)
        if (slide.type === 'title') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.fillRect(0, 0, 1280, 720);
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 52px system-ui, sans-serif';
          const rows = (slide.text || '').split('\n');
          if (rows.length > 1) {
            ctx.fillText(rows[0], 640, 320);
            ctx.fillText(rows[1], 640, 400);
          } else {
            ctx.fillText(slide.text || '', 640, 360);
          }
        } else {
          const currentTimeOffset = f / fps;
          const currentPhrase = slide.chunks.find(c => currentTimeOffset >= c.startTime && currentTimeOffset < c.endTime);

          if (currentPhrase) {
            // Lower Third backing block
            ctx.fillStyle = 'rgba(15, 15, 20, 0.88)';
            ctx.fillRect(80, 720 - 185, 1120, 145);
            
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = '600 30px system-ui, sans-serif';
            
            // Render text safely wrapped across three maximum lines
            drawThreeRowWrappedText(ctx, currentPhrase.text, 640, 720 - 170, 1040, 38);
          }
        }

        // Encode Canvas Frame Data
        const timestampMicroseconds = (frameCounter * 1000000) / fps;
        const videoFrame = new VideoFrame(renderCanvas, { timestamp: timestampMicroseconds });
        videoEncoder.encode(videoFrame, { keyFrame: frameCounter % (fps * 2) === 0 });
        videoFrame.close();

        // Audio Interleaving channel mixing configuration
        const sampleRate = 48000;
        const samplesPerFrame = sampleRate / fps;
        
        const leftAlloc = new Float32Array(samplesPerFrame);
        const rightAlloc = new Float32Array(samplesPerFrame);

        let bgLeft = null, bgRight = null;
        if (bgMusicBuffer) {
          bgLeft = bgMusicBuffer.getChannelData(0);
          bgRight = bgMusicBuffer.numberOfChannels > 1 ? bgMusicBuffer.getChannelData(1) : bgLeft;
        }

        let voiceLeft = null, voiceRight = null;
        if (slide.audioBuffer) {
          voiceLeft = slide.audioBuffer.getChannelData(0);
          voiceRight = slide.audioBuffer.numberOfChannels > 1 ? slide.audioBuffer.getChannelData(1) : voiceLeft;
        }

        const frameAudioPointerOffset = Math.floor(f * samplesPerFrame);

        for (let s = 0; s < samplesPerFrame; s++) {
          let l = 0, r = 0;

          // Mix ducked background tracks
          if (bgMusicBuffer) {
            const bgIdx = totalAudioSamplesProcessed + s;
            if (bgIdx < bgLeft.length) {
              l += bgLeft[bgIdx] * 0.12;
              r += bgRight[bgIdx] * 0.12;
            }
          }

          // Mix high-quality offline WASM speech data samples
          if (voiceLeft) {
            const voiceIdx = frameAudioPointerOffset + s;
            if (voiceIdx < voiceLeft.length) {
              l += voiceLeft[voiceIdx] * 0.95;
              r += voiceRight[voiceIdx] * 0.95;
            }
          }

          leftAlloc[s] = Math.max(-1, Math.min(1, l));
          rightAlloc[s] = Math.max(-1, Math.min(1, r));
        }

        const compositeAudioBuffer = new Float32Array(samplesPerFrame * 2);
        compositeAudioBuffer.set(leftAlloc, 0);
        compositeAudioBuffer.set(rightAlloc, samplesPerFrame);

        const audioDataUnit = new AudioData({
          format: 'f32-planar',
          sampleRate: sampleRate,
          numberOfFrames: samplesPerFrame,
          numberOfChannels: 2,
          timestamp: timestampMicroseconds,
          data: compositeAudioBuffer
        });

        audioEncoder.encode(audioDataUnit);
        audioDataUnit.close();

        totalAudioSamplesProcessed += samplesPerFrame;
        frameCounter++;
      }
    }

    // Finalize binary media generation
    statusEl.textContent = "Writing file layout schemas and flushing outputs...";
    await videoEncoder.flush();
    await audioEncoder.flush();
    muxer.finalize();

    const finalBlob = new Blob([muxer.target.buffer], { type: 'video/webm' });
    const downloadUrl = URL.createObjectURL(finalBlob);

    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = 'vlogify-presentation.webm';
    anchor.click();

    URL.revokeObjectURL(downloadUrl);
    statusEl.textContent = "Render Complete! Standalone presentation file downloaded.";
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    vlogifyBtn.disabled = false;
    audioCtx.close();
  }
}
