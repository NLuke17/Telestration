#!/bin/bash
# Reset all lobbies back to WAITING state (useful for testing)
echo "Deleting old rounds..."
docker exec postgres-db psql -U postgres -d telestration -c "DELETE FROM \"Round\";"
echo "Resetting lobbies to WAITING state..."
docker exec postgres-db psql -U postgres -d telestration -c "UPDATE \"Lobby\" SET state = 'WAITING' WHERE state = 'IN_PROGRESS';"
echo "✅ Lobbies reset to WAITING state with all rounds cleared"
echo "💡 Now when you start a game, players will see a 3-second countdown animation before entering the game!"
