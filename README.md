# Constelestration

Constelestration is a multiplayer web version of the popular board game, Telestrations. It also sports a fun, space-themed interface with both light and dark mode options available. This application uses Websockets for instantaneous game state synchronization and TypeScript for robust, type-safe development. Players join rooms using unique room codes, play through synchronous drawing and guessing phases, and finally view a reveal of each player's completed flipbooks with the contributions of the other players. 

## Installation & Launch

1. Clone the repository
```bash
git clone [https://github.com/](https://github.com/)[your-repo]/telestration.git
```

2. Prerequisites: Ensure you have NodeJS (v18+) and npm installed.

3. Install Dependencies: Navigate into both the /frontend and /backend directories and install the necessary packages using:
```bash
cd frontend && npm install
cd ../backend && npm install
```
4. Launch with Docker: run the following at the root directory to start up the frontend, backend, and database containers
```bash
docker compose up --build
```
5. Teardown: To close the application and reset containers
```bash
docker compose down
```

## Usage
After launching the application with Docker, visit ```https://localhost:5174``` (or whatever port the application runs on) in your browser to use the application.
1. Sign in or sign up (or play as a guest) to create a lobby
2. Give the unique code to a friend to join the room. You need at least 2 players to play a game.
3. Once all players have joined, click start to start the game
4. Everyone will enter an initial prompt, then draw, then guess, then draw. This cycle repeats until everyone has contributed to every flipbook.
5. Everyone view the full chain of entries for each flipbook to see how the original prompts evolved
6. After the reveal, everyone votes for their favorite flipbook
7. Finally, the leaderboard of flipbooks is revealed, and you can choose to play again or leave the lobby.

## Contributing

This project was developed for an academic assignment and is not open for external contributions.

## License

[MIT](https://choosealicense.com/licenses/mit/)
