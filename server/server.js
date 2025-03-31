const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

let players = {};
let scores = [];

server.on('connection', (socket) => {
  console.log('Player connected');
  socket.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'join') {
      players[socket.id] = { id: socket.id, username: data.username, score: 0, active: true };
      socket.id = Object.keys(players).length;
      broadcastScores();
    } else if (data.type === 'update') {
      if (players[socket.id]) {
        players[socket.id].score = data.score;
        broadcastScores();
      }
    } else if (data.type === 'gameOver') {
      if (players[socket.id]) {
        players[socket.id].active = false;
        scores.push({ username: players[socket.id].username, score: data.score });
        scores.sort((a, b) => b.score - a.score);
        scores = scores.slice(0, 10);
        broadcastScores();
      }
    }
  });

  socket.on('close', () => {
    if (players[socket.id]) {
      players[socket.id].active = false;
    }
    broadcastScores();
  });
});

function broadcastScores() {
  const activePlayers = Object.values(players).filter(p => p.active);
  const data = { type: 'scores', active: activePlayers, leaderboard: scores };
  server.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

console.log('Server running on ws://localhost:8080');