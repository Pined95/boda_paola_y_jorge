// 👇 PEGA TU URL
const API_URL = "https://script.google.com/macros/s/AKfycbwV574PX3AlK-KHR_uNiZjq79v59rXL8hz5RSHRjDBe2BfM1Ionnrr-EEnpjeuReslD/exec"; 

let html5QrcodeScanner = null;
let audioContext = null;
let stats = { total: 0, successful: 0 };

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') manualSearch();
    });
});

// --- PROCESAR ENTRADA ---
function processID(id) {
    const resultEl = document.getElementById('scan-result');
    resultEl.style.display = 'block';
    resultEl.innerHTML = '⏳ Validando...';
    resultEl.className = '';

    fetch(`${API_URL}?action=doCheckIn&id=${encodeURIComponent(id)}`)
    .then(res => res.json())
    .then(data => {
        const status = (data.status || "").toUpperCase();
        const esExito = status === 'SUCCESS';
        
        playAudio(esExito);
        
        // Actualizar stats sumando la cantidad de personas que entraron
        if(esExito && data.count) {
            stats.total += data.count;
            stats.successful += data.count;
        }
        updateStats(); // Guardar

        if (esExito) {
            resultEl.className = 'success';
            resultEl.innerHTML = `✅ BIENVENIDOS (${data.count})<br><span style="font-size:1.3rem">${data.nombre}</span><br>${data.mesa ? '📍 '+data.mesa : ''}`;
        } else if (status.includes('ALREADY')) {
            resultEl.className = 'already';
            resultEl.innerHTML = `⚠️ YA INGRESARON<br>${data.nombre}`;
        } else {
            resultEl.className = 'denied';
            resultEl.innerHTML = `⛔ ${data.message}`;
        }

        setTimeout(() => {
            resultEl.style.display = 'none';
            if(html5QrcodeScanner) html5QrcodeScanner.resume();
        }, 3500);
    })
    .catch(err => {
        resultEl.innerHTML = "Error de red"; resultEl.className = 'denied';
    });
}

// --- BÚSQUEDA ---
function manualSearch() {
    const q = document.getElementById('search-input').value.trim();
    if(!q) return;
    const container = document.getElementById('search-results');
    container.innerHTML = 'Buscando...';
    
    fetch(`${API_URL}?action=search&q=${encodeURIComponent(q)}`)
    .then(res => res.json())
    .then(data => {
        container.innerHTML = '';
        if(!data.results.length) { container.innerHTML = 'Sin resultados'; return; }
        
        data.results.forEach(g => {
            container.innerHTML += `
                <div class="result-item">
                    <div><b>${g.nombre}</b><br><small>${g.mesa||''}</small></div>
                    <button class="btn-in" onclick="processID('${g.id}')" ${g.yaEntro?'disabled':''}>ENTRAR</button>
                </div>`;
        });
    });
}

// --- CÁMARA ---
function startScanner() {
    initAudio();
    document.getElementById('start-btn').style.display = 'none';
    if(html5QrcodeScanner) try { html5QrcodeScanner.clear(); } catch(e){}
    
    html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: {width:250, height:250} },
        (text) => {
            html5QrcodeScanner.pause();
            let id = text;
            try { id = new URL(text).searchParams.get('id') || id; } catch(e){}
            processID(id.trim());
        }, 
        () => {}
    ).catch(e => alert("Error cámara: " + e));
}

// --- AUDIO & STATS ---
function initAudio() {
    if(!audioContext) audioContext = new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state === 'suspended') audioContext.resume();
}
function playAudio(success) {
    if(!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain); gain.connect(audioContext.destination);
    osc.frequency.value = success ? 600 : 200;
    if(success) osc.frequency.linearRampToValueAtTime(900, audioContext.currentTime + 0.2);
    gain.gain.value = 0.1;
    osc.start(); osc.stop(audioContext.currentTime + 0.3);
}
function updateStats() {
    document.getElementById('total').innerText = stats.successful; // Mostramos solo los que entraron
    localStorage.setItem('wStats', JSON.stringify(stats));
}
function loadStats() {
    const s = localStorage.getItem('wStats');
    if(s) { stats = JSON.parse(s); updateStats(); }
}
function resetStats() {
    if(confirm('¿Reset?')) { localStorage.removeItem('wStats'); stats={total:0,successful:0}; updateStats(); }
}