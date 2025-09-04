# web-caer-nautica

## Serviços e eventos

Site da seção náutica do Clube da Aeronáutica de Brasília

## Rastreador

Gera um arquivo GPX com pontos a cada 1 segundo para uso nas competições de rally.

**rastreador.html** usa navigator.watchposition para acompanhar o percurso, desenha na tela e permite baixar o arquivo GPX ao final.

**rastreador2.html** usa navigator.watchposition para acompanhar o percurso, desenha na tela, _grava no banco de dados Firebase_ e permite baixar o arquivo ao final.

**rastreador3.html** usa navigator.watchposition para acompanhar o percurso _em um canvas com circuito proveniente do Firebase_, desenha na tela, grava no banco de dados Firebase e permite baixar o arquivo ao final.

**visualizar.html** permite observar em tempo real os competidores buscando os dados no Firebase.

