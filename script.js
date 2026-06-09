// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const settingsPanel = document.getElementById('settings-panel');
const processBtn = document.getElementById('process-btn');
const processingPanel = document.getElementById('processing-panel');
const audioPanel = document.getElementById('audio-panel');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

// Settings Elements
const thresholdSlider = document.getElementById('threshold');
const thresholdVal = document.getElementById('threshold-val');
const durationInput = document.getElementById('duration');

// UI Elements
const originalSize = document.getElementById('original-size');
const processedSize = document.getElementById('processed-size');
const resultContainer = document.getElementById('result-container');
const playOriginalBtn = document.getElementById('play-original');
const playProcessedBtn = document.getElementById('play-processed');
const downloadBtn = document.getElementById('download-btn');

// State
let currentFile = null;
let originalWaveSurfer = null;
let processedWaveSurfer = null;
let ffmpeg = null;
let processedBlobUrl = null;

// Initialize FFmpeg
async function initFFmpeg() {
    if (ffmpeg) return true;
    try {
        const { FFmpeg } = window.FFmpegWASM;
        ffmpeg = new FFmpeg();
        
        ffmpeg.on('progress', ({ progress, time }) => {
            const percent = Math.round(progress * 100);
            progressBar.style.width = `${percent}%`;
            progressText.innerText = `Procesando: ${percent}% completado...`;
        });
        
        await ffmpeg.load({
            coreURL: "ffmpeg-core.js",
            wasmURL: "ffmpeg-core.wasm"
        });
        return true;
    } catch (err) {
        console.error("Error cargando FFmpeg:", err);
        progressText.innerText = "Error cargando el motor de procesamiento. Es posible que tu navegador no lo soporte (falta SharedArrayBuffer).";
        return false;
    }
}

// Format bytes
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// WaveSurfer initialization
function initWaveSurfers() {
    if (!originalWaveSurfer) {
        originalWaveSurfer = WaveSurfer.create({
            container: '#waveform-original',
            waveColor: '#3b82f6',
            progressColor: '#2563eb',
            cursorColor: '#f8fafc',
            height: 80,
            responsive: true,
            normalize: true,
            barWidth: 2,
            barGap: 1,
            barRadius: 2
        });

        originalWaveSurfer.on('finish', () => {
            playOriginalBtn.innerText = '▶️ Reproducir';
        });
    }

    if (!processedWaveSurfer) {
        processedWaveSurfer = WaveSurfer.create({
            container: '#waveform-processed',
            waveColor: '#10b981',
            progressColor: '#059669',
            cursorColor: '#f8fafc',
            height: 80,
            responsive: true,
            normalize: true,
            barWidth: 2,
            barGap: 1,
            barRadius: 2
        });

        processedWaveSurfer.on('finish', () => {
            playProcessedBtn.innerText = '▶️ Reproducir';
        });
    }
}

// Handle File Selection
function handleFile(file) {
    if (!file || !file.type.startsWith('audio/')) {
        alert('Por favor selecciona un archivo de audio válido (MP3).');
        return;
    }

    currentFile = file;
    
    // UI Update
    dropZone.classList.add('hidden');
    settingsPanel.classList.remove('hidden');
    audioPanel.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    
    originalSize.innerText = formatBytes(file.size);
    
    // Load audio to WaveSurfer
    initWaveSurfers();
    const objectUrl = URL.createObjectURL(file);
    originalWaveSurfer.load(objectUrl);
}

// Event Listeners for File Input
fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

// Settings Events
thresholdSlider.addEventListener('input', (e) => {
    thresholdVal.innerText = `${e.target.value} dB`;
});

// Audio Processing
processBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    settingsPanel.classList.add('hidden');
    processingPanel.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.innerText = 'Inicializando FFmpeg...';

    const success = await initFFmpeg();
    if (!success) {
        processBtn.disabled = false;
        return;
    }

    try {
        progressText.innerText = 'Cargando archivo de audio...';
        const { fetchFile } = window.FFmpegUtil;
        const ext = currentFile.name.split('.').pop().toLowerCase() === 'wav' ? 'wav' : 'mp3';
        const inputName = `input.${ext}`;
        const outputName = `output.${ext}`;
        
        await ffmpeg.writeFile(inputName, await fetchFile(currentFile));

        const threshold = thresholdSlider.value;
        const durationStr = (parseInt(durationInput.value) / 1000).toFixed(2);
        
        // silenceremove filter:
        const filter = `silenceremove=stop_periods=-1:stop_duration=${durationStr}:stop_threshold=${threshold}dB`;

        progressText.innerText = 'Detectando y eliminando silencios...';
        
        await ffmpeg.exec(['-i', inputName, '-af', filter, outputName]);

        progressText.innerText = 'Generando archivo final...';
        const data = await ffmpeg.readFile(outputName);
        const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/mp3';
        const blob = new Blob([data.buffer], { type: mimeType });
        
        if (processedBlobUrl) URL.revokeObjectURL(processedBlobUrl);
        processedBlobUrl = URL.createObjectURL(blob);
        
        processedSize.innerText = formatBytes(blob.size);
        processedWaveSurfer.load(processedBlobUrl);
        
        // Setup download button
        downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = processedBlobUrl;
            a.download = `procesado_${currentFile.name}`;
            a.click();
        };

        processingPanel.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        settingsPanel.classList.remove('hidden'); // Allow new processing with different params

    } catch (err) {
        console.error(err);
        progressText.innerText = 'Error durante el procesamiento.';
        setTimeout(() => {
            processingPanel.classList.add('hidden');
            settingsPanel.classList.remove('hidden');
        }, 3000);
    }
});

// Playback controls
playOriginalBtn.addEventListener('click', () => {
    if (originalWaveSurfer.isPlaying()) {
        originalWaveSurfer.pause();
        playOriginalBtn.innerText = '▶️ Reproducir';
    } else {
        originalWaveSurfer.play();
        playOriginalBtn.innerText = '⏸️ Pausar';
    }
});

playProcessedBtn.addEventListener('click', () => {
    if (processedWaveSurfer.isPlaying()) {
        processedWaveSurfer.pause();
        playProcessedBtn.innerText = '▶️ Reproducir';
    } else {
        processedWaveSurfer.play();
        playProcessedBtn.innerText = '⏸️ Pausar';
    }
});
