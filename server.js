const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://jogo-velha-rh2b.vercel.app/",
        methods: ["GET", "POST"],
        credentials: true
    }
});

let waitingPlayer = null;
let games = {};
let players = {}; // Armazena os nomes dos jogadores por socket.id

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Um jogador conectou:', socket.id);

    // Solicita o nome ao conectar
    socket.emit('requestName');

    socket.on('setName', (name) => {
        players[socket.id] = name;

        if (waitingPlayer) {
            const gameId = `${waitingPlayer.id}-${socket.id}`;
            games[gameId] = {
                players: [waitingPlayer, socket],
                board: Array(9).fill(null),
                turn: 0
            };

            const player1Name = players[waitingPlayer.id];
            const player2Name = players[socket.id];

            waitingPlayer.emit('gameStart', { 
                player: 'X', 
                gameId, 
                player1: player1Name, 
                player2: player2Name 
            });
            socket.emit('gameStart', { 
                player: 'O', 
                gameId, 
                player1: player1Name, 
                player2: player2Name 
            });
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting', 'Esperando outro jogador...');
        }
    });

    socket.on('move', ({ gameId, position }) => {
        const game = games[gameId];
        if (!game || game.players[game.turn].id !== socket.id) return;

        if (game.board[position] === null) {
            game.board[position] = game.turn === 0 ? 'X' : 'O';
            const winner = checkWinner(game.board);

            game.players.forEach(player => {
                player.emit('updateBoard', { board: game.board });
                if (winner) {
                    player.emit('gameOver', { winner: winner === 'X' ? 'X' : 'O' });
                } else if (!game.board.includes(null)) {
                    player.emit('gameOver', { winner: 'Empate' });
                }
            });

            game.turn = 1 - game.turn;
        }
    });

    socket.on('playAgain', ({ gameId }) => {
        delete games[gameId];
        if (waitingPlayer) {
            const newGameId = `${waitingPlayer.id}-${socket.id}`;
            games[newGameId] = {
                players: [waitingPlayer, socket],
                board: Array(9).fill(null),
                turn: 0
            };
            const player1Name = players[waitingPlayer.id];
            const player2Name = players[socket.id];
            waitingPlayer.emit('gameStart', { 
                player: 'X', 
                gameId: newGameId, 
                player1: player1Name, 
                player2: player2Name 
            });
            socket.emit('gameStart', { 
                player: 'O', 
                gameId: newGameId, 
                player1: player1Name, 
                player2: player2Name 
            });
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting', 'Esperando outro jogador...');
        }
    });

    socket.on('disconnect', () => {
        if (waitingPlayer === socket) waitingPlayer = null;
        for (let gameId in games) {
            if (games[gameId].players.includes(socket)) {
                games[gameId].players.forEach(player => {
                    if (player !== socket) player.emit('opponentLeft');
                });
                delete games[gameId];
            }
        }
        delete players[socket.id]; // Remove o nome ao desconectar
    });
});

function checkWinner(board) {
    const wins = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Linhas
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colunas
        [0, 4, 8], [2, 4, 6]             // Diagonais
    ];
    for (let [a, b, c] of wins) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

server.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});