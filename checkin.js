// 👇 URL DEL APPS SCRIPT
const API_URL = "https://script.google.com/macros/s/AKfycbzALMyxg0lU8ab1ImJx9cMBaeu8_0tTqeyfH_HKBpEiGZcb-HAaMQ_SeZHxO9ChbRds/exec"; 

let html5QrcodeScanner = null;
let audioContext = null;
let stats = { total: 0 };

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    renderHistory(); // Cargar historial al inicio
    
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
        
        if (esExito) {
            resultEl.className = 'success';
            resultEl.innerHTML = `✅ <b>BIENVENIDOS (${data.count})</b><br><span style="font-size:1.2rem">${data.nombre}</span><br>${data.mesa ? '📍 '+data.mesa : ''}`;
            
            // Actualizar stats
            if(data.count) {
                stats.total += data.count;
                updateStats();
            }
            // Agregar al historial visual
            addToHistory(data.nombre, data.mesa, data.count);
            
        } else if (status.includes('ALREADY')) {
            resultEl.className = 'already';
            resultEl.innerHTML = `⚠️ <b>YA INGRESARON</b><br>${data.nombre}`;
        } else {
            resultEl.className = 'denied';
            resultEl.innerHTML = `⛔ ${data.message}`;
        }

        setTimeout(() => {
            resultEl.style.display = 'none';
            if(html5QrcodeScanner) html5QrcodeScanner.resume();
        }, 4000);
    })
    .catch(err => {
        resultEl.innerHTML = "Error de red"; 
        resultEl.className = 'denied';
        console.error(err);
    });
}

// --- HISTORIAL LOCAL ---
function addToHistory(nombre, mesa, cantidad) {
    let history = JSON.parse(localStorage.getItem('wHistory') || '[]');
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Agregamos al inicio
    history.unshift({ nombre, mesa, cantidad, time });
    
    // Solo guardamos los últimos 10
    if(history.length > 10) history.pop();
    
    localStorage.setItem('wHistory', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('recent-logs');
    let history = JSON.parse(localStorage.getItem('wHistory') || '[]');
    
    if(history.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#ccc; padding:10px;">Esperando invitados...</div>';
        return;
    }

    list.innerHTML = '';
    history.forEach(item => {
        list.innerHTML += `
            <div class="log-item">
                <div>
                    <b>${item.nombre}</b> <small>(${item.cantidad} pers)</small><br>
                    <span style="color:var(--gold)">${item.mesa || ''}</span>
                </div>
                <div class="log-time">${item.time}</div>
            </div>
        `;
    });
}

// --- BÚSQUEDA ---
function manualSearch() {
    const q = document.getElementById('search-input').value.trim();
    if(!q) return;
    const container = document.getElementById('search-results');
    container.innerHTML = '<div style="text-align:center; padding:10px;">Buscando...</div>';
    
    fetch(`${API_URL}?action=search&q=${encodeURIComponent(q)}`)
    .then(res => res.json())
    .then(data => {
        container.innerHTML = '';
        if(!data.results || !data.results.length) { 
            container.innerHTML = '<div style="text-align:center; padding:10px;">Sin resultados</div>'; 
            return; 
        }
        
        data.results.forEach(g => {
            container.innerHTML += `
                <div class="result-item">
                    <div>
                        <b>${g.nombre}</b><br>
                        <small style="color:#666">${g.mesa||'Sin mesa'}</small>
                    </div>
                    <button class="btn-in" onclick="processID('${g.id}')" ${g.yaEntro?'disabled style="background:#eee; color:#999"':''}>
                        ${g.yaEntro ? 'ADENTRO' : 'ENTRAR'}
                    </button>
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
            try { 
                // Intentar sacar ID si viene una URL completa
                const urlObj = new URL(text);
                id = urlObj.searchParams.get('id') || text; 
            } catch(e){}
            
            processID(id.trim());
        }, 
        (error) => { 
            // Ignoramos errores de no detección por frame para no saturar consola
        }
    ).catch(e => alert("Error al iniciar cámara: " + e));
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
    osc.frequency.value = success ? 1000 : 300; // Más agudo para éxito
    if(success) {
        // Sonido tipo "Ding-Dong"
        osc.frequency.setValueAtTime(800, audioContext.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, audioContext.currentTime + 0.1);
    } else {
        // Sonido tipo "Error" grave
        osc.type = 'sawtooth';
    }
    gain.gain.value = 0.1;
    osc.start(); 
    osc.stop(audioContext.currentTime + (success ? 0.3 : 0.5));
}

function updateStats() {
    document.getElementById('total').innerText = stats.total;
    localStorage.setItem('wStats', JSON.stringify(stats));
}

function loadStats() {
    const s = localStorage.getItem('wStats');
    if(s) { stats = JSON.parse(s); updateStats(); }
}

function resetStats() {
    if(confirm('¿Borrar conteo e historial?')) { 
        localStorage.removeItem('wStats'); 
        localStorage.removeItem('wHistory');
        stats={total:0}; 
        updateStats();
        renderHistory();
    }
}