// Distância entre dois pontos em metros
function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Rumo em graus
function calcularRumo(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const toDeg = x => x * 180 / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function rumoCardinal(brng) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(brng / 45) % 8];
}

function limitesMapa(lat, lon, raioKm) {
    const R = 6371; // raio da Terra em km
  
    const deltaLat = (raioKm / R) * (180 / Math.PI); // conversão para graus
    const deltaLon = (raioKm / R) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
  
    return {
      minLat: lat - deltaLat,
      maxLat: lat + deltaLat,
      minLon: lon - deltaLon,
      maxLon: lon + deltaLon
    };
  }

function desenharUltimoPonto() {
  if (pontos.length < 2) return;

  const p1 = gpsParaCanvas(pontos[pontos.length - 2].lat, pontos[pontos.length - 2].lon);
  const p2 = gpsParaCanvas(pontos[pontos.length - 1].lat, pontos[pontos.length - 1].lon);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 3;
  ctx.stroke();

  // marca último ponto em azul
  ctx.fillStyle = "blue";
  ctx.beginPath();
  ctx.arc(p2.x, p2.y, 5, 0, 2 * Math.PI);
  ctx.fill();
}

function ajustarCanvas() {
  const canvas = document.getElementById("mapCanvas");
  // largura = largura da janela
  canvas.width = window.innerWidth;
  // altura proporcional (exemplo: metade da largura)
  canvas.height = window.innerWidth;
  //redesenhar();
  desenharPercurso();
}

async function iniciaGravacao_interval(listapontos){
  const opcao_pos = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
  };
  return setInterval(() => {
    navigator.geolocation.getCurrentPosition(pos => {
      listapontos.push({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        time: new Date().toISOString(),
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        accuracy: pos.coords.accuracy,
        ele: pos.coords.altitude
      });
      desenharUltimoPonto();
      atualizarInfo();
    }, err => console.error("Erro ao obter localização:", err), opcao_pos);
  }, 1000);  
}

let ultimoTempo = 0;
async function iniciaGravacao_watch(listapontos){
  const opcao_pos = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
  };
  return navigator.geolocation.watchPosition(
    pos => {
      let agora = Date.now();
      if (agora - ultimoTempo >= 1000) {
        ultimoTempo = agora;
        listapontos.push({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          time: new Date().toISOString(),
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
          ele: pos.coords.altitude
        });
        desenharUltimoPonto();
        atualizarInfo();
      }
    },
    err => console.error("Erro ao obter localização:", err), opcao_pos);
}

/* Retirado palavra async da função*/
function carregarMapaAtual() {
  if (!navigator.geolocation) {
    alert("Geolocalização não suportada neste navegador.");
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
 
      const limites = limitesMapa(lat, lon, raioMapa); // 20 km de raio
 
      mapaAtual = {
        id: "mapaLocal",
        nome: "Mapa Local",
        arquivo: "semmapa.png", // ou outro fundo de mapa genérico
        minLat: limites.minLat,
        maxLat: limites.maxLat,
        minLon: limites.minLon,
        maxLon: limites.maxLon
      };
 
      // Carregar imagem do mapa (ex.: PNG genérico)
      img.src = mapaAtual.arquivo;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
    },
    (err) => {
      console.error("Erro ao obter posição:", err);
      alert("Não foi possível obter sua localização.");
    }
  );
}

function gerarGPX(pontos) {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="JS GPX Recorder" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>Rota</name><trkseg>`;
  const footer = `</trkseg></trk></gpx>`;

  const pts = pontos.map(p => 
    `<trkpt lat="${p.lat}" lon="${p.lon}">
      <time>${p.time}</time>
      <speed>${p.speed}</speed>
      <course>${p.heading}</course>
      <ele>${p.ele}</ele>
      <accuracy>${p.accuracy}</accuracy>
    </trkpt>`
  ).join("\n");

  return header + "\n" + pts + "\n" + footer;
}

async function carregarMapasJSON() {
  try {
    const response = await fetch("mapas.json");
    const dados = await response.json();
    const select = document.getElementById("mapSelect");
    dados.forEach(m => {
      mapas[m.id] = m;
      const option = document.createElement("option");
      option.value = m.id;
      option.textContent = m.nome;
      select.appendChild(option);
    });
    // Carrega o primeiro mapa por padrão
    //carregarMapa(dados[0].id);
  } catch (err) {
    console.error("Erro ao carregar mapas JSON:", err);
  }
}
