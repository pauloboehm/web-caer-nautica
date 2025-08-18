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

  async function carregarMapaAtual() {
    if (!navigator.geolocation) {
      alert("Geolocalização não suportada neste navegador.");
      return;
    }
  
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
  
        const limites = limitesMapa(lat, lon, 20); // 20 km de raio
  
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
    