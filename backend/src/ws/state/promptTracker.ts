/**
 * Track prompts submitted by players before game starts
 */

interface LobbyPrompts {
  [userId: string]: string; // userId -> prompt
}

export class PromptTracker {
  private prompts: Map<string, LobbyPrompts> = new Map(); // lobbyId -> user prompts

  /**
   * Submit a prompt for a user in a lobby
   */
  submitPrompt(lobbyId: string, userId: string, prompt: string): void {
    if (!this.prompts.has(lobbyId)) {
      this.prompts.set(lobbyId, {});
    }
    
    const lobbyPrompts = this.prompts.get(lobbyId)!;
    lobbyPrompts[userId] = prompt;
  }

  /**
   * Get all prompts for a lobby
   */
  getPrompts(lobbyId: string): LobbyPrompts {
    return this.prompts.get(lobbyId) || {};
  }

  /**
   * Get prompts as ordered array based on player order
   */
  getPromptsArray(lobbyId: string, playerIds: string[]): string[] {
    const lobbyPrompts = this.getPrompts(lobbyId);
    return playerIds.map(playerId => lobbyPrompts[playerId] || '');
  }

  /**
   * Check if all players have submitted prompts
   */
  allPromptsSubmitted(lobbyId: string, playerIds: string[]): boolean {
    const lobbyPrompts = this.getPrompts(lobbyId);
    return playerIds.every(playerId => {
      const prompt = lobbyPrompts[playerId];
      return prompt && prompt.trim().length > 0;
    });
  }

  /**
   * Get count of submitted prompts
   */
  getPromptCount(lobbyId: string): number {
    const lobbyPrompts = this.getPrompts(lobbyId);
    return Object.keys(lobbyPrompts).filter(userId => {
      const prompt = lobbyPrompts[userId];
      return prompt && prompt.trim().length > 0;
    }).length;
  }

  /**
   * Clear prompts for a lobby (after game starts)
   */
  clearPrompts(lobbyId: string): void {
    this.prompts.delete(lobbyId);
  }

  /**
   * Remove a specific user's prompt
   */
  removePrompt(lobbyId: string, userId: string): void {
    const lobbyPrompts = this.prompts.get(lobbyId);
    if (lobbyPrompts) {
      delete lobbyPrompts[userId];
    }
  }
}
